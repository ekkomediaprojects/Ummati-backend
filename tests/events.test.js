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

describe('Event Routes', () => {
    const testUser = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
    };

    const adminUser = {
        email: 'admin@example.com',
        password: 'AdminPass123!',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin'
    };

    let userToken;
    let adminToken;
    let testEvent;

    beforeEach(async () => {
        const user = await User.create(testUser);
        const admin = await User.create(adminUser);
        userToken = generateToken(user);
        adminToken = generateToken(admin);

        testEvent = await Event.create(sampleEvent);
    });

    describe('GET /api/events', () => {
        beforeEach(async () => {
            // Create multiple events for testing pagination and filtering
            await Event.create([
                { ...sampleEvent, eventId: 'evt_124', name: 'Event 2', start: new Date('2024-12-02T10:00:00Z') },
                { ...sampleEvent, eventId: 'evt_125', name: 'Event 3', start: new Date('2024-12-03T10:00:00Z') }
            ]);
        });

        it('should return paginated events', async () => {
            const response = await request(app)
                .get('/api/events')
                .query({ page: 1, limit: 2 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.events).toHaveLength(2);
            expect(response.body.data.pagination.total).toBe(3);
        });

        it('should filter events by date range', async () => {
            const response = await request(app)
                .get('/api/events')
                .query({
                    startDate: '2024-12-01',
                    endDate: '2024-12-02'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.events.length).toBeLessThanOrEqual(2);
        });

        it('should search events by name', async () => {
            const response = await request(app)
                .get('/api/events')
                .query({ search: 'Event 2' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.events[0].name).toBe('Event 2');
        });
    });

    describe('GET /api/events/:id', () => {
        it('should return event by ID', async () => {
            const response = await request(app)
                .get(`/api/events/${testEvent._id}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(testEvent.name);
        });

        it('should return 404 for non-existent event', async () => {
            const response = await request(app)
                .get(`/api/events/${new mongoose.Types.ObjectId()}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/events/upcoming', () => {
        it('should return upcoming events', async () => {
            // Create a past event
            await Event.create({
                ...sampleEvent,
                eventId: 'evt_126',
                start: new Date('2023-01-01'),
                end: new Date('2023-01-02')
            });

            const response = await request(app)
                .get('/api/events/upcoming')
                .query({ limit: 5 });

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].eventId).toBe('evt_123');
        });
    });

    describe('GET /api/events/past', () => {
        it('should return past events', async () => {
            // Create a past event
            const pastEvent = await Event.create({
                ...sampleEvent,
                eventId: 'evt_126',
                start: new Date('2023-01-01'),
                end: new Date('2023-01-02')
            });

            const response = await request(app)
                .get('/api/events/past')
                .query({ page: 1, limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body.data.events).toHaveLength(1);
            expect(response.body.data.events[0].eventId).toBe('evt_126');
        });
    });

    describe('GET /api/events/search', () => {
        it('should search events by location', async () => {
            const response = await request(app)
                .get('/api/events/search')
                .query({ city: 'Test City' });

            expect(response.status).toBe(200);
            expect(response.body.data.events).toHaveLength(1);
            expect(response.body.data.events[0].venue.city).toBe('Test City');
        });

        it('should search events by date range and location', async () => {
            const response = await request(app)
                .get('/api/events/search')
                .query({
                    startDate: '2024-11-01',
                    endDate: '2024-12-31',
                    state: 'TS'
                });

            expect(response.status).toBe(200);
            expect(response.body.data.events).toHaveLength(1);
            expect(response.body.data.events[0].venue.state).toBe('TS');
        });
    });

    describe('POST /api/events', () => {
        it('should create event when admin', async () => {
            const newEvent = {
                ...sampleEvent,
                eventId: 'evt_126'
            };

            const response = await request(app)
                .post('/api/events')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newEvent);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(newEvent.name);
        });

        it('should not create event when not admin', async () => {
            const response = await request(app)
                .post('/api/events')
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
                .post('/api/events')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(invalidEvent);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /api/events/:id', () => {
        it('should update event when admin', async () => {
            const updates = {
                name: 'Updated Event Name',
                description: 'Updated Description'
            };

            const response = await request(app)
                .put(`/api/events/${testEvent._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(updates.name);
            expect(response.body.data.description).toBe(updates.description);
        });

        it('should not update event when not admin', async () => {
            const response = await request(app)
                .put(`/api/events/${testEvent._id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: 'Updated Name' });

            expect(response.status).toBe(403);
        });
    });

    describe('DELETE /api/events/:id', () => {
        it('should delete event when admin', async () => {
            const response = await request(app)
                .delete(`/api/events/${testEvent._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const deletedEvent = await Event.findById(testEvent._id);
            expect(deletedEvent).toBeNull();
        });

        it('should not delete event when not admin', async () => {
            const response = await request(app)
                .delete(`/api/events/${testEvent._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);

            const event = await Event.findById(testEvent._id);
            expect(event).not.toBeNull();
        });
    });
}); 