const axios = require('axios');
const Event = require('../models/Events');
const express = require('express');
const router = express.Router();
require('dotenv').config();

/**
 * Authorization URL endpoint to start the OAuth flow.
 * Redirects users to Eventbrite's authorization page.
 */
router.get('/oauth/authorize', (req, res) => {
    const redirectUri = encodeURIComponent('https://api.ummaticommunity.com/oauth/callback');
    const authorizationUrl = `https://www.eventbrite.com/oauth/authorize?response_type=code&client_id=${process.env.EVENTBRITE_API_KEY}&redirect_uri=${redirectUri}`;
    res.redirect(authorizationUrl);
});

/**
 * OAuth callback endpoint to exchange the authorization code for an access token.
 */
router.get('/oauth/callback', async (req, res) => {
    const authorizationCode = req.query.code;

    if (!authorizationCode) {
        console.error('Authorization code not provided');
        return res.status(400).send('Authorization code missing');
    }

    try {
        const tokenResponse = await axios.post('https://www.eventbrite.com/oauth/token', null, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            params: {
                grant_type: 'authorization_code',
                client_id: process.env.EVENTBRITE_API_KEY,
                client_secret: process.env.EVENTBRITE_CLIENT_SECRET,
                code: authorizationCode,
                redirect_uri: 'https://api.ummaticommunity.com/oauth/callback',
            },
        });

        const { access_token } = tokenResponse.data;
        console.log('Access token received:', access_token);

        // Save the access token securely (e.g., to your database or environment variables)
        res.status(200).send('Authorization successful');
    } catch (error) {
        console.error('Error exchanging authorization code:', error.message);
        res.status(500).send('Error exchanging authorization code');
    }
});

/**
 * Test endpoint to verify the Eventbrite access token.
 */
router.get('/test', async (req, res) => {
    try {
        const token = process.env.EVENTBRITE_ACCESS_TOKEN;
        if (!token) {
            throw new Error('Access token not configured in environment variables');
        }

        const response = await axios.get('https://www.eventbriteapi.com/v3/users/me/', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        res.status(200).json(response.data);
    } catch (error) {
        console.error('Error testing access token:', error.message);
        res.status(500).send('Error testing access token');
    }
});

/**
 * Webhook endpoint to process Eventbrite events.
 */
router.post('/webhook/eventbrite', async (req, res) => {
    const eventbriteEvent = req.headers['x-eventbrite-event'];
    console.log('Webhook received:', {
        headers: req.headers,
        body: req.body,
    });

    if (eventbriteEvent === 'test') {
        console.log('Test webhook received');
        return res.status(200).send('Test webhook processed');
    }

    const { api_url } = req.body;

    if (!api_url) {
        console.error('Missing api_url in webhook payload:', req.body);
        return res.status(400).json({ message: 'Missing api_url in payload' });
    }

    if (!api_url.startsWith('https://www.eventbriteapi.com')) {
        console.error('Invalid api_url:', api_url);
        return res.status(400).json({ message: 'Invalid api_url in payload' });
    }

    try {
        console.log('Fetching event data from Eventbrite API:', api_url);

        const token = process.env.EVENTBRITE_ACCESS_TOKEN;
        if (!token) {
            throw new Error('Access token not configured in environment variables');
        }

        const response = await axios.get(api_url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const event = response.data;
        console.log('Event data fetched successfully:', event);

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

        console.log(`Event with ID ${event.id} saved successfully.`);
        res.status(200).send('Webhook processed');
    } catch (error) {
        console.error('Error processing webhook:', {
            message: error.message,
            stack: error.stack,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data,
            } : 'No response received',
        });

        res.status(500).send('Error processing webhook');
    }
});

module.exports = router;
