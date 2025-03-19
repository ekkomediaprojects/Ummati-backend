const crypto = require('crypto');
const QRCode = require('../models/QRCode');
const QRScan = require('../models/QRScan');
const User = require('../models/Users');
const Membership = require('../models/Membersip');
const MembershipTier = require('../models/MembershipTier');
const qrcode = require('qrcode');

// Generate a unique QR code
const generateQRCode = async (userId) => {
    try {
        console.log('Generating QR code for userId:', userId);
        // Generate a unique code
        const code = crypto.randomBytes(32).toString('hex');
        console.log('Generated code:', code);
        
        // Set expiration time to 10 minutes from now
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        console.log('Expiration time set to:', expiresAt);
        
        // Create the display URL with location capture
        const displayUrl = `https://api.ummaticommunity.com/qr/verify/${code}?captureLocation=true`;
        console.log('Display URL:', displayUrl);
        
        // Generate QR code as data URL
        const qrCodeDataUrl = await qrcode.toDataURL(displayUrl, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        console.log('Generated QR code data URL');

        // Save QR code details
        const qrCode = new QRCode({
            userId,
            code,
            displayUrl,
            expiresAt
        });
        await qrCode.save();
        console.log('QR code saved to database');

        return {
            code,
            displayUrl,
            qrCodeImage: qrCodeDataUrl,
            expiresAt
        };
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw error;
    }
};

// Get member details from QR code
const getMemberDetails = async (code) => {
    try {
        console.log('getMemberDetails called with code:', code);
        
        // Find the QR code
        const qrCode = await QRCode.findOne({ code, isActive: true });
        console.log('Found QR code:', qrCode ? 'Yes' : 'No');
        
        if (!qrCode) {
            console.log('QR code not found or not active');
            return {
                status: 'invalid',
                message: 'Invalid QR code'
            };
        }
        
        // Check if QR code is expired
        if (qrCode.isExpired()) {
            console.log('QR code is expired');
            qrCode.isActive = false;
            await qrCode.save();
            
            return {
                status: 'expired',
                message: 'QR code has expired'
            };
        }
        
        // Allow fetching member details even if a scan has been recorded
        // Get user details
        console.log('Fetching user details for userId:', qrCode.userId);
        const user = await User.findById(qrCode.userId);
        console.log('User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            console.log('User not found');
            return {
                status: 'invalid',
                message: 'User not found'
            };
        }

        // Get active membership
        console.log('Fetching active membership for user');
        const activeMembership = await Membership.findOne({
            userId: user._id,
            status: 'Active',
            currentPeriodEnd: { $gt: new Date() }
        }).populate('membershipTierId');
        
        console.log('Active membership found:', activeMembership ? 'Yes' : 'No');

        // Get membership tier details
        let membershipTier = null;
        if (activeMembership && activeMembership.membershipTierId) {
            membershipTier = {
                name: activeMembership.membershipTierId.name,
                price: activeMembership.membershipTierId.price,
                benefits: activeMembership.membershipTierId.benefits,
                interval: activeMembership.membershipTierId.interval
            };
            console.log('Membership tier details:', membershipTier);
        }
        
        const result = {
            status: 'success',
            message: 'QR code verified successfully',
            user: {
                name: `${user.firstName} ${user.lastName}`,
                profilePicture: user.profilePicture,
                membershipTier,
                isPaidMember: membershipTier && membershipTier.price > 0
            }
        };
        
        console.log('Returning success result');

        // Mark the QR code as used after fetching member details
        qrCode.isActive = false;
        await qrCode.save();
        console.log('QR code marked as used after fetching member details');

        return result;
    } catch (error) {
        console.error('Error in getMemberDetails:', error);
        throw error;
    }
};

// Record QR code scan
const recordScan = async (code, storeName, scannerId, locationData) => {
    try {
        console.log('recordScan called with:', { code, storeName, scannerId, locationData });
        
        const qrCode = await QRCode.findOne({ code, isActive: true });
        console.log('Found QR code:', qrCode ? 'Yes' : 'No');
        
        if (!qrCode) {
            console.log('QR code not found or not active');
            return {
                status: 'invalid',
                message: 'Invalid QR code'
            };
        }

        // Format location data if provided
        let location = null;
        if (locationData && locationData.latitude && locationData.longitude) {
            location = {
                type: 'Point',
                coordinates: [locationData.longitude, locationData.latitude]
            };
            console.log('Formatted location:', location);
        }

        // Record the scan
        console.log('Creating new scan record');
        const scan = new QRScan({
            qrCodeId: qrCode._id,
            userId: qrCode.userId,
            scannedBy: scannerId || qrCode.userId, // Use QR code owner's ID if no scanner
            storeName: storeName || 'Unknown Location',
            location,
            status: 'success'
        });
        
        await scan.save();
        console.log('Scan record saved');
        
        // Do not mark the QR code as used here
        // qrCode.isActive = false;
        // await qrCode.save();
        // console.log('QR code marked as used');
        
        const result = {
            status: 'success',
            message: 'Scan recorded successfully',
            location: location ? {
                latitude: location.coordinates[1],
                longitude: location.coordinates[0]
            } : null
        };
        
        console.log('Returning success result:', result);
        return result;
    } catch (error) {
        console.error('Error in recordScan:', error);
        throw error;
    }
};

// Clean up expired QR codes
const cleanupExpiredQRCodes = async () => {
    try {
        const expiredQRCodes = await QRCode.find({
            expiresAt: { $lt: new Date() },
            isActive: true
        });
        
        for (const qrCode of expiredQRCodes) {
            qrCode.isActive = false;
            await qrCode.save();
        }
        
        return expiredQRCodes.length;
    } catch (error) {
        console.error('Error cleaning up expired QR codes:', error);
        throw error;
    }
};

module.exports = {
    generateQRCode,
    getMemberDetails,
    recordScan,
    cleanupExpiredQRCodes
}; 