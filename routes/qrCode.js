const express = require("express");
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
router.get('/verify/:code', async function (req, res) {
    try {
        const { code } = req.params;
        const { captureLocation } = req.query;
        console.log("QR Verification Request:", {
        code,
        captureLocation,
        timestamp: new Date().toISOString(),
        });

        // Serve location capture HTML
        if (captureLocation === "true") {
        console.log("Sending location capture HTML for code:", code);
        const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Ummati Community - Member Verification</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
                    <style>
                    :root {
                        --primary-color: #009688;
                        --secondary-color: #00796B;
                        --accent-color: #26A69A;
                        --bg-light: #F9FAFB;
                        --text-color: #212121;
                        --border-radius: 14px;
                    }

                    * { margin: 0; padding: 0; box-sizing: border-box; }

                    body {
                        font-family: 'Poppins', sans-serif;
                        background: linear-gradient(135deg, #E0F7FA 0%, #F9FAFB 100%);
                        color: var(--text-color);
                        line-height: 1.6;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    }

                    .container {
                        width: 100%;
                        max-width: 600px;
                        background-color: #fff;
                        border-radius: var(--border-radius);
                        box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                        overflow: hidden;
                        animation: fadeIn 0.5s ease-in-out;
                    }

                    .header {
                        background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
                        color: white;
                        text-align: center;
                        padding: 25px 15px;
                    }

                    .header .logo {
                        max-width: 220px;      /* increased from 160px → 220px */
                        margin-bottom: 15px;
                        filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.25));
                        transition: transform 0.3s ease;
                    }

                    .header .logo:hover {
                        transform: scale(1.05); /* subtle hover effect */
                    }
                    .member-card {
                        padding: 30px 25px;
                    }

                    .profile-section {
                        display: flex;
                        align-items: center;
                        justify-content: flex-start;
                        gap: 20px;
                        margin-bottom: 20px;
                        flex-wrap: wrap;
                    }

                    .profile-picture {
                        width: 100px;
                        height: 100px;
                        border-radius: 50%;
                        object-fit: cover;
                        border: 4px solid var(--accent-color);
                        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    }

                    .member-info {
                        flex: 1;
                    }

                    .member-name {
                        font-size: 24px;
                        font-weight: 600;
                        color: var(--text-color);
                    }

                    .membership-tier {
                        font-size: 16px;
                        color: var(--secondary-color);
                        font-weight: 500;
                        margin-top: 4px;
                    }

                    .benefits-section {
                        background: var(--bg-light);
                        border-radius: var(--border-radius);
                        padding: 20px;
                        margin-top: 10px;
                    }

                    .benefits-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: var(--primary-color);
                        margin-bottom: 10px;
                    }

                    .benefits-list {
                        list-style: none;
                        padding-left: 0;
                    }

                    .benefits-list li {
                        padding: 10px 0;
                        border-bottom: 1px solid #eee;
                        color: #444;
                        font-size: 15px;
                    }

                    .benefits-list li:last-child {
                        border-bottom: none;
                    }

                    .status-message {
                        padding: 15px;
                        border-radius: var(--border-radius);
                        text-align: center;
                        font-weight: 500;
                        margin: 15px 25px;
                        display: none;
                    }

                    .success {
                        background-color: #E8F5E9;
                        color: #2E7D32;
                    }

                    .error {
                        background-color: #FFEBEE;
                        color: #C62828;
                    }

                    .loading {
                        text-align: center;
                        padding: 30px;
                        font-size: 16px;
                        color: #666;
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }

                    @media (max-width: 600px) {
                        .profile-section { flex-direction: column; align-items: center; text-align: center; }
                        .member-name { font-size: 20px; }
                        .membership-tier { font-size: 14px; }
                    }
                    </style>

                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <img src="/uploads/Ummati Community-FF-WithoutSlogan-01.png" alt="Ummati Logo" class="logo">
                            <h1>Member Verification</h1>
                        </div>
                        
                        <div id="loading" class="loading">
                            <p>Verifying membership...</p>
                        </div>
                        
                        <div id="error" class="error status-message"></div>
                        <div id="success" class="success status-message"></div>
                        
                        <div id="memberDetails" class="member-card" style="display: none;">
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
                    </div>
                    
                    <script>
                        const code = "${code}";

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
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ location })
                                });

                                const scanResult = await scanResponse.json();

                                if (scanResult.status !== 'success') {
                                    throw new Error(scanResult.message || 'Failed to record scan');
                                }

                                // Get member details
                                const response = await fetch('/qr/verify/' + code);
                                const data = await response.json();

                                document.getElementById('loading').style.display = 'none';

                                if (data.status === 'success' && data.user) {
                                    const user = data.user;
                                    console.log("User details fetched successfully", user);
                                    document.getElementById('profilePicture').src = user?.profilePicture ?? '/uploads/no-profile-picture-15257.png';

                                    document.getElementById('memberName').textContent = user.name || 'Unnamed';
                                    document.getElementById('membershipTier').textContent =
                                        user?.membershipTier?.name || 'No Tier Assigned';

                                    const benefitsList = document.getElementById('benefitsList');
                                    benefitsList.innerHTML = (user?.membershipTier?.benefits || [])
                                        .map(b => \`<li>\${b}</li>\`)
                                        .join('');

                                    document.getElementById('memberDetails').style.display = 'block';
                                    document.getElementById('success').textContent = 'Member verified successfully';
                                    document.getElementById('success').style.display = 'block';
                                } else {
                                    document.getElementById('error').textContent = 
                                        data.message?.includes('expired') ? 
                                        'QR Code expired. Please scan again.' : 
                                        (data.message || 'Member not found.');
                                    document.getElementById('error').style.display = 'block';
                                }

                            } catch (error) {
                                document.getElementById('loading').style.display = 'none';
                                document.getElementById('error').textContent =
                                    error.message?.includes('expired') ?
                                    'QR Code expired. Please scan again.' :
                                    (error.message || 'Error verifying member.');
                                document.getElementById('error').style.display = 'block';
                            }
                        }
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
router.post("/verify/:code", async function (req, res) {
  try {
    const { code } = req.params;
    const { location } = req.body;

    console.log("Recording scan:", {
      code,
      location,
      timestamp: new Date().toISOString(),
    });

    // Record the scan with location
    const result = await recordScan(code, "Store", null, location);
    console.log("Scan recording result:", result);
    res.json(result);
  } catch (error) {
    console.error("Error recording scan:", error);
    res.status(500).json({
      success: false,
      message: "Error recording scan",
    });
  }
});

module.exports = router;
