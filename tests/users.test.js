const { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } = require('@jest/globals');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/Users');
const { generateToken } = require('../middleware/auth');
const { setupTestDB, teardownTestDB, clearTestDB } = require('./testUtils');

describe('User Routes', () => {
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

    beforeAll(async () => {
        await setupTestDB();
    });

    afterAll(async () => {
        await teardownTestDB();
    });

    beforeEach(async () => {
        await clearTestDB();
        const user = await User.create(testUser);
        const admin = await User.create(adminUser);
        userToken = generateToken(user);
        adminToken = generateToken(admin);
    });

    describe('GET /api/users', () => {
        it('should return all users when admin', async () => {
            const response = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2); // admin and test user
        });

        it('should deny access when not admin', async () => {
            const response = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
        });
    });

    describe('GET /api/users/:id', () => {
        let userId;

        beforeEach(async () => {
            const user = await User.findOne({ email: testUser.email });
            userId = user._id;
        });

        it('should return user profile when admin', async () => {
            const response = await request(app)
                .get(`/api/users/${userId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.email).toBe(testUser.email);
        });

        it('should return own profile when authenticated', async () => {
            const response = await request(app)
                .get(`/api/users/${userId}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.email).toBe(testUser.email);
        });

        it('should deny access to other user profiles', async () => {
            const otherUser = await User.create({
                email: 'other@example.com',
                password: 'Password123!',
                firstName: 'Other',
                lastName: 'User'
            });

            const response = await request(app)
                .get(`/api/users/${otherUser._id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);
        });
    });

    describe('PUT /api/users/:id', () => {
        let userId;

        beforeEach(async () => {
            const user = await User.findOne({ email: testUser.email });
            userId = user._id;
        });

        it('should update user profile when admin', async () => {
            const updates = {
                firstName: 'Updated',
                lastName: 'Name'
            };

            const response = await request(app)
                .put(`/api/users/${userId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.firstName).toBe(updates.firstName);
            expect(response.body.data.lastName).toBe(updates.lastName);
        });

        it('should update own profile when authenticated', async () => {
            const updates = {
                firstName: 'Updated',
                lastName: 'Name'
            };

            const response = await request(app)
                .put(`/api/users/${userId}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(updates);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.firstName).toBe(updates.firstName);
            expect(response.body.data.lastName).toBe(updates.lastName);
        });

        it('should not update other user profiles', async () => {
            const otherUser = await User.create({
                email: 'other@example.com',
                password: 'Password123!',
                firstName: 'Other',
                lastName: 'User'
            });

            const updates = {
                firstName: 'Updated',
                lastName: 'Name'
            };

            const response = await request(app)
                .put(`/api/users/${otherUser._id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(updates);

            expect(response.status).toBe(403);
        });
    });

    describe('DELETE /api/users/:id', () => {
        let userId;

        beforeEach(async () => {
            const user = await User.findOne({ email: testUser.email });
            userId = user._id;
        });

        it('should delete user when admin', async () => {
            const response = await request(app)
                .delete(`/api/users/${userId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const deletedUser = await User.findById(userId);
            expect(deletedUser).toBeNull();
        });

        it('should not delete user when not admin', async () => {
            const response = await request(app)
                .delete(`/api/users/${userId}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(response.status).toBe(403);

            const user = await User.findById(userId);
            expect(user).not.toBeNull();
        });
    });
}); 