const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const Contact = require('../models/Contact');
const EmailSubscriber = require('../models/EmailSubscriber');
const User = require('../models/Users');
const { generateToken } = require('../middleware/auth');

describe('Contact and Email Subscriber Routes', () => {
    const adminUser = {
        email: 'admin@example.com',
        password: 'AdminPass123!',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin'
    };

    const sampleContact = {
        name: 'Test User',
        email: 'test@example.com',
        message: 'Test message',
        subject: 'Test Subject'
    };

    const sampleSubscriber = {
        email: 'subscriber@example.com',
        firstName: 'Subscriber',
        lastName: 'User'
    };

    let adminToken;

    beforeEach(async () => {
        await Contact.deleteMany({});
        await EmailSubscriber.deleteMany({});
        await User.deleteMany({});

        const admin = await User.create(adminUser);
        adminToken = generateToken(admin);
    });

    describe('Contact Routes', () => {
        describe('POST /api/contact', () => {
            it('should create contact message', async () => {
                const response = await request(app)
                    .post('/api/contact')
                    .send(sampleContact);

                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.data.email).toBe(sampleContact.email);
            });

            it('should validate required fields', async () => {
                const invalidContact = {
                    name: 'Test User'
                    // Missing required fields
                };

                const response = await request(app)
                    .post('/api/contact')
                    .send(invalidContact);

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            });
        });

        describe('GET /api/contact', () => {
            beforeEach(async () => {
                await Contact.create([
                    sampleContact,
                    { ...sampleContact, email: 'test2@example.com' }
                ]);
            });

            it('should return all contact messages when admin', async () => {
                const response = await request(app)
                    .get('/api/contact')
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveLength(2);
            });

            it('should deny access when not admin', async () => {
                const response = await request(app)
                    .get('/api/contact');

                expect(response.status).toBe(401);
            });
        });

        describe('DELETE /api/contact/:id', () => {
            let contactId;

            beforeEach(async () => {
                const contact = await Contact.create(sampleContact);
                contactId = contact._id;
            });

            it('should delete contact message when admin', async () => {
                const response = await request(app)
                    .delete(`/api/contact/${contactId}`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);

                const deletedContact = await Contact.findById(contactId);
                expect(deletedContact).toBeNull();
            });

            it('should deny deletion when not admin', async () => {
                const response = await request(app)
                    .delete(`/api/contact/${contactId}`);

                expect(response.status).toBe(401);

                const contact = await Contact.findById(contactId);
                expect(contact).not.toBeNull();
            });
        });
    });

    describe('Email Subscriber Routes', () => {
        describe('POST /api/subscribers', () => {
            it('should create email subscriber', async () => {
                const response = await request(app)
                    .post('/api/subscribers')
                    .send(sampleSubscriber);

                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
                expect(response.body.data.email).toBe(sampleSubscriber.email);
            });

            it('should not create duplicate subscriber', async () => {
                await EmailSubscriber.create(sampleSubscriber);

                const response = await request(app)
                    .post('/api/subscribers')
                    .send(sampleSubscriber);

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            });

            it('should validate email format', async () => {
                const invalidSubscriber = {
                    ...sampleSubscriber,
                    email: 'invalid-email'
                };

                const response = await request(app)
                    .post('/api/subscribers')
                    .send(invalidSubscriber);

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            });
        });

        describe('GET /api/subscribers', () => {
            beforeEach(async () => {
                await EmailSubscriber.create([
                    sampleSubscriber,
                    { ...sampleSubscriber, email: 'subscriber2@example.com' }
                ]);
            });

            it('should return all subscribers when admin', async () => {
                const response = await request(app)
                    .get('/api/subscribers')
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveLength(2);
            });

            it('should deny access when not admin', async () => {
                const response = await request(app)
                    .get('/api/subscribers');

                expect(response.status).toBe(401);
            });
        });

        describe('DELETE /api/subscribers/:id', () => {
            let subscriberId;

            beforeEach(async () => {
                const subscriber = await EmailSubscriber.create(sampleSubscriber);
                subscriberId = subscriber._id;
            });

            it('should delete subscriber when admin', async () => {
                const response = await request(app)
                    .delete(`/api/subscribers/${subscriberId}`)
                    .set('Authorization', `Bearer ${adminToken}`);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);

                const deletedSubscriber = await EmailSubscriber.findById(subscriberId);
                expect(deletedSubscriber).toBeNull();
            });

            it('should deny deletion when not admin', async () => {
                const response = await request(app)
                    .delete(`/api/subscribers/${subscriberId}`);

                expect(response.status).toBe(401);

                const subscriber = await EmailSubscriber.findById(subscriberId);
                expect(subscriber).not.toBeNull();
            });
        });
    });
}); 