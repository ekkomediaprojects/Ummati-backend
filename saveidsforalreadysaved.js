// scripts/assignMemberIds.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('./models/Users'); // adjust path to your model

const MONGO_URI = 'your_mongo_connection_string_here';
async function generateMemberIds() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({ $or: [{ memberId: { $exists: false } }, { memberId: null }] });

    console.log(`Found ${users.length} users missing memberId`);

    for (const user of users) {
      const initials = (user.firstName[0] + user.lastName[0]).toUpperCase();
      const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
      user.memberId = `UCMB-${initials}-${randomPart}`;
      await user.save();
      console.log(`✅ Assigned ${user.memberId} to ${user.email}`);
    }

    console.log('All missing memberIds have been assigned.');
    process.exit(0);
  } catch (err) {
    console.error('Error generating memberIds:', err);
    process.exit(1);
  }
}

generateMemberIds();
