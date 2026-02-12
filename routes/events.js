const Event = require('../models/Events');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Import mongoose

router.get("/", async (req, res) => {
    try {
        const now = new Date();

        const events = await Event.find();

        const upcomingEvents = events
            .filter(e => new Date(e.end) >= now)   // remove past events
            .sort((a, b) => new Date(a.start) - new Date(b.start)); // sort by start

        res.json(upcomingEvents);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post("/reorder", async (req, res) => {
  try {
    console.log("[DEBUG] Fetching events from MongoDB...");

    // Fetch all events from the database
    const events = await Event.find();
    console.log(`[DEBUG] Total events fetched: ${events.length}`);

    // Copy all events into an array and sort them by `start` date (descending)
    const sortedEvents = [...events].sort((a, b) => new Date(b.start) - new Date(a.start));

    console.log("[DEBUG] Events sorted successfully.");
    sortedEvents.forEach((event, index) => {
      console.log(`[DEBUG] Event: ${event.name}, New OrderIndex: ${index + 1}`);
      event.orderIndex = index + 1; // Assign new order index
    });

    // Delete all events from the database
    console.log("[DEBUG] Deleting all events from the database...");
    await Event.deleteMany();
    console.log("[DEBUG] All events deleted.");

    // Re-add sorted events to the database
    console.log("[DEBUG] Re-adding sorted events to the database...");
    await Event.insertMany(sortedEvents);
    console.log("[DEBUG] Events re-added successfully.");

    res.status(200).json({
        success: true,
        message: "Events reordered, database updated successfully."
    });
  } catch (error) {
    console.error("[ERROR] Error reordering events:", error);
    res.status(500).json({
        success: false,
        message: "Error reordering events",
        error: error.message
    });
  }
});

module.exports = router;