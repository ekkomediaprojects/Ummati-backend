const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const QRCode = require('../models/QRCode');
const User = require('../models/Users');
const { generateToken } = require('../middleware/auth');

describe('QR Code Routes', () => {
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

    const sampleQRCode = {
        type: 'event',
        eventId: 'evt_123',
        name: 'Test Event QR',
        description: 'Test Description',
        url: 'https://example.com/event/123'
    };

    let userToken;
    let adminToken;
    let testQRCode;
    let userId;

    beforeEach(async () => {
        await QRCode.deleteMany({});
        await User.deleteMany({});

        const user = await User.create(testUser);
        const admin = await User.create(adminUser);
        userToken = generateToken(user);
        adminToken = generateToken(admin);
        userId = user._id;

        testQRCode = await QRCode.create({
            ...sampleQRCode,
            createdBy: userId
        });
    });

    describe('POST /api/qrcodes', () => {
        it('should create QR code when authenticated', async () => {
            const newQRCode = {
                ...sampleQRCode,
                eventId: 'evt_124'
            };

            const response = await request(app)
                .post('/api/qrcodes')
                .set('Authorization', `Bearer ${userToken}`)
                .send(newQRCode);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(newQRCode.name);
        });

        it('should not create QR code when not authenticated', async () => {
            const response = await request(app)
                .post('/api/qrcodes')
                .send(sampleQRCode);

            expect(response.status).toBe(401);
        });

        it('should validate required fields', async () => {
            const invalidQRCode = {
                name: 'Test QR'
                // Missing required fields
            };

            const response = await request(app)
                .post('/api/qrcodes')
                .set('Authorization', `Bearer ${userToken}`)
                .send(invalidQRCode);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/qrcodes', () => {
        beforeEach(async () => {
            await QRCode.create([
                { ...sampleQRCode, eventId: 'evt_124', name: 'QR Code 2', createdBy: userId },
                { ...sampleQRCode, eventId: 'evt_125', name: 'QR Code 3', createdBy: userId }
            ]);
        });

        it('should return user QR codes when authenticated', async () => {
            const response = await request(app)
                .get('/api/qrcodes')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(3);
        });

        it('should return all QR codes when admin', async () => {
            const response = await request(app)
                .get('/api/qrcodes')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(3);
        });

        it('should deny access when not authenticated', async () => {
            const response = await request(app)
                .get('/api/qrcodes');

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/qrcodes/:id', () => {
        it('should return QR code when user owns it', async () => {
            const response = await request(app)
                .get(`/api/qrcodes/${testQRCode._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(testQRCode.name);
        });

        it('should return QR code when admin', async () => {
            const response = await request(app)
                .get(`/api/qrcodes/${testQRCode._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(testQRCode.name);
        });

        it('should deny access to other user QR codes', async () => {
            const otherUser = await User.create({
                email: 'other@example.com',
                password: 'Password123!',
                firstName: 'Other',
                lastName: 'User'
            });

            const otherQRCode = await QRCode.create({
                ...sampleQRCode,
                eventId: 'evt_126',
                createdBy: otherUser._id
            });

            const response = await request(app)
                .get(`/api/qrcodes/${otherQRCode._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
        });
    });

    describe('PUT /api/qrcodes/:id', () => {
        it('should update QR code when user owns it', async () => {
            const updates = {
                name: 'Updated QR Code',
                description: 'Updated Description'
            };

            const response = await request(app)
                .put(`/api/qrcodes/${testQRCode._id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(updates.name);
            expect(response.body.data.description).toBe(updates.description);
        });

        it('should update QR code when admin', async () => {
            const updates = {
                name: 'Updated QR Code',
                description: 'Updated Description'
            };

            const response = await request(app)
                .put(`/api/qrcodes/${testQRCode._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(updates.name);
        });

        it('should not update other user QR codes', async () => {
            const otherUser = await User.create({
                email: 'other@example.com',
                password: 'Password123!',
                firstName: 'Other',
                lastName: 'User'
            });

            const otherQRCode = await QRCode.create({
                ...sampleQRCode,
                eventId: 'evt_126',
                createdBy: otherUser._id
            });

            const response = await request(app)
                .put(`/api/qrcodes/${otherQRCode._id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: 'Updated Name' });

            expect(response.status).toBe(403);
        });
    });

    describe('DELETE /api/qrcodes/:id', () => {
        it('should delete QR code when user owns it', async () => {
            const response = await request(app)
                .delete(`/api/qrcodes/${testQRCode._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const deletedQRCode = await QRCode.findById(testQRCode._id);
            expect(deletedQRCode).toBeNull();
        });

        it('should delete QR code when admin', async () => {
            const response = await request(app)
                .delete(`/api/qrcodes/${testQRCode._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const deletedQRCode = await QRCode.findById(testQRCode._id);
            expect(deletedQRCode).toBeNull();
        });

        it('should not delete other user QR codes', async () => {
            const otherUser = await User.create({
                email: 'other@example.com',
                password: 'Password123!',
                firstName: 'Other',
                lastName: 'User'
            });

            const otherQRCode = await QRCode.create({
                ...sampleQRCode,
                eventId: 'evt_126',
                createdBy: otherUser._id
            });

            const response = await request(app)
                .delete(`/api/qrcodes/${otherQRCode._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);

            const qrCode = await QRCode.findById(otherQRCode._id);
            expect(qrCode).not.toBeNull();
        });
    });
}); 