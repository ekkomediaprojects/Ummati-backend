require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
//const helmet = require('helmet');
const { initializeStripeServices } = require('./services/stripeMembershipService');
const { cleanupExpiredQRCodes } = require('./services/qrCodeService');

// Initialize Express
const app = express();

// Middleware
//app.use(helmet()); // Adds security headers
app.use(cors()); // Enables CORS

// Import Routes
const userRoutes = require('./routes/users.js');
const authRoutes = require('./routes/auth.js');
const contactUs = require('./routes/contactUs.js');
const emailSubscribers = require('./routes/emailSubscribers.js');
const eventbrite = require('./routes/eventbrite.js');
const events = require('./routes/events.js');
const stripeRoutes = require('./routes/stripe.js');
const qrCodeRoutes = require('./routes/qrCode');

// Use Routes
app.use('/stripe', stripeRoutes); // Stripe routes first (needs raw body)
app.use(express.json()); // JSON parsing for other routes
app.use('/users', userRoutes);
app.use('/auth', authRoutes);
app.use('/contactUs', contactUs);
app.use('/emailSubscribers', emailSubscribers);
app.use('/eventbrite', eventbrite);
app.use('/events', events);
app.use('/qr', qrCodeRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('MongoDB Connected');
        // Initialize Stripe services
        await initializeStripeServices();
        
        // Set up cleanup job for expired QR codes (runs every 5 minutes)
        setInterval(async () => {
            try {
                const cleanedCount = await cleanupExpiredQRCodes();
                console.log(`Cleaned up ${cleanedCount} expired QR codes`);
            } catch (error) {
                console.error('Error cleaning up expired QR codes:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes
    })
    .catch((error) => console.error('Database connection error:', error));

// Default Route
app.get('/', (req, res) => {
    res.send('Welcome to the Ummati Backend!');
});

// Catch-All Route
app.all('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start Server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
