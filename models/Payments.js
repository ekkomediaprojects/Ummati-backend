const mongoose = require('mongoose');

const paymentsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    description: { type: String },
    paymentMethod: { type: String },
    status: { 
        type: String, 
        enum: ['Pending', 'Completed', 'Failed', 'Refunded', 'Disputed', 'Cancelled', 'Updated'], 
        default: 'Completed' 
    },
    transactionType: { 
        type: String, 
        enum: ['one-time', 'subscription', 'refund', 'dispute'],
        required: true
    },
    stripeChargeId: { type: String, sparse: true },
    stripeInvoiceId: { type: String, sparse: true },
    stripeSubscriptionId: { type: String, sparse: true }
});

module.exports = mongoose.model('Payments', paymentsSchema);
