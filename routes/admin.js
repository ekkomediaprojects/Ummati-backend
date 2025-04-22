const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const User = require('../models/Users');
const Event = require('../models/Events');
const Payments = require('../models/Payments');
const mongoose = require('mongoose');
const { initializeStripe, stripe } = require('../middleware/stripe');
const nodemailer = require('nodemailer');

// Initialize Stripe
initializeStripe();

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
            .populate('userId', 'email name');

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

        res.json({
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
        const { page = 1, limit = 10, search, role } = req.query;
        
        // Build query
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        if (role) {
            query.role = role;
        }

        // Get total count
        const total = await User.countDocuments(query);

        // Get paginated users
        const users = await User.find(query)
            .select('-password') // Exclude password
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users',
            error: error.message
        });
    }
});

// Update user role
router.put('/users/:id/role', authenticateJWT, isAdmin, async (req, res) => {
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
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user role',
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

// Event Management Routes

// Create a new event
router.post('/events', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { eventId, name, description, start, end, imageUrl, venue } = req.body;

        // Validate required fields
        if (!eventId || !name || !description || !start || !end) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create new event
        const event = new Event({
            eventId,
            name,
            description,
            start,
            end,
            imageUrl,
            venue
        });

        await event.save();

        res.status(201).json({
            success: true,
            data: event
        });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating event',
            error: error.message
        });
    }
});

// Get all events with pagination and filtering
router.get('/events', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 10, search, startDate, endDate } = req.query;
        
        // Build query
        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        if (startDate || endDate) {
            query.start = {};
            if (startDate) query.start.$gte = new Date(startDate);
            if (endDate) query.start.$lte = new Date(endDate);
        }

        // Get total count
        const total = await Event.countDocuments(query);

        // Get paginated events
        const events = await Event.find(query)
            .sort({ start: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: {
                events,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching events',
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
router.put('/events/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { name, description, start, end, imageUrl, venue } = req.body;

        const event = await Event.findByIdAndUpdate(
            req.params.id,
            { name, description, start, end, imageUrl, venue },
            { new: true }
        );

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
        console.error('Error updating event:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating event',
            error: error.message
        });
    }
});

// Delete event
router.delete('/events/:id', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);

        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Event not found'
            });
        }

        res.json({
            success: true,
            message: 'Event deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting event',
            error: error.message
        });
    }
});

module.exports = router; 