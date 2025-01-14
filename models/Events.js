const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    eventId: { type: String, required: true, unique: true }, // Unique Eventbrite ID
    name: { type: String, required: true }, // Event name
    description: { type: String, required: true }, // Event description
    start: { type: Date, required: true }, // Start date and time (UTC)
    end: { type: Date, required: true }, // End date and time (UTC)
    imageUrl: { type: String }, // Optional image URL
    venue: {
        name: { type: String }, // Venue name
        addressLine1: { type: String }, // Address line 1
        addressLine2: { type: String }, // Address line 2 (optional)
        city: { type: String }, // City
        state: { type: String }, // State/region
        postalCode: { type: String }, // Postal code
    },
    createdAt: { type: Date, default: Date.now }, // Timestamp for when the event is saved
});

module.exports = mongoose.model('Events', eventSchema);
