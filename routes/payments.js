const express = require('express');
const router = express.Router();
const Payments = require('../models/Payments');
const User = require('../models/Users');
const { stripe } = require('../middleware/stripe');
const { authenticateJWT } = require('../middleware/auth');
const mongoose = require('mongoose');
const _ = require('lodash'); // npm install lodash

router.get('/', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Fetch all local payments for this user
    const localPayments = await Payments.find({ userId }).lean();

    // Create a map of local payments by stripeChargeId
    const localPaymentMap = _.keyBy(localPayments, 'stripeChargeId');

    let stripePayments = [];
    if (user.stripeCustomerId) {
      const stripeCharges = await stripe.charges.list({
        customer: user.stripeCustomerId,
        limit: 100, // or a higher number if needed
      });

      stripePayments = stripeCharges.data.map(charge => {
        const local = localPaymentMap[charge.id];

        return {
            _id: local?._id || null,
            userId: local?.userId || userId,
            amount: charge.amount / 100,
            date: new Date(charge.created * 1000),
            description: charge.description || 'Stripe payment',
            paymentMethod: charge.payment_method_details?.type || 'card',
            status: charge.status === 'succeeded' ? 'Completed' : 'Failed',
            transactionType: local?.transactionType || 'one-time',
            stripeChargeId: charge.id,
            stripeInvoiceId: local?.stripeInvoiceId || null,
            stripeSubscriptionId: local?.stripeSubscriptionId || null,
        };
      });
    }

    // Also include local payments that aren't tied to a Stripe charge
    const unmatchedLocalPayments = localPayments.filter(p => !p.stripeChargeId);

    // Combine all
    const allPayments = [...stripePayments, ...unmatchedLocalPayments];

    // Sort by date descending
    const sorted = allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Paginate
    const paginated = sorted.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        payments: paginated,
        pagination: {
          total: sorted.length,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(sorted.length / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments',
      error: error.message
    });
  }
});

// Get payment statistics
router.get('/stats', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get local payment statistics
        const localStats = await Payments.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        // Get Stripe statistics if user has a Stripe customer ID
        let stripeStats = [];
        if (user.stripeCustomerId) {
            const stripeCharges = await stripe.charges.list({
                customer: user.stripeCustomerId,
                limit: 100
            });

            stripeStats = stripeCharges.data.reduce((acc, charge) => {
                const status = charge.status === 'succeeded' ? 'Completed' : 'Failed';
                const amount = charge.amount / 100;
                
                const existingStat = acc.find(s => s._id === status);
                if (existingStat) {
                    existingStat.count++;
                    existingStat.totalAmount += amount;
                } else {
                    acc.push({ _id: status, count: 1, totalAmount: amount });
                }
                return acc;
            }, []);
        }

        // Combine statistics
        const allStats = [...localStats, ...stripeStats].reduce((acc, curr) => {
            const existingStat = acc.find(s => s._id === curr._id);
            if (existingStat) {
                existingStat.count += curr.count;
                existingStat.totalAmount += curr.totalAmount;
            } else {
                acc.push(curr);
            }
            return acc;
        }, []);

        res.status(200).json({
            success: true,
            data: {
                statistics: allStats
            }
        });
    } catch (error) {
        console.error('Error fetching payment statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payment statistics',
            error: error.message
        });
    }
});

module.exports = router;
