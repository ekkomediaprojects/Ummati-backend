const { beforeAll, afterEach, afterAll } = require('@jest/globals');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./testUtils');

beforeAll(async () => {
    await setupTestDB();
});

afterEach(async () => {
    await clearTestDB();
});

afterAll(async () => {
    await teardownTestDB();
}); 