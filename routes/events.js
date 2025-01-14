const Event = require('../models/Events');
const express = require('express');
const router = express.Router();


router.get("/", async (req, res) => {
    try {
        const events = await Event.find(); // Fetch events from MongoDB
        res.json(events);
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).send("Server Error");
    }
});

module.exports = router;