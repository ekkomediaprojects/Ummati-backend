const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const User = require('../models/Users');
const Event = require('../models/Events');
const Payments = require('../models/Payments');

// Track page view
router.post('/pageview', async (req, res) => {
    try {
        const { 
            pageUrl, 
            pageTitle, 
            referrer,
            userAgent,
            clientId // Google Analytics client ID
        } = req.body;

        // Here you would typically send this data to your analytics service
        // For now, we'll just log it
        console.log('Page View:', {
            pageUrl,
            pageTitle,
            referrer,
            userAgent,
            clientId,
            timestamp: new Date()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking page view:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Track custom event
router.post('/event', async (req, res) => {
    try {
        const {
            eventName,
            eventCategory,
            eventAction,
            eventLabel,
            eventValue,
            clientId,
            userId // Optional, if user is logged in
        } = req.body;

        // Here you would typically send this data to your analytics service
        console.log('Custom Event:', {
            eventName,
            eventCategory,
            eventAction,
            eventLabel,
            eventValue,
            clientId,
            userId,
            timestamp: new Date()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking custom event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Track conversion (protected route)
router.post('/conversion', authenticateJWT, async (req, res) => {
    try {
        const {
            conversionType, // e.g., 'membership_purchase', 'event_registration'
            value,
            currency = 'USD',
            clientId
        } = req.body;

        const userId = req.user.id;
        const user = await User.findById(userId);

        // Get additional data based on conversion type
        let conversionData = {};
        switch (conversionType) {
            case 'membership_purchase':
                const lastPayment = await Payments.findOne({ 
                    userId, 
                    status: 'Completed' 
                }).sort({ date: -1 });
                
                conversionData = {
                    membershipTier: lastPayment?.description,
                    paymentMethod: lastPayment?.paymentMethod
                };
                break;

            case 'event_registration':
                const eventId = req.body.eventId;
                const event = await Event.findById(eventId);
                conversionData = {
                    eventName: event?.name,
                    eventDate: event?.start
                };
                break;
        }

        // Here you would typically send this data to your analytics service
        console.log('Conversion:', {
            conversionType,
            value,
            currency,
            clientId,
            userId,
            userEmail: user?.email,
            ...conversionData,
            timestamp: new Date()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error tracking conversion:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get analytics configuration
router.get('/config', async (req, res) => {
    try {
        // This endpoint provides necessary configuration for frontend analytics
        const config = {
            metaPixel: {
                pixelId: process.env.META_PIXEL_ID,
                enabled: true
            },
            googleAnalytics: {
                measurementId: process.env.GA_MEASUREMENT_ID,
                enabled: true
            }
        };

        res.json({ success: true, data: config });
    } catch (error) {
        console.error('Error getting analytics config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router; 