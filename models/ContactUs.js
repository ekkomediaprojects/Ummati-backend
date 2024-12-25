const mongoose = require('mongoose');

const contactUsSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    topic: { type: String, required: true },
    message: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['Pending', 'Resolved'], default: 'Pending' },
});

module.exports = mongoose.model('ContactUs', contactUsSchema);
