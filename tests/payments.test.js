const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Payment = require('../models/Payments');
const User = require('../models/Users');
const { generateToken } = require('../middleware/auth');

describe('Payment Routes', () => {
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

    const samplePayment = {
        amount: 1000,
        currency: 'usd',
        status: 'succeeded',
        paymentMethod: 'card',
        paymentIntentId: 'pi_123',
        customerId: 'cus_123',
        description: 'Test Payment'
    };

    let userToken;
    let adminToken;
    let testPayment;
    let userId;

    beforeEach(async () => {
        await Payment.deleteMany({});
        await User.deleteMany({});

        const user = await User.create(testUser);
        const admin = await User.create(adminUser);
        userToken = generateToken(user);
        adminToken = generateToken(admin);
        userId = user._id;

        testPayment = await Payment.create({
            ...samplePayment,
            userId: userId
        });
    });

    describe('GET /api/payments', () => {
        beforeEach(async () => {
            // Create multiple payments for testing pagination
            await Payment.create([
                { ...samplePayment, userId, amount: 2000, paymentIntentId: 'pi_124' },
                { ...samplePayment, userId, amount: 3000, paymentIntentId: 'pi_125' }
            ]);
        });

        it('should return user payments when authenticated', async () => {
            const response = await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(3);
        });

        it('should return all payments when admin', async () => {
            const response = await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(3);
        });

        it('should deny access when not authenticated', async () => {
            const response = await request(app)
                .get('/api/payments');

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/payments/:id', () => {
        it('should return payment when user owns it', async () => {
            const response = await request(app)
                .get(`/api/payments/${testPayment._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.amount).toBe(testPayment.amount);
        });

        it('should return payment when admin', async () => {
            const response = await request(app)
                .get(`/api/payments/${testPayment._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.amount).toBe(testPayment.amount);
        });

        it('should deny access to other user payments', async () => {
            const otherUser = await User.create({
                email: 'other@example.com',
                password: 'Password123!',
                firstName: 'Other',
                lastName: 'User'
            });

            const otherPayment = await Payment.create({
                ...samplePayment,
                userId: otherUser._id,
                paymentIntentId: 'pi_126'
            });

            const response = await request(app)
                .get(`/api/payments/${otherPayment._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
        });
    });

    describe('POST /api/payments/refund', () => {
        it('should process refund when admin', async () => {
            const response = await request(app)
                .post('/api/payments/refund')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    paymentId: testPayment._id,
                    amount: 500,
                    reason: 'Customer request'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('refunded');
        });

        it('should not process refund when not admin', async () => {
            const response = await request(app)
                .post('/api/payments/refund')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    paymentId: testPayment._id,
                    amount: 500,
                    reason: 'Customer request'
                });

            expect(response.status).toBe(403);
        });

        it('should validate refund amount', async () => {
            const response = await request(app)
                .post('/api/payments/refund')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    paymentId: testPayment._id,
                    amount: 2000, // More than original payment
                    reason: 'Customer request'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/payments/stats', () => {
        it('should return payment stats when admin', async () => {
            const response = await request(app)
                .get('/api/payments/stats')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('totalAmount');
            expect(response.body.data).toHaveProperty('totalCount');
        });

        it('should not return stats when not admin', async () => {
            const response = await request(app)
                .get('/api/payments/stats')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
        });
    });
}); 