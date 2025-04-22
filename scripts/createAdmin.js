require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/Users');

const createAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        // Create admin user
        const adminData = {
            firstName: 'Admin',
            lastName: 'User',
            email: process.env.ADMIN_EMAIL || 'admin@example.com',
            password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10),
            role: 'admin'
        };

        const admin = new User(adminData);
        await admin.save();

        console.log('Admin user created successfully');
        console.log('Email:', adminData.email);
        console.log('Password:', process.env.ADMIN_PASSWORD || 'admin123');
        console.log('Please change the password after first login!');

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
};

createAdmin(); 