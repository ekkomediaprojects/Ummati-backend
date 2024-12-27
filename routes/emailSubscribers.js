require('dotenv').config(); // Load environment variables
const express = require('express');
const EmailSubscribers = require('../models/EmailSubscribers'); // Import your model
const router = express.Router();

// POST route to handle email subscriptions
router.post('/subscribe', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        const existingSubscriber = await EmailSubscribers.findOne({ email });
        if (existingSubscriber) {
            return res.status(400).json({ error: 'Email is already subscribed.' });
        }

        const newSubscriber = new EmailSubscribers({ email });
        await newSubscriber.save();

        res.status(201).json({ message: 'Thank you for subscribing!' });
    } catch (error) {
        console.error('Error subscribing:', error);
        res.status(500).json({ error: 'Something went wrong. Please try again later.' });
    }
});

// GET route to retrieve all email subscribers
router.get('/', async (req, res) => {
    try {
        console.log('Fetching all email subscribers...');
        const subscribers = await EmailSubscribers.find().sort({ subscribedAt: -1 }); // Sort by most recent
        console.log('Subscribers fetched:', subscribers);

        res.status(200).json(subscribers);
    } catch (error) {
        console.error('Error fetching subscribers:', error);
        res.status(500).json({ error: 'Something went wrong. Please try again later.' });
    }
});

module.exports = router;
