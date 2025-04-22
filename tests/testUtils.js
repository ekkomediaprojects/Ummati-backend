const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const setupTestDB = async () => {
    if (!mongoServer) {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);
    }
};

const teardownTestDB = async () => {
    if (mongoServer) {
        await mongoose.disconnect();
        await mongoServer.stop();
        mongoServer = null;
    }
};

const clearTestDB = async () => {
    if (mongoose.connection.readyState === 1) {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany();
        }
    }
};

module.exports = {
    setupTestDB,
    teardownTestDB,
    clearTestDB
}; 