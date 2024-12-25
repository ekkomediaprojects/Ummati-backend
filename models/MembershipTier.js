const mongoose = require('mongoose');

const membershipTierSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    benefits: [String],
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MembershipTier', membershipTierSchema);
