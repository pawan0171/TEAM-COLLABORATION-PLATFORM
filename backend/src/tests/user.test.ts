import request from 'supertest';
import { app } from '../server';
import User from '../models/User';

describe('User Management API Endpoints', () => {
  let adminToken: string;
  let memberToken: string;
  let adminUser: any;
  let memberUser: any;

  beforeEach(async () => {
    adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@example.com',
      password: 'password123',
      role: 'Admin',
    });

    memberUser = await User.create({
      name: 'Team Dev',
      email: 'dev@example.com',
      password: 'password123',
      role: 'Team Member',
    });

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'password123',
    });
    adminToken = adminLogin.body.token;

    const memberLogin = await request(app).post('/api/auth/login').send({
      email: 'dev@example.com',
      password: 'password123',
    });
    memberToken = memberLogin.body.token;
  });

  describe('GET /api/users', () => {
    it('should allow authenticated users to list all users without password field', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body[0]).not.toHaveProperty('password');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/users/:id/role', () => {
    it('should allow Admin to promote a Team Member to Project Manager', async () => {
      const res = await request(app)
        .put(`/api/users/${memberUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'Project Manager' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('Project Manager');

      const updated = await User.findById(memberUser._id);
      expect(updated?.role).toBe('Project Manager');
    });

    it('should reject role update by a non-Admin with 403 Forbidden', async () => {
      const res = await request(app)
        .put(`/api/users/${memberUser._id}/role`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ role: 'Admin' });

      expect(res.status).toBe(403);
    });

    it('should prevent an Admin from demoting themselves if they are the only Admin', async () => {
      const res = await request(app)
        .put(`/api/users/${adminUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'Team Member' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot demote the only remaining admin/i);
    });
  });
});
