import request from 'supertest';
import { app } from '../server';
import User from '../models/User';
import Notification from '../models/Notification';

describe('Notification API Endpoints', () => {
  let user: any;
  let token: string;
  let notif1: any;
  let notif2: any;

  beforeEach(async () => {
    user = await User.create({
      name: 'Notification Target',
      email: 'notif@example.com',
      password: 'password123',
      role: 'Team Member',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'notif@example.com',
      password: 'password123',
    });
    token = loginRes.body.token;

    notif1 = await Notification.create({
      recipient: user._id,
      title: 'First Notification',
      message: 'You were assigned to task 1',
      type: 'assignment',
      isRead: false,
    });

    notif2 = await Notification.create({
      recipient: user._id,
      title: 'Second Notification',
      message: 'Comment added on task 1',
      type: 'comment',
      isRead: false,
    });
  });

  describe('GET /api/notifications', () => {
    it('should return all notifications for the authenticated user', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body[0].title).toBe('Second Notification'); // Sorted newest first
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark a specific notification as read', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notif1._id}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isRead).toBe(true);

      const inDb = await Notification.findById(notif1._id);
      expect(inDb?.isRead).toBe(true);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications for the user as read', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const unreadCount = await Notification.countDocuments({
        recipient: user._id,
        isRead: false,
      });
      expect(unreadCount).toBe(0);
    });
  });

  describe('DELETE /api/notifications', () => {
    it('should clear/delete all notifications for the user', async () => {
      const res = await request(app)
        .delete('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const totalCount = await Notification.countDocuments({ recipient: user._id });
      expect(totalCount).toBe(0);
    });
  });
});
