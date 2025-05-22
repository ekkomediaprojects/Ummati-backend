const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const User = require('../models/Users');
const Event = require('../models/Events');
const Payments = require('../models/Payments');
const Membership = require('../models/Membersip');
const { upload, uploadToS3, eventImageUpload, uploadEventImageToS3 } = require('../middleware/s3');
const mongoose = require('mongoose');
const { stripe } = require('../middleware/stripe');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin privileges required."
            });
        }
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error checking admin status",
            error: error.message
        });
    }
};

// Get dashboard statistics
router.get('/dashboard', authenticateJWT, isAdmin, async (req, res) => {
    try {
        // Get total users
        const totalUsers = await User.countDocuments();
        
        // Get total events
        const totalEvents = await Event.countDocuments();
        
        // Get total revenue
        const revenue = await Payments.aggregate([
            { $match: { status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get recent payments
        const recentPayments = await Payments.find({ status: 'Completed' })
            .sort({ date: -1 })
            .limit(5)
            .populate('userId', 'email firstName lastName');

        // Get upcoming events
        const upcomingEvents = await Event.find({
            start: { $gte: new Date() }
        })
        .sort({ start: 1 })
        .limit(5);

        // Get user registration trend (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const userTrend = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                statistics: {
                    totalUsers,
                    totalEvents,
                    totalRevenue: revenue[0]?.total || 0
                },
                recentPayments,
                upcomingEvents,
                userTrend
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data',
            error: error.message
        });
    }
});

// Get all users with pagination and filtering
router.get('/users', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const query = {};
        
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            data: {
                users: users.map(user => ({
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    profilePicture: user.profilePicture,
                    role: user.role,
                    createdAt: user.createdAt
                })),
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching users",
            error: error.message
        });
    }
});

// Update user role
router.put('/users/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            data: { user }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating user",
            error: error.message
        });
    }
});

// Get payment statistics
router.get('/payments/stats', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const stats = await Payments.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        // Get monthly revenue
        const monthlyRevenue = await Payments.aggregate([
            {
                $match: { status: 'Completed' }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
        ]);

        res.json({
            success: true,
            data: {
                statistics: stats,
                monthlyRevenue
            }
        });
    } catch (error) {
        console.error('Error fetching payment statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payment statistics',
            error: error.message
        });
    }
});

// Get users with active trials
router.get('/users/trials', authenticateJWT, async (req, res) => {
    try {
        const users = await User.find({
            'trialStatus.isActive': true
        }).select('firstName lastName email trialStatus');

        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users with active trials:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cancel a user's trial
router.post('/users/:id/cancel-trial', authenticateJWT, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.trialStatus || !user.trialStatus.isActive) {
            return res.status(400).json({ error: 'User does not have an active trial' });
        }

        // Reset trial status
        user.trialStatus = {
            isActive: false,
            startDate: null,
            endDate: null
        };

        await user.save();

        // Send email notification
        const mailOptions = {
            from: process.env.EMAIL,
            to: user.email,
            subject: 'Your Free Trial Has Been Cancelled',
            text: `Dear ${user.firstName},\n\nYour free trial has been cancelled. 
            You will continue to have access to basic features.\n\n
            If you would like to upgrade to premium in the future, please visit your account settings.\n\n
            Best regards,\nUmmati Community`
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({
            message: 'Trial cancelled successfully',
            trialStatus: user.trialStatus
        });
    } catch (error) {
        console.error('Error cancelling trial:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all subscriptions
router.get('/subscriptions', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const subscriptions = await stripe.subscriptions.list({
            limit: 100,
            expand: ['data.customer'],
        });

        // Map Stripe subscriptions to users
        const subscriptionData = await Promise.all(
            subscriptions.data.map(async (sub) => {
                const user = await User.findOne({ 
                    stripeCustomerId: sub.customer.id 
                }).select('-password');
                return {
                    subscription: sub,
                    user: user
                };
            })
        );

        res.json({
            success: true,
            data: subscriptionData
        });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching subscriptions',
            error: error.message
        });
    }
});

// URL validation function
const isValidUrl = (url) => {
    if (!url) return true; // Allow empty/null values
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
};

// Event Management Routes

// Create a new event
router.post('/events', 
    authenticateJWT, 
    isAdmin, 
    eventImageUpload.single('image'),
    uploadEventImageToS3,
    async (req, res) => {
        try {
            const {
                name,
                description,
                quantity,
                price,
                eventDate,
                eventTypeId,
                locationId,
                cityId,
                externalUrls
            } = req.body;

            // Validate external URLs if provided
            if (externalUrls) {
                const invalidUrls = [];
                if (externalUrls.eventbrite && !isValidUrl(externalUrls.eventbrite)) {
                    invalidUrls.push('eventbrite');
                }
                if (externalUrls.meetup && !isValidUrl(externalUrls.meetup)) {
                    invalidUrls.push('meetup');
                }
                if (externalUrls.zeffy && !isValidUrl(externalUrls.zeffy)) {
                    invalidUrls.push('zeffy');
                }
                if (externalUrls.other && !isValidUrl(externalUrls.other)) {
                    invalidUrls.push('other');
                }

                if (invalidUrls.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid URLs provided for: ${invalidUrls.join(', ')}`
                    });
                }
            }

            // Create new event
            const event = new Event({
                name,
                description,
                quantity,
                price,
                eventDate,
                eventTypeId,
                locationId,
                cityId,
                externalUrls,
                imageUrl: req.file ? req.file.location : null // Add image URL if file was uploaded
            });

            await event.save();

            res.status(201).json({
                success: true,
                data: { event }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Error creating event",
                error: error.message
            });
        }
    }
);

// Get all events with pagination and filtering
router.get('/events', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const total = await Event.countDocuments();
        const events = await Event.find()
            .sort({ start: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: events,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching events",
            error: error.message
        });
    }
});

// Get single event
router.get('/events/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        res.json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching event',
            error: error.message
        });
    }
});

// Update event
router.put('/events/:id', 
    authenticateJWT, 
    isAdmin, 
    eventImageUpload.single('image'),
    uploadEventImageToS3,
    async (req, res) => {
        try {
            const {
                name,
                description,
                quantity,
                price,
                eventDate,
                eventTypeId,
                locationId,
                cityId,
                externalUrls
            } = req.body;

            // Validate external URLs if provided
            if (externalUrls) {
                const invalidUrls = [];
                if (externalUrls.eventbrite && !isValidUrl(externalUrls.eventbrite)) {
                    invalidUrls.push('eventbrite');
                }
                if (externalUrls.meetup && !isValidUrl(externalUrls.meetup)) {
                    invalidUrls.push('meetup');
                }
                if (externalUrls.zeffy && !isValidUrl(externalUrls.zeffy)) {
                    invalidUrls.push('zeffy');
                }
                if (externalUrls.other && !isValidUrl(externalUrls.other)) {
                    invalidUrls.push('other');
                }

                if (invalidUrls.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid URLs provided for: ${invalidUrls.join(', ')}`
                    });
                }
            }

            // Prepare update object
            const updateData = {
                name,
                description,
                quantity,
                price,
                eventDate,
                eventTypeId,
                locationId,
                cityId,
                externalUrls
            };

            // If a new image was uploaded, add it to the update data
            if (req.file) {
                updateData.imageUrl = req.file.location;
            }

            const event = await Event.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true }
            );

            if (!event) {
                return res.status(404).json({
                    success: false,
                    message: "Event not found"
                });
            }

            res.json({
                success: true,
                data: { event }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Error updating event",
                error: error.message
            });
        }
    }
);

// Delete event
router.delete('/events/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found"
            });
        }

        res.json({
            success: true,
            message: "Event deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deleting event",
            error: error.message
        });
    }
});

// 4. Event Locations (using venue from Events model)
router.get('/event-locations', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const total = await Event.countDocuments();
        
        const events = await Event.find()
            .select('venue')
            .sort({ 'venue.name': 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const locations = events.map(event => ({
            id: event._id,
            name: event.venue.name,
            address: event.venue.addressLine1,
            city: event.venue.city,
            state: event.venue.state,
            zipCode: event.venue.postalCode
        }));

        res.json({
            success: true,
            data: locations,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching locations",
            error: error.message
        });
    }
});

// 6. Membership Management
router.get('/memberships', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const total = await Membership.countDocuments();
        const memberships = await Membership.find()
            .populate('userId', 'firstName lastName email')
            .populate('membershipTierId')
            .sort({ startDate: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: memberships,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching memberships",
            error: error.message
        });
    }
});

// Update membership
router.put('/memberships/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { status, currentPeriodEnd } = req.body;
        const membership = await Membership.findByIdAndUpdate(
            req.params.id,
            { status, currentPeriodEnd },
            { new: true }
        ).populate('userId', 'firstName lastName email')
         .populate('membershipTierId');

        if (!membership) {
            return res.status(404).json({
                success: false,
                message: "Membership not found"
            });
        }

        res.json({
            success: true,
            data: { membership }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating membership",
            error: error.message
        });
    }
});

// 7. File Upload
router.post('/upload', authenticateJWT, isAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded"
            });
        }

        res.json({
            success: true,
            data: {
                fileUrl: req.file.location
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error uploading file",
            error: error.message
        });
    }
});

// 1. Authentication & Admin Verification
router.get('/auth/check-admin', authenticateJWT, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({
            success: true,
            data: {
                isAdmin: user?.role === 'admin'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error checking admin status",
            error: error.message
        });
    }
});

// 2. User Profile Management
router.get('/user/profile', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({
            success: true,
            data: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                mobile: user.phoneNumber,
                linkedIN: user.linkedin,
                instagram: user.instagram,
                avatar: user.profilePicture
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching profile",
            error: error.message
        });
    }
});

router.put('/user/update-profile', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { firstName, lastName, email, mobile, linkedIN, instagram, avatar } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                firstName,
                lastName,
                email,
                phoneNumber: mobile,
                linkedin: linkedIN,
                instagram,
                profilePicture: avatar
            },
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            message: "Profile updated successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating profile",
            error: error.message
        });
    }
});

// Update admin password
router.put('/user/update-password', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password updated successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating password",
            error: error.message
        });
    }
});

module.exports = router; 