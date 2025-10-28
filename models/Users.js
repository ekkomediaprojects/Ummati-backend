const mongoose = require('mongoose');
const crypto = require('crypto');

const usersSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Hashed, not required for Google users
    googleId: { type: String, unique: true, sparse: true }, // Added Google ID field
    profilePicture: { type: String, default: null },
    instagram: { type: String, default: null },
    linkedin: { type: String, default: null },
    streetAddress: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    postalCode: { type: String, default: null },
    phoneNumber: { type: String, default: null },
    stripeCustomerId: { type: String, unique: true, sparse: true }, // Stripe Customer ID
    stripeSubscriptionId: { type: String, unique: true, sparse: true }, // Stripe Subscription ID
    membershipTier: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'MembershipTier',
        default: '67d7a9c6c228032e59fce83c' // Default to Free Member tier
    },
    memberId: { type: String, required: true, unique: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// Pre-save hook to auto-generate memberId & assign Free tier
usersSchema.pre('validate', async function (next) {
    try {
        if (!this.memberId) {
            const initials = (this.firstName[0] + this.lastName[0]).toUpperCase();
            const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
            this.memberId = `UCMB-${initials}-${randomPart}`;
        }
    } catch (err) {
        console.error('User pre-validate error:', err);
    }
    next();
});

module.exports = mongoose.model('Users', usersSchema);