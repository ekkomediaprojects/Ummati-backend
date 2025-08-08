const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create a customer in Stripe
const createStripeCustomer = async (email, name) => {
    try {
        const customer = await stripe.customers.create({
            email,
            name
        });
        return customer;
    } catch (error) {
        console.error('Error creating Stripe customer:', error);
        throw error;
    }
};

// Create a subscription in Stripe
const createStripeSubscription = async (customerId, priceId, paymentMethodId, email) => {
    try {
        // For test payment methods, we need to create a new payment method first
        if (paymentMethodId.startsWith('pm_card_')) {
            // Use Stripe's test token instead of raw card data
            const paymentMethod = await stripe.paymentMethods.create({
                type: 'card',
                card: {
                    token: 'tok_visa', // Use Stripe's test token
                },
                billing_details: {
                    name: 'Test User',
                    email: email,
                },
            });
            paymentMethodId = paymentMethod.id;
        }

        // Attach payment method to customer
        await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
        });

        // Set as default payment method
        await stripe.customers.update(customerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'allow_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent'],
        });

        return subscription;
    } catch (error) {
        console.error('Error creating Stripe subscription:', error);
        throw error;
    }
};

// Gracefully cancel a subscription at end of billing cycle
const cancelStripeSubscription = async (subscriptionId , cancel_at_period_end) => {
    try {
        const subscription = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: cancel_at_period_end
        });
        return subscription;
    } catch (error) {
        console.error('Error setting cancel_at_period_end on Stripe subscription:', error);
        throw error;
    }
};

// Update a subscription in Stripe
const updateStripeSubscription = async (subscriptionId, newPriceId) => {
    try {
        const subscription = await stripe.subscriptions.update(subscriptionId, {
            items: [{
                id: subscriptionId,
                price: newPriceId,
            }],
        });
        return subscription;
    } catch (error) {
        console.error('Error updating Stripe subscription:', error);
        throw error;
    }
};

// Update payment method in Stripe
const updatePaymentMethod = async (customerId, newPaymentMethodId) => {
    try {
        let paymentMethodId = newPaymentMethodId;

        // For test payment methods, we need to create a new payment method first
        if (newPaymentMethodId.startsWith('pm_card_')) {
            // Use Stripe's test token instead of raw card data
            const paymentMethod = await stripe.paymentMethods.create({
                type: 'card',
                card: {
                    token: 'tok_visa', // Use Stripe's test token
                },
                billing_details: {
                    name: 'Test User',
                    email: 'test@example.com',
                },
            });
            paymentMethodId = paymentMethod.id;
        }

        // First, try to attach the payment method
        try {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
            });
        } catch (attachError) {
            // If the payment method is already attached, that's fine
            if (!attachError.message.includes('already attached')) {
                throw attachError;
            }
        }

        // Set as default payment method
        await stripe.customers.update(customerId, {
            invoice_settings: {
                default_payment_method: paymentMethodId,
            },
        });

        return true;
    } catch (error) {
        console.error('Error updating payment method:', error);
        throw error;
    }
};

// Process a refund in Stripe
const processRefund = async (paymentIntentId, amount, reason = null) => {
    try {
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: amount, // Amount in cents
            reason: reason || 'requested_by_customer'
        });
        return refund;
    } catch (error) {
        console.error('Error processing refund:', error);
        throw error;
    }
};

module.exports = {
    stripe,
    createStripeCustomer,
    createStripeSubscription,
    cancelStripeSubscription,
    updateStripeSubscription,
    updatePaymentMethod,
    processRefund,
}; 