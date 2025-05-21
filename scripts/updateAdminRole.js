const mongoose = require('mongoose');
const User = require('../models/Users');
require('dotenv').config();

async function updateAdminRole() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Update user role to admin
        const user = await User.findOneAndUpdate(
            { email: 'team@ummaticommunity.com' },
            { role: 'admin' },
            { new: true }
        );

        if (user) {
            console.log('User role updated successfully');
            console.log('Email:', user.email);
            console.log('Role:', user.role);
        } else {
            console.log('User not found');
        }

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateAdminRole(); 