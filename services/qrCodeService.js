const crypto = require('crypto');
const QRCode = require('../models/QRCode');
const QRScan = require('../models/QRScan');
const User = require('../models/Users');
const Membership = require('../models/Membersip');
const MembershipTier = require('../models/MembershipTier');

// Generate a unique QR code
const generateQRCode = async (userId) => {
    try {
        // Generate a unique code
        const code = crypto.randomBytes(32).toString('hex');
        
        // Set expiration to 10 minutes from now
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        
        // Create display URL - using the API domain directly
        const displayUrl = `${process.env.FRONTEND_URL}/qr/verify/${code}`;
        
        // Create new QR code
        const qrCode = new QRCode({
            userId,
            code,
            displayUrl,
            expiresAt
        });
        
        await qrCode.save();
        return qrCode;
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw error;
    }
};

// Get member details from QR code
const getMemberDetails = async (code) => {
    try {
        // Find the QR code
        const qrCode = await QRCode.findOne({ code, isActive: true });
        
        if (!qrCode) {
            return {
                status: 'invalid',
                message: 'Invalid QR code'
            };
        }
        
        // Check if QR code is expired
        if (qrCode.isExpired()) {
            qrCode.isActive = false;
            await qrCode.save();
            
            return {
                status: 'expired',
                message: 'QR code has expired'
            };
        }
        
        // Check if QR code has already been used
        const existingScan = await QRScan.findOne({ qrCodeId: qrCode._id });
        if (existingScan) {
            return {
                status: 'already_used',
                message: 'QR code has already been used'
            };
        }
        
        // Get user details
        const user = await User.findById(qrCode.userId);
        if (!user) {
            return {
                status: 'invalid',
                message: 'User not found'
            };
        }

        // Get active membership
        const activeMembership = await Membership.findOne({
            userId: user._id,
            status: 'Active',
            currentPeriodEnd: { $gt: new Date() }
        }).populate('membershipTierId');

        // Get membership tier details
        let membershipTier = null;
        if (activeMembership && activeMembership.membershipTierId) {
            membershipTier = {
                name: activeMembership.membershipTierId.name,
                price: activeMembership.membershipTierId.price,
                benefits: activeMembership.membershipTierId.benefits,
                interval: activeMembership.membershipTierId.interval
            };
        }
        
        return {
            status: 'success',
            message: 'QR code verified successfully',
            user: {
                name: `${user.firstName} ${user.lastName}`,
                profilePicture: user.profilePicture,
                membershipTier,
                isPaidMember: membershipTier && membershipTier.price > 0
            }
        };
    } catch (error) {
        console.error('Error verifying QR code:', error);
        throw error;
    }
};

// Record QR code scan
const recordScan = async (code, storeName, scannerId) => {
    try {
        const qrCode = await QRCode.findOne({ code, isActive: true });
        if (!qrCode) {
            return {
                status: 'invalid',
                message: 'Invalid QR code'
            };
        }

        // Record the scan
        const scan = new QRScan({
            qrCodeId: qrCode._id,
            userId: qrCode.userId,
            scannedBy: scannerId,
            storeName,
            status: 'success'
        });
        
        await scan.save();
        
        // Deactivate the QR code
        qrCode.isActive = false;
        await qrCode.save();
        
        return {
            status: 'success',
            message: 'Scan recorded successfully'
        };
    } catch (error) {
        console.error('Error recording scan:', error);
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