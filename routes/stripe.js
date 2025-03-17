const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const { stripe, createStripeCustomer, createStripeSubscription, cancelStripeSubscription, updateStripeSubscription, updatePaymentMethod, processRefund } = require('../middleware/stripe');
const transporter = require('../middleware/nodemailer');
const Membership = require('../models/Membersip');
const MembershipTier = require('../models/MembershipTier');
const User = require('../models/Users');

// Create a subscription
router.post('/create-subscription', authenticateJWT, async (req, res) => {
    try {
        const { paymentMethodId, tierId } = req.body;
        const userId = req.user.id;

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get membership tier
        const tier = await MembershipTier.findById(tierId);
        if (!tier) {
            return res.status(404).json({ error: 'Membership tier not found' });
        }

        // Handle free membership
        if (tier.price === 0) {
            const membership = new Membership({
                userId,
                membershipTierId: tierId,
                status: 'Active',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            });

            await membership.save();
            return res.status(200).json({ membership });
        }

        // Handle paid membership
        let stripeCustomerId = user.stripeCustomerId;
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                invoice_settings: {
                    default_payment_method: null,
                    email: user.email,
                    email_receipts: true  // This ensures receipt emails
                }
            });
            stripeCustomerId = customer.id;
            user.stripeCustomerId = stripeCustomerId;
            await user.save();
        }

        // Create Stripe subscription
        const subscription = await createStripeSubscription(
            stripeCustomerId,
            tier.stripePriceId,
            paymentMethodId,
            user.email
        );

        // Create membership record
        const membership = new Membership({
            userId,
            membershipTierId: tierId,
            stripeCustomerId,
            stripeSubscriptionId: subscription.id,
            startDate: new Date(),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            status: subscription.status === 'active' ? 'Active' : 'Unpaid',
            lastPaymentStatus: subscription.status,
            lastPaymentDate: new Date(),
        });

        await membership.save();

        // Send welcome email with receipt for new subscriptions
        if (tier.price > 0) {
            const mailOptions = {
                from: process.env.EMAIL,
                to: user.email,
                subject: 'Welcome to Premium Membership!',
                text: `Dear ${user.firstName},\n\nThank you for subscribing to our premium membership! 
                Your payment has been processed successfully.\n\n
                Membership Details:\n
                - Tier: ${tier.name}\n
                - Amount: $${tier.price}\n
                - Billing Period: ${tier.interval}\n
                - Start Date: ${membership.currentPeriodStart.toLocaleDateString()}\n
                - End Date: ${membership.currentPeriodEnd.toLocaleDateString()}\n\n
                You now have access to all premium benefits:\n${tier.benefits.join('\n')}\n\n
                Thank you for your support!\n\n
                Best regards,\nUmmati Community`
            };

            await transporter.sendMail(mailOptions);
        }

        res.status(200).json({
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret,
            membership,
        });
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cancel subscription
router.post('/cancel-subscription', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const membership = await Membership.findOne({ userId, status: 'Active' });

        if (!membership) {
            return res.status(404).json({ error: 'Active membership not found' });
        }

        // Get the free tier
        const freeTier = await MembershipTier.findOne({ price: 0 });
        if (!freeTier) {
            return res.status(500).json({ error: 'Free tier not found' });
        }

        // If it's a paid membership, cancel the Stripe subscription
        if (membership.stripeSubscriptionId) {
            await cancelStripeSubscription(membership.stripeSubscriptionId);
        }

        // Update membership to free tier
        membership.membershipTierId = freeTier._id;
        membership.status = 'Active';
        membership.stripeCustomerId = null;
        membership.stripeSubscriptionId = null;
        membership.currentPeriodStart = new Date();
        membership.currentPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
        membership.cancelAtPeriodEnd = false;
        await membership.save();

        res.status(200).json({ 
            message: 'Subscription cancelled successfully. You have been downgraded to free tier.',
            membership 
        });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update subscription
router.post('/update-subscription', authenticateJWT, async (req, res) => {
    try {
        const { newTierId } = req.body;
        const userId = req.user.id;

        const membership = await Membership.findOne({ userId, status: 'Active' });
        if (!membership) {
            return res.status(404).json({ error: 'Active membership not found' });
        }

        const newTier = await MembershipTier.findById(newTierId);
        if (!newTier) {
            return res.status(404).json({ error: 'New membership tier not found' });
        }

        // Update subscription in Stripe
        const subscription = await updateStripeSubscription(
            membership.stripeSubscriptionId,
            newTier.stripePriceId
        );

        // Update membership record
        membership.membershipTierId = newTierId;
        membership.currentPeriodStart = new Date(subscription.current_period_start * 1000);
        membership.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        await membership.save();

        res.status(200).json({ message: 'Subscription updated successfully', membership });
    } catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ error: error.message });
    }
});

// Confirm subscription payment
router.post('/confirm-subscription', authenticateJWT, async (req, res) => {
    try {
        const { subscriptionId, clientSecret } = req.body;
        const userId = req.user.id;

        // Get the membership
        const membership = await Membership.findOne({ 
            userId, 
            stripeSubscriptionId: subscriptionId 
        });

        if (!membership) {
            return res.status(404).json({ error: 'Membership not found' });
        }

        // Extract payment intent ID from client secret
        const paymentIntentId = clientSecret.split('_secret_')[0];

        // Confirm the payment using the payment intent ID
        const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            // Update membership status
            membership.status = 'Active';
            membership.lastPaymentStatus = 'succeeded';
            membership.lastPaymentDate = new Date();
            await membership.save();

            res.status(200).json({ 
                message: 'Subscription confirmed successfully',
                membership 
            });
        } else {
            res.status(400).json({ 
                error: 'Payment confirmation failed',
                status: paymentIntent.status 
            });
        }
    } catch (error) {
        console.error('Error confirming subscription:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update payment method
router.post('/update-payment-method', authenticateJWT, async (req, res) => {
    try {
        const { newPaymentMethodId } = req.body;
        const userId = req.user.id;

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.stripeCustomerId) {
            return res.status(400).json({ error: 'No Stripe customer found for this user' });
        }

        // Update payment method in Stripe
        await stripe.customers.update(user.stripeCustomerId, {
            invoice_settings: {
                default_payment_method: newPaymentMethodId,
                email: user.email,
                email_receipts: true  // This ensures receipt emails
            },
        });

        res.status(200).json({ 
            message: 'Payment method updated successfully' 
        });
    } catch (error) {
        console.error('Error updating payment method:', error);
        res.status(500).json({ error: error.message });
    }
});

// Process a refund
router.post('/refund', authenticateJWT, async (req, res) => {
    try {
        const { paymentIntentId, amount, reason } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!paymentIntentId || !amount) {
            return res.status(400).json({ error: 'Payment intent ID and amount are required' });
        }

        // Validate refund reason
        const validReasons = ['duplicate', 'fraudulent', 'requested_by_customer'];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ 
                error: 'Invalid reason. Must be one of: duplicate, fraudulent, or requested_by_customer' 
            });
        }

        // Get user's membership
        const membership = await Membership.findOne({ 
            userId,
            'lastPaymentStatus': 'succeeded'
        });

        if (!membership) {
            return res.status(404).json({ error: 'No paid membership found' });
        }

        // Process the refund
        const refund = await processRefund(paymentIntentId, amount, reason);

        // Update membership status
        membership.status = 'Refunded';
        membership.lastPaymentStatus = 'refunded';
        membership.refundedAt = new Date();
        membership.refundReason = reason; // Store the refund reason
        await membership.save();

        // Send refund confirmation email
        const user = await User.findById(userId);
        if (user) {
            const mailOptions = {
                from: process.env.EMAIL,
                to: user.email,
                subject: 'Refund Processed - Membership Cancelled',
                text: `Dear ${user.firstName},\n\n
                Your refund request has been processed successfully.\n\n
                Refund Details:\n
                - Amount: $${(amount / 100).toFixed(2)}\n
                - Date: ${new Date().toLocaleDateString()}\n
                - Reason: ${reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n
                Your membership has been cancelled. You will continue to have access to basic features.\n\n
                If you have any questions, please don't hesitate to contact us.\n\n
                Best regards,\nUmmati Community`
            };

            await transporter.sendMail(mailOptions);
        }

        res.status(200).json({ 
            message: 'Refund processed successfully',
            refund,
            membership
        });
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({ error: error.message });
    }
});

// Webhook handler for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                const subscription = event.data.object;
                const membership = await Membership.findOne({
                    stripeSubscriptionId: subscription.id,
                });

                if (membership) {
                    if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
                        // Get the free tier
                        const freeTier = await MembershipTier.findOne({ price: 0 });
                        if (freeTier) {
                            // Downgrade to free tier
                            membership.membershipTierId = freeTier._id;
                            membership.status = 'Active';
                            membership.stripeCustomerId = null;
                            membership.stripeSubscriptionId = null;
                            membership.currentPeriodStart = new Date();
                            membership.currentPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
                            membership.cancelAtPeriodEnd = false;

                            // Send downgrade notification email
                            const user = await User.findById(membership.userId);
                            if (user) {
                                const mailOptions = {
                                    from: process.env.EMAIL,
                                    to: user.email,
                                    subject: 'Membership Downgraded to Free Tier',
                                    text: `Dear ${user.firstName},\n\nYour membership has been downgraded to the free tier. 
                                    You will continue to have access to basic features.\n\n
                                    If you would like to upgrade again in the future, please visit your account settings.\n\n
                                    Best regards,\nUmmati Community`
                                };

                                await transporter.sendMail(mailOptions);
                            }
                        }
                    } else {
                        membership.status = subscription.status === 'active' ? 'Active' : 'Unpaid';
                        membership.currentPeriodStart = new Date(subscription.current_period_start * 1000);
                        membership.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
                        membership.cancelAtPeriodEnd = subscription.cancel_at_period_end;
                    }
                    await membership.save();
                }
                break;

            case 'invoice.payment_succeeded':
                const invoice = event.data.object;
                const paidMembership = await Membership.findOne({
                    stripeCustomerId: invoice.customer,
                });

                if (paidMembership) {
                    paidMembership.status = 'Active';
                    paidMembership.lastPaymentStatus = 'succeeded';
                    paidMembership.lastPaymentDate = new Date();
                    paidMembership.failedPaymentAttempts = 0; // Reset failed attempts
                    await paidMembership.save();

                    // Send successful payment confirmation email
                    const user = await User.findById(paidMembership.userId);
                    if (user) {
                        const mailOptions = {
                            from: process.env.EMAIL,
                            to: user.email,
                            subject: 'Payment Successful - Membership Renewed',
                            text: `Dear ${user.firstName},\n\nYour membership payment has been processed successfully. 
                            Your premium benefits will continue until ${paidMembership.currentPeriodEnd.toLocaleDateString()}.\n\n
                            Thank you for your continued support!\n\n
                            Best regards,\nUmmati Community`
                        };

                        await transporter.sendMail(mailOptions);
                    }
                }
                break;

            case 'invoice.payment_failed':
                const failedInvoice = event.data.object;
                const failedMembership = await Membership.findOne({
                    stripeCustomerId: failedInvoice.customer,
                });

                if (failedMembership) {
                    // Increment failed payment attempts
                    failedMembership.failedPaymentAttempts = (failedMembership.failedPaymentAttempts || 0) + 1;
                    failedMembership.status = 'Past_Due';
                    failedMembership.lastPaymentStatus = 'failed';
                    failedMembership.lastFailedPaymentDate = new Date();

                    // If this is the first failed payment, set a grace period
                    if (failedMembership.failedPaymentAttempts === 1) {
                        failedMembership.gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days grace period
                    }

                    // If we've exceeded the grace period or had too many failed attempts
                    if (failedMembership.failedPaymentAttempts >= 3 || 
                        (failedMembership.gracePeriodEnd && new Date() > failedMembership.gracePeriodEnd)) {
                        
                        // Get the free tier
                        const freeTier = await MembershipTier.findOne({ price: 0 });
                        if (freeTier) {
                            // Downgrade to free tier
                            failedMembership.membershipTierId = freeTier._id;
                            failedMembership.status = 'Active';
                            failedMembership.stripeCustomerId = null;
                            failedMembership.stripeSubscriptionId = null;
                            failedMembership.currentPeriodStart = new Date();
                            failedMembership.currentPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
                            failedMembership.cancelAtPeriodEnd = false;
                            failedMembership.failedPaymentAttempts = 0;
                            failedMembership.gracePeriodEnd = null;
                        }
                    }

                    await failedMembership.save();

                    // Get user details for notification
                    const user = await User.findOne({ stripeCustomerId: failedInvoice.customer });
                    if (user) {
                        // Send email notification about failed payment
                        const mailOptions = {
                            from: process.env.EMAIL,
                            to: user.email,
                            subject: 'Payment Failed - Action Required',
                            text: `Dear ${user.firstName},\n\nWe were unable to process your membership payment. 
                            You have ${failedMembership.gracePeriodEnd ? 
                                `until ${failedMembership.gracePeriodEnd.toLocaleDateString()} to update your payment method` : 
                                'exceeded the grace period'} before your membership is downgraded to free tier.\n\n
                            Please update your payment method to continue enjoying premium benefits.\n\n
                            Best regards,\nUmmati Community`
                        };

                        await transporter.sendMail(mailOptions);
                    }
                }
                break;
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user's current membership status
router.get('/membership-status', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get user's current membership with tier details
        const membership = await Membership.findOne({ userId, status: 'Active' })
            .populate('membershipTierId');

        if (!membership) {
            return res.status(404).json({ error: 'No active membership found' });
        }

        res.status(200).json({
            membership,
            isPaidMember: membership.membershipTierId.price > 0,
            benefits: membership.membershipTierId.benefits,
            currentPeriodEnd: membership.currentPeriodEnd
        });
    } catch (error) {
        console.error('Error fetching membership status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all membership tiers
router.get('/membership-tiers', async (req, res) => {
    try {
        const tiers = await MembershipTier.find().sort({ price: 1 });
        res.status(200).json(tiers);
    } catch (error) {
        console.error('Error fetching membership tiers:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 