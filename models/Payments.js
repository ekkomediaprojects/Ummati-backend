const mongoose = require('mongoose');

const paymentsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    description: { type: String },
    paymentMethod: { type: String },
    status: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Completed' },
});

module.exports = mongoose.model('Payments', paymentsSchema);
