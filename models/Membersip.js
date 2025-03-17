const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    membershipTierId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipTier', required: true },
    stripeCustomerId: { type: String }, // Optional for free memberships
    stripeSubscriptionId: { type: String }, // Optional for free memberships
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    status: { type: String, enum: ['Active', 'Cancelled', 'Expired', 'Past_Due', 'Unpaid', 'Refunded'], default: 'Active' },
    currentPeriodStart: { type: Date }, // Current billing period start
    currentPeriodEnd: { type: Date }, // Current billing period end
    cancelAtPeriodEnd: { type: Boolean, default: false }, // Whether to cancel at period end
    lastPaymentStatus: { type: String }, // Last payment status from Stripe
    lastPaymentDate: { type: Date }, // Last successful payment date
    failedPaymentAttempts: { type: Number, default: 0 }, // Number of failed payment attempts
    lastFailedPaymentDate: { type: Date }, // Date of last failed payment
    gracePeriodEnd: { type: Date }, // End date of grace period for failed payments
    refundedAt: { type: Date }, // Date when the membership was refunded
    refundReason: { 
        type: String, 
        enum: ['duplicate', 'fraudulent', 'requested_by_customer'],
        default: 'requested_by_customer'
    }
});

// Pre-save middleware to handle free memberships
membershipSchema.pre('save', async function(next) {
    if (this.isNew) {
        const MembershipTier = mongoose.model('MembershipTier');
        const tier = await MembershipTier.findById(this.membershipTierId);
        
        if (tier && tier.price === 0) {
            // For free memberships, set some default values
            this.status = 'Active';
            this.currentPeriodStart = new Date();
            this.currentPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
        }
    }
    next();
});

module.exports = mongoose.model('Membership', membershipSchema);
