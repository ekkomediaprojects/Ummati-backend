const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/Users');
const Event = require('../models/Events');
const Payment = require('../models/Payments');
const { generateToken } = require('../middleware/auth');

describe('Analytics Routes', () => {
    const adminUser = {
        email: 'admin@example.com',
        password: 'AdminPass123!',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin'
    };

    const testUser = {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User'
    };

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

    const samplePayment = {
        amount: 1000,
        currency: 'usd',
        status: 'succeeded',
        paymentMethod: 'card',
        paymentIntentId: 'pi_123',
        customerId: 'cus_123',
        description: 'Test Payment'
    };

    let adminToken;
    let userToken;
    let userId;

    beforeEach(async () => {
        await User.deleteMany({});
        await Event.deleteMany({});
        await Payment.deleteMany({});

        const admin = await User.create(adminUser);
        const user = await User.create(testUser);
        adminToken = generateToken(admin);
        userToken = generateToken(user);
        userId = user._id;

        // Create test data
        const event = await Event.create(sampleEvent);
        await Payment.create({
            ...samplePayment,
            userId,
            eventId: event._id
        });
    });

    describe('GET /api/analytics/overview', () => {
        it('should return overview stats when admin', async () => {
            const response = await request(app)
                .get('/api/analytics/overview')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalUsers');
            expect(response.body.data).toHaveProperty('totalEvents');
            expect(response.body.data).toHaveProperty('totalRevenue');
        });

        it('should deny access when not admin', async () => {
            const response = await request(app)
                .get('/api/analytics/overview')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
        });
    });

    describe('GET /api/analytics/users', () => {
        beforeEach(async () => {
            // Create additional users for testing
            await User.create([
                { ...testUser, email: 'user2@example.com' },
                { ...testUser, email: 'user3@example.com' }
            ]);
        });

        it('should return user stats when admin', async () => {
            const response = await request(app)
                .get('/api/analytics/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalUsers');
            expect(response.body.data).toHaveProperty('activeUsers');
            expect(response.body.data).toHaveProperty('newUsers');
        });

        it('should filter user stats by date range', async () => {
            const response = await request(app)
                .get('/api/analytics/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should deny access when not admin', async () => {
            const response = await request(app)
                .get('/api/analytics/users')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
        });
    });

    describe('GET /api/analytics/events', () => {
        beforeEach(async () => {
            // Create additional events for testing
            await Event.create([
                { ...sampleEvent, eventId: 'evt_124', name: 'Event 2' },
                { ...sampleEvent, eventId: 'evt_125', name: 'Event 3' }
            ]);
        });

        it('should return event stats when admin', async () => {
            const response = await request(app)
                .get('/api/analytics/events')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalEvents');
            expect(response.body.data).toHaveProperty('upcomingEvents');
            expect(response.body.data).toHaveProperty('pastEvents');
        });

        it('should filter event stats by date range', async () => {
            const response = await request(app)
                .get('/api/analytics/events')
                .set('Authorization', `Bearer ${adminToken}`)
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should deny access when not admin', async () => {
            const response = await request(app)
                .get('/api/analytics/events')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
        });
    });

    describe('GET /api/analytics/revenue', () => {
        beforeEach(async () => {
            // Create additional payments for testing
            const event = await Event.findOne();
            await Payment.create([
                { ...samplePayment, amount: 2000, paymentIntentId: 'pi_124', eventId: event._id },
                { ...samplePayment, amount: 3000, paymentIntentId: 'pi_125', eventId: event._id }
            ]);
        });

        it('should return revenue stats when admin', async () => {
            const response = await request(app)
                .get('/api/analytics/revenue')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalRevenue');
            expect(response.body.data).toHaveProperty('averageTicketPrice');
            expect(response.body.data).toHaveProperty('revenueByEvent');
        });

        it('should filter revenue stats by date range', async () => {
            const response = await request(app)
                .get('/api/analytics/revenue')
                .set('Authorization', `Bearer ${adminToken}`)
                .query({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should deny access when not admin', async () => {
            const response = await request(app)
                .get('/api/analytics/revenue')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
        });
    });
}); 