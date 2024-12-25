const express = require('express');
const User = require('../models/Users');

const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a user by ID
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new user
router.post('/', async (req, res) => {
    console.log("entered api");
    try {
        const { firstName, lastName, email, password, profilePicture, instagram, linkedin } = req.body;
        console.log(req.body);
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }
        const newUser = new User({firstName, lastName, email, password, profilePicture, instagram, linkedin });
        await newUser.save();

        res.status(201).json(newUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a user
router.put('/:id', async (req, res) => {
    try {
        const { name, email, password, profilePicture, instagram, linkedin } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, password, profilePicture, instagram, linkedin, updatedAt: Date.now() },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a user
router.delete('/:id', async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
