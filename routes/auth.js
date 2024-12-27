const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/Users'); // Mongoose User model
const nodemailer = require('nodemailer');
const { authenticateJWT } = require('../middleware/auth');
const { upload, uploadToS3 } = require('../middleware/s3'); // Import both upload and uploadToS3
const { blacklistToken } = require('../middleware/blacklist');



const router = express.Router();

// **Register User**
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        // Validate input
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already in use' });
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create user
        const user = await User.create({ firstName, lastName, email, password: hashedPassword });
        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ 
            message: 'User registered successfully', 
            token, 
            user: { id: user._id, firstName, lastName, email } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// **Login User**
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate JWT
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ 
            message: 'Login successful', 
            token, 
            user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// **Forgot Password**
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASSWORD },
        });

        const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL,
            subject: 'Password Reset',
            text: `You requested a password reset. Click the link to reset your password: ${resetUrl}`,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Password reset link sent to email' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// **Reset Password**
router.put('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        // Hash the token and find the user
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpire: { $gt: Date.now() } });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        // Hash new password and update
        user.password = await bcrypt.hash(password, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// **Update Profile**
// router.put('/profile', authenticateJWT, upload.single('profileImage'), async (req, res) => { 
//     try {
//         const { id } = req.user; // Extract user ID from token
//         const { firstName, lastName, email } = req.body; 
//         const imageUrl = req.file ? `https://your-bucket-name.s3.amazonaws.com/${req.file.key}` : null; 

//         const updatedUser = await User.findByIdAndUpdate(
//             id,
//             { firstName, lastName, email, profileImageUrl: imageUrl },
//             { new: true, runValidators: true }
//         );

//         if (!updatedUser) {
//             return res.status(404).json({ message: 'User not found' });
//         }

//         res.status(200).json({ 
//             message: 'Profile updated successfully', 
//             user: updatedUser 
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Server error', error: error.message });
//     }
// });

//       

// **Upload Image to S3 (No Authentication)**
router.post('/upload-image', upload.single('image'), uploadToS3, async (req, res) => {
    try {
        console.log('Request received for /upload-image');

        if (!req.file) {
            console.error('No file uploaded');
            return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log('File uploaded to server memory:', {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
        });

        console.log('File location (set by S3 middleware):', req.file.location);

        // Return the file URL and success message
        res.status(200).json({
            message: 'Image uploaded successfully',
            fileUrl: req.file.location, // S3 URL for the uploaded file
        });
    } catch (error) {
        console.error('Error in /upload-image route:', error);
        res.status(500).json({ message: 'Failed to upload image', error: error.message });
    }
});

// **Upload Profile Picture**
router.put('/profile-picture', authenticateJWT, upload.single('profilePicture'), uploadToS3, async (req, res) => {
    try {
        const { id } = req.user; // Extract user ID from the authenticated JWT

        if (!req.file || !req.file.location) {
            return res.status(400).json({ message: 'No file uploaded or S3 upload failed' });
        }

        const profilePictureUrl = req.file.location;

        // Update the user's profile picture
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { profilePicture: profilePictureUrl },
            { new: true, runValidators: true } // Return updated user, validate changes
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            message: 'Profile picture updated successfully',
            profilePicture: updatedUser.profilePicture,
        });
    } catch (error) {
        console.error('Error updating profile picture:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// **Get User Profile**
router.get('/profile', authenticateJWT, async (req, res) => {
    try {
        const { id } = req.user; // Extract user ID from token
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Logout route
router.post('/logout', authenticateJWT, (req, res) => {
    try {
        // Extract token from the Authorization header
        const token = req.header('Authorization')?.split(' ')[1];
        
        if (!token) {
            return res.status(400).json({ message: 'No token provided' });
        }

        // Blacklist the token
        blacklistToken(token);

        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


module.exports = router;