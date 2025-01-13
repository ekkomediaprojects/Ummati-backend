const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    eventId: { type: String, required: true, unique: true }, // Unique Eventbrite ID
    name: { type: String, required: true }, // Event name
    description: { type: String, required: true }, // Event description
    start: { type: Date, required: true }, // Start date and time (UTC)
    end: { type: Date, required: true }, // End date and time (UTC)
    imageUrl: { type: String }, // Optional image URL
    venue: { type: String }, // Venue name or Online
    createdAt: { type: Date, default: Date.now }, // Timestamp for when the event is saved in your system
});

module.exports = mongoose.model('Events', eventSchema);