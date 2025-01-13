const axios = require('axios');
const Event = require('../models/Events');
const express = require('express');
const router = express.Router();

router.get('/test', (req, res) => {
    console.log('Test route hit');
    res.status(200).send('Test route is working!');
});

// Webhook endpoint
router.post('/webhook/eventbrite', async (req, res) => {
    const eventbriteEvent = req.headers['x-eventbrite-event']; // Identify the Eventbrite event type
    console.log('Webhook received:', req.body);

    if (eventbriteEvent === 'test') {
        console.log('Test webhook received');
        return res.status(200).send('Test webhook processed');
    }

    const { api_url } = req.body;

    if (!api_url || !api_url.startsWith('https://www.eventbriteapi.com')) {
        console.error('Invalid or missing api_url in payload');
        return res.status(400).json({ message: 'Invalid api_url' });
    }

    try {
        // Fetch event details from Eventbrite API
        const response = await axios.get(api_url, {
            headers: {
                Authorization: `Bearer ${process.env.EVENTBRITE_API_KEY}`,
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