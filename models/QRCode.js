const mongoose = require('mongoose');

const QRCodeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    code: {
        type: String,
        required: true,
        unique: true
    },
    displayUrl: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
QRCodeSchema.index({ code: 1 });
QRCodeSchema.index({ expiresAt: 1 });
QRCodeSchema.index({ userId: 1 });

// Method to check if QR code is expired
QRCodeSchema.methods.isExpired = function() {
    return Date.now() >= this.expiresAt;
};

module.exports = mongoose.model('QRCode', QRCodeSchema); 