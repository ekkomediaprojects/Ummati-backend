const { describe, beforeAll, afterAll, beforeEach, it, expect } = require('@jest/globals');
const request = require('supertest');
const app = require('../app');
const User = require('../models/Users');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./testUtils');

describe('Auth Routes', () => {
    beforeAll(async () => {
        await setupTestDB();
    });

    afterAll(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
    });

// ... existing code ...
}); 