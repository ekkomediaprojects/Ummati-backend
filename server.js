require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

//const helmet = require('helmet');
const { initializeStripeServices } = require('./services/stripeMembershipService');
const { cleanupExpiredQRCodes } = require('./services/qrCodeService');
const bodyParser = require('body-parser');


// Import Routes
const userRoutes = require('./routes/users.js');
const authRoutes = require('./routes/auth.js');
const contactUs = require('./routes/contactUs.js');
const emailSubscribers = require('./routes/emailSubscribers.js');
const eventbrite = require('./routes/eventbrite.js');
const events = require('./routes/events.js');
const stripeRoutes = require('./routes/stripe.js');
const qrCodeRoutes = require('./routes/qrCode');
const paymentRoutes = require('./routes/payments');
const adminRoutes = require('./routes/admin.js');

// Initialize Express
const app = express();

// Middleware
//app.use(helmet()); // Adds security headers
app.use(cors()); // Enables CORS
app.use(express.urlencoded({ extended: true }));
app.use('/stripe/webhook', bodyParser.raw({ type: 'application/json' }));
app.use(express.json()); // JSON parsing for all routes

// Public access for images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Use Routes
app.use('/stripe', stripeRoutes); // Stripe routes first (needs raw body)
app.use('/users', userRoutes);
app.use('/auth', authRoutes);
app.use('/contactUs', contactUs);
app.use('/emailSubscribers', emailSubscribers);
app.use('/eventbrite', eventbrite);
app.use('/events', events);
app.use('/qr', qrCodeRoutes);
app.use('/payments', paymentRoutes);
app.use('/admin', adminRoutes);

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

// change on every deployment from package.json
app.get('/deployment', (req, res) => {
    res.send(`Deployment Version:  1.2.0`);
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
