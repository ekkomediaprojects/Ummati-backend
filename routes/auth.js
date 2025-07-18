const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/Users'); // Mongoose User model
const Membership = require('../models/Membersip');
const MembershipTier = require('../models/MembershipTier');
const nodemailer = require('nodemailer');
const { authenticateJWT } = require('../middleware/auth');
const { upload, uploadToS3 } = require('../middleware/s3'); // Import both upload and uploadToS3
const { blacklistToken } = require('../middleware/blacklist');
const s3 = require('../middleware/s3'); // Import s3 module

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

        // Get the free membership tier
        const freeTier = await MembershipTier.findOne({ price: 0 });
        if (!freeTier) {
            console.error('Free membership tier not found');
            return res.status(500).json({ message: 'Error creating free membership' });
        }

        // Create free membership for the user
        const membership = new Membership({
            userId: user._id,
            membershipTierId: freeTier._id,
            status: 'Active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        });

        await membership.save();

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ 
            message: 'User registered successfully', 
            token, 
            user: { id: user._id, firstName, lastName, email } 
        });
    } catch (error) {
        console.error('Registration error:', error);
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

        // Include profile picture and role in the response
        res.status(200).json({ 
            message: 'Login successful', 
            token, 
            user: { 
                id: user._id, 
                firstName: user.firstName, 
                lastName: user.lastName, 
                email: user.email, 
                profilePicture: user.profilePicture || null,
                role: user.role || 'user'
            } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// **Forgot Password**
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Check if email is provided
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if user signed up with Google
        if (user.googleId) {
            return res.status(400).json({ 
                message: 'This account was created using Google. Please use Google\'s password reset functionality.',
                isGoogleUser: true
            });
        }

        // Check if user has a password (should always be true for non-Google users)
        if (!user.password) {
            return res.status(400).json({ 
                message: 'This account does not have a password set. Please contact support.',
                isGoogleUser: false
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
        await user.save();

        // Configure transporter
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASS,
            },
        });

        const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;
        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL,
            subject: 'Password Reset',
            text: `You requested a password reset. Click the link to reset your password: ${resetUrl}`,
        };

        // Send email
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Password reset link sent to email' });
    } catch (error) {
        console.error('Error in forgot-password route:', error);
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
    console.log('=== PROFILE PICTURE ROUTE HANDLER START ===');
    console.log('Request details:', {
        user: req.user,
        file: req.file,
        headers: req.headers,
        body: req.body
    });

    try {
        console.log('Extracting user ID from request...');
        const { id } = req.user;
        console.log('User ID:', id);

        console.log('Checking if file exists...');
        if (!req.file) {
            console.log('No file found in request');
            return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log('Checking if file location exists...');
        if (!req.file.location) {
            console.error('S3 upload failed - no location returned');
            return res.status(500).json({ message: 'Failed to upload image to S3' });
        }

        const profilePictureUrl = req.file.location;
        console.log('Profile picture URL:', profilePictureUrl);

        console.log('Updating user in database...');
        // Update the user's profile picture
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { profilePicture: profilePictureUrl },
            { new: true, runValidators: true }
        );

        console.log('Database update result:', updatedUser ? 'Success' : 'Failed');
        if (!updatedUser) {
            console.error('User not found in database:', id);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('Profile picture update successful:', {
            userId: id,
            profilePicture: updatedUser.profilePicture
        });

        console.log('=== PROFILE PICTURE ROUTE HANDLER END ===');
        res.status(200).json({
            message: 'Profile picture updated successfully',
            profilePicture: updatedUser.profilePicture,
        });
    } catch (error) {
        console.error('Error in profile picture route:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message,
            details: error.stack
        });
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

// **Google Login**
router.post('/google-login', async (req, res) => {
    try {
        const { email, googleId } = req.body;

        // Validate input
        if (!email || !googleId) {
            return res.status(400).json({ message: 'Email and Google ID are required' });
        }

        // Find user by Google ID
        let user = await User.findOne({ googleId });
        
        // If user not found by Google ID, check by email
        if (!user) {
            user = await User.findOne({ email });
            if (user) {
                // Link Google ID to existing account
                user.googleId = googleId;
                await user.save();
            } else {
                return res.status(401).json({ message: 'Please sign up first' });
            }
        }

        // Generate JWT
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ 
            message: 'Login successful', 
            token, 
            user: { 
                id: user._id, 
                firstName: user.firstName, 
                lastName: user.lastName, 
                email: user.email, 
                profilePicture: user.profilePicture || null
            } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// **Google Sign Up**
router.post('/google-signup', async (req, res) => {
    try {
        const { email, firstName, lastName, googleId, profilePicture } = req.body;

        // Validate input
        if (!email || !firstName || !lastName || !googleId) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        // Create user with Google info
        const user = await User.create({ 
            firstName, 
            lastName, 
            email, 
            googleId,
            profilePicture // Store the Google profile picture URL
        });

        // Get the free membership tier
        const freeTier = await MembershipTier.findOne({ price: 0 });
        if (!freeTier) {
            console.error('Free membership tier not found');
            return res.status(500).json({ message: 'Error creating free membership' });
        }

        // Create free membership for the user
        const membership = new Membership({
            userId: user._id,
            membershipTierId: freeTier._id,
            status: 'Active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        });

        await membership.save();

        // Generate JWT token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        res.status(201).json({ 
            message: 'User registered successfully with Google', 
            token, 
            user: { 
                id: user._id, 
                firstName, 
                lastName, 
                email,
                profilePicture: user.profilePicture // Include profile picture in response
            } 
        });
    } catch (error) {
        console.error('Google signup error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// **Update User Profile**
router.put('/update-profile', authenticateJWT, async (req, res) => {
    console.log('=== UPDATE PROFILE ROUTE START ===');
    console.log('Request details:', {
        user: req.user,
        body: req.body
    });

    try {
        const { id } = req.user;
        const {
            firstName,
            lastName,
            phoneNumber,
            instagram,
            linkedin,
            streetAddress,
            city,
            state,
            postalCode
        } = req.body;

        console.log('Building update object...');
        const updateFields = {};
        
        // Add fields to update if they are provided
        if (firstName) updateFields.firstName = firstName;
        if (lastName) updateFields.lastName = lastName;
        if (phoneNumber) updateFields.phoneNumber = phoneNumber;
        if (instagram) updateFields.instagram = instagram;
        if (linkedin) updateFields.linkedin = linkedin;
        if (streetAddress) updateFields.streetAddress = streetAddress;
        if (city) updateFields.city = city;
        if (state) updateFields.state = state;
        if (postalCode) updateFields.postalCode = postalCode;

        console.log('Update fields:', updateFields);

        // Check if there are any fields to update
        if (Object.keys(updateFields).length === 0) {
            console.log('No fields to update');
            return res.status(400).json({ message: 'No fields provided for update' });
        }

        console.log('Updating user in database...');
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            console.log('User not found:', id);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('Profile updated successfully:', {
            userId: id,
            updatedFields: Object.keys(updateFields)
        });

        console.log('=== UPDATE PROFILE ROUTE END ===');
        res.status(200).json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser._id,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                email: updatedUser.email, // Email is included in response but can't be changed
                phoneNumber: updatedUser.phoneNumber,
                instagram: updatedUser.instagram,
                linkedin: updatedUser.linkedin,
                streetAddress: updatedUser.streetAddress,
                city: updatedUser.city,
                state: updatedUser.state,
                postalCode: updatedUser.postalCode,
                profilePicture: updatedUser.profilePicture
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            message: 'Error updating profile',
            error: error.message,
            details: error.stack
        });
    }
});

module.exports = router;