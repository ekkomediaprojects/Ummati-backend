const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    membershipTierId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipTier', required: true },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    status: { type: String, enum: ['Active', 'Cancelled', 'Expired'], default: 'Active' },
});

module.exports = mongoose.model('Membership', membershipSchema);
