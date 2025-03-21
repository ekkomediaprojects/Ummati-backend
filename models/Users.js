const mongoose = require('mongoose');

const usersSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Hashed
    profilePicture: { type: String, default: null },
    instagram: { type: String, default: null },
    linkedin: { type: String, default: null },
    streetAddress: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    postalCode: { type: String, default: null },
    phoneNumber: { type: String, default: null },
    stripeCustomerId: { type: String, unique: true, sparse: true }, // Stripe Customer ID
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Users', usersSchema);