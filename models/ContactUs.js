const mongoose = require('mongoose');

const ContactUsSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { 
        type: String, 
        required: true, 
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} is not a valid email!`
        }
    },
    topic: { 
        type: String, 
        required: true,
        enum: ['Business Partnerships', 'Sponsorship', 'Join the Team', 'Start a Chapter', 'Other']
    },
    message: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['Pending', 'Resolved'], default: 'Pending' },
});

module.exports = mongoose.model('ContactUs', ContactUsSchema);