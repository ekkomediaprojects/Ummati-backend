const express = require('express');
const router = express.Router();
const { generateQRCode, getMemberDetails, recordScan } = require('../services/qrCodeService');
const { authenticateJWT } = require('../middleware/auth');

// Generate QR code for logged-in user
router.post('/generate-qr', authenticateJWT, async function(req, res) {
    try {
        const qrCode = await generateQRCode(req.user.id);
        res.json({
            success: true,
            data: {
                code: qrCode.code,
                displayUrl: qrCode.displayUrl,
                expiresAt: qrCode.expiresAt
            }
        });
    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating QR code'
        });
    }
});

// Get member details from QR code (no auth required)
router.get('/verify/:code', async function(req, res) {
    try {
        const result = await getMemberDetails(req.params.code);
        res.json(result);
    } catch (error) {
        console.error('Error getting member details:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting member details'
        });
    }
});

// Record QR code scan (requires auth for cashiers)
router.post('/verify-qr', authenticateJWT, async function(req, res) {
    try {
        const { code, storeName } = req.body;

        // Validate required fields
        if (!code || !storeName) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const result = await recordScan(code, storeName, req.user.id);
        res.json(result);
    } catch (error) {
        console.error('Error recording scan:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording scan'
        });
    }
});

module.exports = router; 