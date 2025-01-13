const axios = require('axios');
const Event = require('../models/events');
const express = require('express');
const router = express.Router();

// Webhook endpoint
router.post('/webhook/eventbrite', async (req, res) => {
    const { api_url } = req.body;

    if (!api_url) {
        console.error('Invalid webhook payload: Missing api_url');
        return res.status(400).json({ message: 'Invalid webhook payload' });
    }

    try {
        // Fetch event details from Eventbrite API
        const response = await axios.get(api_url, {
            headers: {
                Authorization: `Bearer ${process.env.EVENTBRITE_API_KEY}`, // Use your Eventbrite API key
            },
        });

        const event = response.data;

        // Log the event data
        console.log('Event received:', event);

        // Check if event already exists in the database
        const existingEvent = await Event.findOne({ eventId: event.id });
        if (existingEvent) {
            console.log(`Event with ID ${event.id} already exists. Skipping creation.`);
            return res.status(200).send('Webhook processed');
        }

        // Save the event to MongoDB
        await Event.create({
            eventId: event.id,
            name: event.name.text || 'Unnamed Event',
            description: event.description?.text || 'No description available',
            start: event.start.utc,
            end: event.end.utc,
            imageUrl: event.logo?.url || null,
            venue: event.venue?.name || 'Online',
        });

        res.status(200).send('Webhook processed');
    } catch (error) {
        console.error('Error processing webhook:', error.message, error.stack);
        res.status(500).send('Error processing webhook');
    }
});

module.exports = router;