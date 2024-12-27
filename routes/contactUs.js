require('dotenv').config(); // Load environment variables
const express = require('express');
const nodemailer = require('nodemailer');
const ContactUs = require('../models/ContactUs'); // Import your ContactUs model
const router = express.Router();

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
    logger: true,
    debug: true,
});

// POST route to handle Contact Us form submission
router.post('/formSubmit', async (req, res) => {
    try {
        console.log('Received request at /formSubmit');
        console.log('Request body:', req.body);

        const { firstName, lastName, email, topic, message } = req.body;

        if (!firstName || !lastName || !email || !topic || !message) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Store submission in database
        const newSubmission = new ContactUs({
            firstName,
            lastName,
            email,
            topic,
            message,
        });

        const savedSubmission = await newSubmission.save();
        console.log('Form submission saved to database:', savedSubmission);

        // Email to Business Email
        const businessMailOptions = {
            from: process.env.EMAIL,
            to: 'team@ummaticommunity.com',
            subject: 'New Contact Us Form Submission',
            text: `
                New Contact Us Form Submission:

                Name: ${firstName} ${lastName}
                Email: ${email}
                Topic: ${topic}
                Message: ${message}
            `,
        };

        // Email to User (Acknowledgment)
        const userMailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: 'We Received Your Message',
            text: `
                Hi ${firstName},

                Thank you for reaching out to us regarding "${topic}". We have received your message and will get back to you as soon as possible.

                Here's a copy of your submission:
                Name: ${firstName} ${lastName}
                Email: ${email}
                Topic: ${topic}
                Message: ${message}

                Best regards,
                Ummati Community Team
            `,
        };

        // Send both emails
        console.log('Sending email to business email...');
        await transporter.sendMail(businessMailOptions);

        console.log('Sending acknowledgment email to user...');
        await transporter.sendMail(userMailOptions);

        res.status(201).json({ message: 'Your message has been submitted successfully!' });
    } catch (error) {
        console.error('Error submitting contact form:', error);
        res.status(500).json({ error: 'Something went wrong. Please try again later.' });
    }
});

// GET route to retrieve all Contact Us submissions
router.get('/allContactUs', async (req, res) => {
    try {
        console.log('Received request at /allContactUs');

        // Fetch all submissions from the database
        const submissions = await ContactUs.find().sort({ submittedAt: -1 }); // Sort by latest first
        console.log('Fetched submissions:', submissions);

        res.status(200).json(submissions);
    } catch (error) {
        console.error('Error fetching Contact Us submissions:', error);
        res.status(500).json({ error: 'Something went wrong. Please try again later.' });
    }
});

module.exports = router;
