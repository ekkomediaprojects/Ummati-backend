require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
app.use(express.json());

//import Routes
const userRoutes = require('./routes/users.js');

// Use Routes
app.use('/users', userRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI) 
    .then(() => console.log('MongoDB Connected'))
    .catch((error) => console.error('Database connection error:', error));

// Start Server
const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Sample route
app.get('/', (req, res) => {
    res.send('WElcome to the Ummatti Backend!');
});

// Catch-all handler for any requests not handled by other routes
app.get('*', (req, res) => {
    // If you're serving an SPA, ensure this path is correct or comment out if no frontend is available.
    res.status(404).send('Page not found');
});