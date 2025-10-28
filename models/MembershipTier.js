const mongoose = require('mongoose');

const membershipTierSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    tierId: { type: String, unique: true, required: true },
    stripePriceId: { 
        type: String, 
        required: function() {
            return this.price > 0; // Only required for paid tiers
        },
        unique: true,
        sparse: true, // Allows null values to be unique
        default: null
    },
    stripeProductId: { 
        type: String, 
        required: function() {
            return this.price > 0; // Only required for paid tiers
        },
        unique: true,
        sparse: true, // Allows null values to be unique
        default: null
    },
    benefits: [String],
    interval: { type: String, enum: ['month', 'year'], default: 'month' }, // Billing interval
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MembershipTier', membershipTierSchema);