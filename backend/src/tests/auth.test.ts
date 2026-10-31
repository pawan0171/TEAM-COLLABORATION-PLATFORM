import request from 'supertest';
import { app } from '../server';
import User from '../models/User';

describe('Authentication API Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and return a JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'password123',
          role: 'Team Member',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.name).toBe('Jane Doe');
      expect(res.body.email).toBe('jane@example.com');
      expect(res.body.role).toBe('Team Member');

      // Verify in DB
      const userInDb = await User.findOne({ email: 'jane@example.com' });
      expect(userInDb).not.toBeNull();
      expect(userInDb?.password).not.toBe('password123'); // Hashed
    });

    it('should reject registration if email is already taken', async () => {
      await User.create({
        name: 'Existing User',
        email: 'exist@example.com',
        password: 'password123',
        role: 'Team Member',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: 'exist@example.com',
          password: 'password456',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already exists/i);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await User.create({
        name: 'John Smith',
        email: 'john@example.com',
        password: 'secretPassword',
        role: 'Project Manager',
      });
    });

    it('should authenticate user and return token on valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'secretPassword',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.email).toBe('john@example.com');
      expect(res.body.role).toBe('Project Manager');
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john@example.com',
          password: 'wrongPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return the current user profile when valid token is provided', async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Profile User',
          email: 'profile@example.com',
          password: 'password123',
        });

      const token = registerRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Profile User');
      expect(res.body.email).toBe('profile@example.com');
      expect(res.body).not.toHaveProperty('password');
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
