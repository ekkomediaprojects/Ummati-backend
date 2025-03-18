const mongoose = require('mongoose');

const QRScanSchema = new mongoose.Schema({
    qrCodeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'QRCode',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    scannedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: false
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: false
        }
    },
    storeName: {
        type: String,
        required: true
    },
    scannedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['success', 'expired', 'invalid', 'already_used'],
        required: true
    }
});

// Index for geospatial queries
QRScanSchema.index({ location: '2dsphere' });
QRScanSchema.index({ qrCodeId: 1 });
QRScanSchema.index({ userId: 1 });
QRScanSchema.index({ scannedAt: 1 });

module.exports = mongoose.model('QRScan', QRScanSchema); 