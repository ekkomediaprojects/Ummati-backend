const axios = require('axios');
const Event = require('../models/Events');
const express = require('express');
const router = express.Router();
require('dotenv').config();

router.get('/test', (req, res) => {
    console.log('Test route hit');
    s = (process.env.EVENTBRITE_API_KEY);
    res.status(200).send(s);
    console.log(process.env.EVENTBRITE_API_KEY);
});

// Webhook endpoint
router.post('/webhook/eventbrite', async (req, res) => {
    const eventbriteEvent = req.headers['x-eventbrite-event']; // Identify the Eventbrite event type
    console.log('Webhook received:', {
        headers: req.headers,
        body: req.body,
    });

    // Log the received Eventbrite event type
    if (eventbriteEvent === 'test') {
        console.log('Test webhook received');
        return res.status(200).send('Test webhook processed');
    }

    const { api_url } = req.body;

    // Validate the incoming payload
    if (!api_url) {
        console.error('Missing api_url in webhook payload:', req.body);
        return res.status(400).json({ message: 'Missing api_url in payload' });
    }

    if (!api_url.startsWith('https://www.eventbriteapi.com')) {
        console.error('Invalid api_url:', api_url);
        return res.status(400).json({ message: 'Invalid api_url in payload' });
    }

    try {
        // Fetch event details from Eventbrite API
        console.log('Fetching event data from Eventbrite API:', api_url);
        const response = await axios.get(api_url, {
            headers: {
                Authorization: `Bearer ${process.env.EVENTBRITE_ACCESS_TOKEN}`,
            },
        });

        const event = response.data;
        console.log('Event data fetched successfully:', event);

        // Check if event already exists in the database
        console.log(`Checking if event with ID ${event.id} exists in the database.`);
        const existingEvent = await Event.findOne({ eventId: event.id });
        if (existingEvent) {
            console.log(`Event with ID ${event.id} already exists. Skipping creation.`);
            return res.status(200).send('Webhook processed');
        }

        // Save the event to MongoDB
        console.log(`Saving event with ID ${event.id} to the database.`);
        await Event.create({
            eventId: event.id,
            name: event.name.text || 'Unnamed Event',
            description: event.description?.text || 'No description available',
            start: event.start.utc,
            end: event.end.utc,
            imageUrl: event.logo?.url || null,
            venue: event.venue?.name || 'Online',
        });

        console.log(`Event with ID ${event.id} saved successfully.`);
        res.status(200).send('Webhook processed');
    } catch (error) {
        // Log error details
        console.error('Error processing webhook:', {
            message: error.message,
            stack: error.stack,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers,
            } : 'No response received',
        });

        res.status(500).send('Error processing webhook');
    }
});

module.exports = router;
