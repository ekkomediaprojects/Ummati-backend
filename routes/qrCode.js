const express = require('express');
const router = express.Router();
const { generateQRCode, getMemberDetails, recordScan } = require('../services/qrCodeService');
const { authenticateJWT } = require('../middleware/auth');

// Generate QR code for logged-in user
router.post('/generate-qr', authenticateJWT, async function(req, res) {
    try {
        console.log('Generating QR code for user:', req.user.id);
        const qrCode = await generateQRCode(req.user.id);
        console.log('Generated QR code:', qrCode);
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
        
        console.log('QR Verification Request:', {
            code,
            captureLocation,
            timestamp: new Date().toISOString()
        });
        
        // If location capture is requested, return HTML with location capture script
        if (captureLocation === 'true') {
            console.log('Sending location capture HTML for code:', code);
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
                        .debug { 
                            text-align: left; 
                            margin: 20px auto; 
                            padding: 10px; 
                            background: #f5f5f5; 
                            border-radius: 4px;
                            font-family: monospace;
                            display: none;
                        }
                    </style>
                </head>
                <body>
                    <h2>Verifying QR Code</h2>
                    <div id="loading" class="loading">Getting location...</div>
                    <div id="error" class="error"></div>
                    <div id="success" class="success"></div>
                    <div id="memberDetails" class="member-details"></div>
                    <div id="debug" class="debug"></div>
                    <script>
                        const code = "${code.replace(/"/g, '\\"')}";
                        const debugDiv = document.getElementById('debug');
                        
                        function log(message) {
                            console.log(message);
                            const p = document.createElement('p');
                            p.textContent = new Date().toISOString() + ': ' + message;
                            debugDiv.appendChild(p);
                            debugDiv.style.display = 'block';
                        }

                        async function captureLocation() {
                            try {
                                log('Starting location capture...');
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
                                log('Location captured: ' + JSON.stringify(location));

                                // Record the scan with location
                                log('Recording scan with location...');
                                const scanResponse = await fetch('/qr/verify/' + code, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({ location })
                                });

                                const scanResult = await scanResponse.json();
                                log('Scan response: ' + JSON.stringify(scanResult));

                                if (scanResult.status !== 'success') {
                                    throw new Error(scanResult.message || 'Failed to record scan');
                                }

                                // Get member details
                                log('Fetching member details...');
                                const response = await fetch('/qr/verify/' + code);
                                const data = await response.json();
                                log('Member details response: ' + JSON.stringify(data));
                                
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
                                    log('Member details displayed successfully');
                                } else {
                                    document.getElementById('error').textContent = data.message;
                                    document.getElementById('error').style.display = 'block';
                                    log('Error displaying member details: ' + data.message);
                                }
                            } catch (error) {
                                const errorMessage = error.message || 'Error getting location. Please enable location services.';
                                document.getElementById('error').textContent = errorMessage;
                                document.getElementById('error').style.display = 'block';
                                log('Error: ' + errorMessage);
                            }
                        }

                        // Start location capture
                        log('Initializing QR code verification...');
                        document.getElementById('loading').style.display = 'block';
                        captureLocation();
                    </script>
                </body>
                </html>
            `;
            res.send(html);
            return;
        }

        console.log('Fetching member details for code:', code);
        const result = await getMemberDetails(code);
        console.log('Member details result:', result);
        res.json(result);
    } catch (error) {
        console.error('Error in QR verification:', error);
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
        
        console.log('Recording scan:', {
            code,
            location,
            timestamp: new Date().toISOString()
        });

        // Record the scan with location
        const result = await recordScan(code, 'Store', null, location);
        console.log('Scan recording result:', result);
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