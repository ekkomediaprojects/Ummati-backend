const mongoose = require('mongoose');

const emailSubscribersSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    subscribedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('EmailSubscribers', emailSubscribersSchema);
