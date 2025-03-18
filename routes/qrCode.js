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
                        .success { color: green; display: none; }
                        .member-details { 
                            max-width: 400px; 
                            margin: 20px auto; 
                            padding: 20px; 
                            border: 1px solid #ddd; 
                            border-radius: 8px;
                            display: none;
                        }
                        .member-name { font-size: 24px; margin-bottom: 10px; }
                        .membership-tier { color: #666; margin-bottom: 15px; }
                        .benefits { text-align: left; margin-top: 15px; }
                        .benefits ul { padding-left: 20px; }
                    </style>
                </head>
                <body>
                    <h2>Verifying QR Code</h2>
                    <div id="loading" class="loading">Getting location...</div>
                    <div id="error" class="error"></div>
                    <div id="success" class="success"></div>
                    <div id="memberDetails" class="member-details"></div>
                    <script>
                        const code = "${code.replace(/"/g, '\\"')}";
                        async function captureLocation() {
                            try {
                                const position = await new Promise((resolve, reject) => {
                                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                                        enableHighAccuracy: true,
                                        timeout: 5000,
                                        maximumAge: 0
                                    });
                                });

                                const location = {
                                    latitude: position.coords.latitude,
                                    longitude: position.coords.longitude
                                };

                                // Record the scan with location
                                const scanResponse = await fetch('/qr/verify/' + code, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ location })
                                });

                                const scanResult = await scanResponse.json();
                                if (scanResult.status !== 'success') {
                                    throw new Error(scanResult.message || 'Failed to record scan');
                                }

                                // Get member details
                                const response = await fetch('/qr/verify/' + code);
                                const data = await response.json();
                                
                                if (data.status === 'success') {
                                    // Display member details
                                    const memberDetails = document.getElementById('memberDetails');
                                    memberDetails.innerHTML = \`
                                        <div class="member-name">\${data.user.name}</div>
                                        <div class="membership-tier">\${data.user.membershipTier.name}</div>
                                        <div class="benefits">
                                            <h3>Benefits:</h3>
                                            <ul>
                                                \${data.user.membershipTier.benefits.map(benefit => \`<li>\${benefit}</li>\`).join('')}
                                            </ul>
                                        </div>
                                    \`;
                                    memberDetails.style.display = 'block';
                                    document.getElementById('success').textContent = 'Scan recorded successfully';
                                    document.getElementById('success').style.display = 'block';
                                } else {
                                    document.getElementById('error').textContent = data.message;
                                    document.getElementById('error').style.display = 'block';
                                }
                            } catch (error) {
                                document.getElementById('error').textContent = error.message || 'Error getting location. Please enable location services.';
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

// Handle location capture POST request
router.post('/verify/:code', async function(req, res) {
    try {
        const { code } = req.params;
        const { location } = req.body;

        // Record the scan with location
        const result = await recordScan(code, 'Store', null, location);
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