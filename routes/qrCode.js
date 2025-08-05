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
                    <title>Ummati Community - Member Verification</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
                    <style>
                        :root {
                            --primary-color: #4CAF50;
                            --secondary-color: #2E7D32;
                            --text-color: #333;
                            --light-gray: #f5f5f5;
                            --border-radius: 12px;
                        }
                        
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        
                        body {
                            font-family: 'Poppins', sans-serif;
                            background-color: var(--light-gray);
                            color: var(--text-color);
                            line-height: 1.6;
                        }
                        
                        .container {
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        
                        .header {
                            background-color: white;
                            padding: 20px;
                            text-align: center;
                            border-radius: var(--border-radius);
                            margin-bottom: 20px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        
                        .logo {
                            max-width: 200px;
                            margin-bottom: 10px;
                        }
                        
                        .verification-status {
                            text-align: center;
                            margin: 20px 0;
                        }
                        
                        .member-card {
                            background: white;
                            border-radius: var(--border-radius);
                            padding: 30px;
                            margin: 20px 0;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        
                        .profile-section {
                            display: flex;
                            align-items: center;
                            margin-bottom: 20px;
                        }
                        
                        .profile-picture {
                            width: 100px;
                            height: 100px;
                            border-radius: 50%;
                            object-fit: cover;
                            margin-right: 20px;
                            border: 3px solid var(--primary-color);
                        }
                        
                        .member-info {
                            flex: 1;
                        }
                        
                        .member-name {
                            font-size: 24px;
                            font-weight: 600;
                            color: var(--text-color);
                            margin-bottom: 5px;
                        }
                        
                        .membership-tier {
                            color: var(--primary-color);
                            font-weight: 500;
                            margin-bottom: 10px;
                        }
                        
                        .benefits-section {
                            margin-top: 20px;
                        }
                        
                        .benefits-title {
                            font-size: 18px;
                            font-weight: 500;
                            margin-bottom: 15px;
                            color: var(--secondary-color);
                        }
                        
                        .benefits-list {
                            list-style: none;
                        }
                        
                        .benefits-list li {
                            padding: 10px 0;
                            border-bottom: 1px solid var(--light-gray);
                        }
                        
                        .benefits-list li:last-child {
                            border-bottom: none;
                        }
                        
                        .status-message {
                            padding: 15px;
                            border-radius: var(--border-radius);
                            margin: 20px 0;
                            text-align: center;
                        }
                        
                        .success {
                            background-color: #E8F5E9;
                            color: var(--secondary-color);
                        }
                        
                        .error {
                            background-color: #FFEBEE;
                            color: #C62828;
                        }
                        
                        .loading {
                            text-align: center;
                            padding: 20px;
                        }
                        
                        .debug {
                            display: none;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <img src="https://api.ummaticommunity.com/images/ummati-logo.png" alt="Ummati Logo" class="logo">
                            <h1>Member Verification</h1>
                        </div>
                        
                        <div id="loading" class="loading">
                            <p>Verifying membership...</p>
                        </div>
                        
                        <div id="error" class="error status-message"></div>
                        <div id="success" class="success status-message"></div>
                        
                        <div id="memberDetails" class="member-card">
                            <div class="profile-section">
                                <img id="profilePicture" class="profile-picture" src="" alt="Profile Picture">
                                <div class="member-info">
                                    <h2 id="memberName" class="member-name"></h2>
                                    <div id="membershipTier" class="membership-tier"></div>
                                </div>
                            </div>
                            
                            <div class="benefits-section">
                                <h3 class="benefits-title">Membership Benefits</h3>
                                <ul id="benefitsList" class="benefits-list"></ul>
                            </div>
                        </div>
                        
                        <div id="debug" class="debug"></div>
                    </div>
                    
                    <script>
                        const code = "${code}";
                        const debugDiv = document.getElementById('debug');
                        
                        function log(message) {
                            console.log(message);
                            const p = document.createElement('p');
                            p.textContent = new Date().toISOString() + ': ' + message;
                            debugDiv.appendChild(p);
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
                                    const user = data.user || {};
                                    log('user: ' + JSON.stringify(user || null));
                                    // Update profile picture
                                    const profilePicture = document.getElementById('profilePicture');
                                    profilePicture.src = user.profilePicture || 'https://api.ummaticommunity.com/images/default-profile.png';

                                    // Update member name
                                    document.getElementById('memberName').textContent = user.name || 'Unnamed';

                                    // Update membership tier safely
                                    document.getElementById('membershipTier').textContent =
                                        user?.membershipTier?.name || 'No Tier Assigned';

                                    // Update benefits list safely
                                    const benefitsList = document.getElementById('benefitsList');
                                    benefitsList.innerHTML = (user?.membershipTier?.benefits || [])
                                        .map(benefit => \`<li>\${benefit}</li>\`)
                                        .join('');
                                    
                                    // Show success message
                                    document.getElementById('success').textContent = 'Member verified successfully';
                                    document.getElementById('success').style.display = 'block';
                                    
                                    // Hide loading
                                    document.getElementById('loading').style.display = 'none';
                                    
                                    log('Member details displayed successfully');
                                } else {
                                    document.getElementById('error').textContent = data.message;
                                    document.getElementById('error').style.display = 'block';
                                    document.getElementById('loading').style.display = 'none';
                                    log('Error displaying member details: ' + data.message);
                                }
                            } catch (error) {
                                const errorMessage = error.message || 'Error getting location. Please enable location services.';
                                document.getElementById('error').textContent = errorMessage;
                                document.getElementById('error').style.display = 'block';
                                document.getElementById('loading').style.display = 'none';
                                log('Error: ' + errorMessage);
                            }
                        }

                        // Start location capture
                        log('Initializing QR code verification...');
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