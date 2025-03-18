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
                qrCodeImage: qrCode.qrCodeImage,
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
        const { code } = req.params;
        const { captureLocation } = req.query;
        
        // If location capture is requested, return HTML with location capture script
        if (captureLocation === 'true') {
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Verifying QR Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                        .loading { display: none; }
                        .error { color: red; display: none; }
                    </style>
                </head>
                <body>
                    <h2>Verifying QR Code</h2>
                    <div id="loading" class="loading">Getting location...</div>
                    <div id="error" class="error"></div>
                    <script>
                        async function captureLocation() {
                            try {
                                const position = await new Promise((resolve, reject) => {
                                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                                        enableHighAccuracy: true,
                                        timeout: 5000,
                                        maximumAge: 0
                                    });
                                });

                                // Send location to backend
                                const response = await fetch('/qr/verify/${code}', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        location: {
                                            latitude: position.coords.latitude,
                                            longitude: position.coords.longitude
                                        }
                                    })
                                });

                                const data = await response.json();
                                if (data.status === 'success') {
                                    window.location.href = '/qr/verify/${code}';
                                } else {
                                    document.getElementById('error').textContent = data.message;
                                    document.getElementById('error').style.display = 'block';
                                }
                            } catch (error) {
                                document.getElementById('error').textContent = 'Error getting location. Please enable location services.';
                                document.getElementById('error').style.display = 'block';
                            }
                        }

                        // Start location capture
                        document.getElementById('loading').style.display = 'block';
                        captureLocation();
                    </script>
                </body>
                </html>
            `;
            res.send(html);
            return;
        }

        const result = await getMemberDetails(code);
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
        const { code, storeName, location } = req.body;

        // Validate required fields
        if (!code || !storeName) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate location data if provided
        if (location) {
            if (!location.latitude || !location.longitude) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid location data. Both latitude and longitude are required.'
                });
            }
            if (location.latitude < -90 || location.latitude > 90) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid latitude value'
                });
            }
            if (location.longitude < -180 || location.longitude > 180) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid longitude value'
                });
            }
        }

        const result = await recordScan(code, storeName, req.user.id, location);
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