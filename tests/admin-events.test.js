const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Event = require('../models/Events');
const User = require('../models/Users');
const { generateToken } = require('../middleware/auth');

let mongoServer;

// Sample event data
const sampleEvent = {
    eventId: 'evt_123',
    name: 'Test Event',
    description: 'Test Description',
    start: new Date('2024-12-01T10:00:00Z'),
    end: new Date('2024-12-01T12:00:00Z'),
    imageUrl: 'https://example.com/image.jpg',
    venue: {
        name: 'Test Venue',
        addressLine1: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345'
    }
};

// Sample admin user
const adminUser = {
    email: 'admin@test.com',
    password: 'password123',
    role: 'admin'
};

// Sample regular user
const regularUser = {
    email: 'user@test.com',
    password: 'password123',
    role: 'user'
};

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Event.deleteMany({});
    await User.deleteMany({});
});

describe('Admin Event Routes', () => {
    let adminToken;
    let userToken;
    let testEvent;

    beforeEach(async () => {
        // Create admin and regular user
        const admin = await User.create(adminUser);
        const user = await User.create(regularUser);
        
        adminToken = generateToken(admin);
        userToken = generateToken(user);

        // Create test event
        testEvent = await Event.create(sampleEvent);
    });

    describe('POST /api/admin/events', () => {
        it('should create a new event when admin', async () => {
            const newEvent = {
                ...sampleEvent,
                eventId: 'evt_124'
            };

            const response = await request(app)
                .post('/api/admin/events')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newEvent);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(newEvent.name);
        });

        it('should reject event creation when not admin', async () => {
            const response = await request(app)
                .post('/api/admin/events')
                .set('Authorization', `Bearer ${userToken}`)
                .send(sampleEvent);

            expect(response.status).toBe(403);
        });

        it('should validate required fields', async () => {
            const invalidEvent = {
                name: 'Test Event'
                // Missing required fields
            };

            const response = await request(app)
                .post('/api/admin/events')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(invalidEvent);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/admin/events', () => {
        it('should return paginated events when admin', async () => {
            // Create multiple events
            await Event.create([
                { ...sampleEvent, eventId: 'evt_124', name: 'Event 2' },
                { ...sampleEvent, eventId: 'evt_125', name: 'Event 3' }
            ]);

            const response = await request(app)
                .get('/api/admin/events')
                .set('Authorization', `Bearer ${adminToken}`)
                .query({ page: 1, limit: 2 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.events).toHaveLength(2);
            expect(response.body.data.pagination.total).toBe(3);
        });

        it('should reject access when not admin', async () => {
            const response = await request(app)
                .get('/api/admin/events')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
        });
    });

    describe('PUT /api/admin/events/:id', () => {
        it('should update event when admin', async () => {
            const updates = {
                name: 'Updated Event Name',
                description: 'Updated Description'
            };

            const response = await request(app)
                .put(`/api/admin/events/${testEvent._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(updates.name);
            expect(response.body.data.description).toBe(updates.description);
        });

        it('should reject update when not admin', async () => {
            const response = await request(app)
                .put(`/api/admin/events/${testEvent._id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: 'Updated Name' });

            expect(response.status).toBe(403);
        });

        it('should return 404 for non-existent event', async () => {
            const response = await request(app)
                .put(`/api/admin/events/${new mongoose.Types.ObjectId()}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated Name' });

            expect(response.status).toBe(404);
        });
    });

    describe('DELETE /api/admin/events/:id', () => {
        it('should delete event when admin', async () => {
            const response = await request(app)
                .delete(`/api/admin/events/${testEvent._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify event is deleted
            const deletedEvent = await Event.findById(testEvent._id);
            expect(deletedEvent).toBeNull();
        });

        it('should reject deletion when not admin', async () => {
            const response = await request(app)
                .delete(`/api/admin/events/${testEvent._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);

            // Verify event is not deleted
            const event = await Event.findById(testEvent._id);
            expect(event).not.toBeNull();
        });

        it('should return 404 for non-existent event', async () => {
            const response = await request(app)
                .delete(`/api/admin/events/${new mongoose.Types.ObjectId()}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(404);
        });
    });
}); 