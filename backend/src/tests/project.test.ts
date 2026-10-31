import request from 'supertest';
import { app } from '../server';
import User from '../models/User';
import Project from '../models/Project';

describe('Project & Task Management API Endpoints', () => {
  let pmUser: any;
  let memberA: any;
  let memberB: any;

  let pmToken: string;
  let memberAToken: string;
  let memberBToken: string;

  beforeEach(async () => {
    pmUser = await User.create({
      name: 'Manager Bob',
      email: 'bob@example.com',
      password: 'password123',
      role: 'Project Manager',
    });

    memberA = await User.create({
      name: 'Alice Dev',
      email: 'alice@example.com',
      password: 'password123',
      role: 'Team Member',
    });

    memberB = await User.create({
      name: 'Charlie Dev',
      email: 'charlie@example.com',
      password: 'password123',
      role: 'Team Member',
    });

    const pmLogin = await request(app).post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'password123',
    });
    pmToken = pmLogin.body.token;

    const memberALogin = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });
    memberAToken = memberALogin.body.token;

    const memberBLogin = await request(app).post('/api/auth/login').send({
      email: 'charlie@example.com',
      password: 'password123',
    });
    memberBToken = memberBLogin.body.token;
  });

  describe('Project Creation & Permissions', () => {
    it('should allow Project Manager to create a workspace project', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          name: 'Platform Redesign',
          description: 'Migrating frontend to Next.js',
          status: 'In Progress',
          members: [memberA._id, memberB._id],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Platform Redesign');
      expect(res.body.manager._id.toString()).toBe(pmUser._id.toString());
      expect(res.body.members.length).toBe(2);
    });

    it('should forbid Team Member from creating a project (403)', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${memberAToken}`)
        .send({
          name: 'Forbidden Project',
          description: 'Team member creation attempt',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Personal Task Scoping for Team Members (projectForUser)', () => {
    let project: any;
    let taskForAId: string;
    let taskForBId: string;

    beforeEach(async () => {
      // Create project with 2 tasks: 1 assigned to Alice (A), 1 assigned to Charlie (B)
      project = await Project.create({
        name: 'Collaborative Workspace',
        description: 'Scoped task testing',
        status: 'In Progress',
        manager: pmUser._id,
        members: [memberA._id, memberB._id],
        tasks: [
          {
            title: "Alice's Assigned Task",
            description: 'Task for Alice only',
            priority: 'High',
            status: 'Todo',
            assignedUser: memberA._id,
          },
          {
            title: "Charlie's Assigned Task",
            description: 'Task for Charlie only',
            priority: 'Medium',
            status: 'Todo',
            assignedUser: memberB._id,
          },
        ],
      });

      taskForAId = project.tasks[0]._id.toString();
      taskForBId = project.tasks[1]._id.toString();
    });

    it('should show all tasks to Project Manager', async () => {
      const res = await request(app)
        .get(`/api/projects/${project._id}`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBe(2);
    });

    it('should ONLY return tasks assigned to Team Member A when requested by Team Member A', async () => {
      const res = await request(app)
        .get(`/api/projects/${project._id}`)
        .set('Authorization', `Bearer ${memberAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.tasks.length).toBe(1);
      expect(res.body.tasks[0]._id.toString()).toBe(taskForAId);
      expect(res.body.tasks[0].title).toBe("Alice's Assigned Task");
    });

    it('should allow Team Member A to update the status of their assigned task', async () => {
      const res = await request(app)
        .put(`/api/projects/${project._id}/tasks/${taskForAId}`)
        .set('Authorization', `Bearer ${memberAToken}`)
        .send({
          status: 'Completed',
        });

      expect(res.status).toBe(200);
      const updatedTask = res.body.tasks.find((t: any) => t._id.toString() === taskForAId);
      expect(updatedTask.status).toBe('Completed');
    });

    it('should reject Team Member A attempting to edit Team Member B task with 403', async () => {
      const res = await request(app)
        .put(`/api/projects/${project._id}/tasks/${taskForBId}`)
        .set('Authorization', `Bearer ${memberAToken}`)
        .send({
          status: 'Completed',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/only edit tasks assigned to you/i);
    });

    it('should forbid Team Member A from reassigning their task to another user', async () => {
      const res = await request(app)
        .put(`/api/projects/${project._id}/tasks/${taskForAId}`)
        .set('Authorization', `Bearer ${memberAToken}`)
        .send({
          assignedUser: memberB._id,
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/cannot reassign tasks/i);
    });
  });

  describe('Task Comments & Archiving', () => {
    let project: any;
    let taskId: string;

    beforeEach(async () => {
      project = await Project.create({
        name: 'Comments Project',
        description: 'Testing comment features',
        status: 'In Progress',
        manager: pmUser._id,
        members: [memberA._id],
        tasks: [
          {
            title: 'Task with comments',
            priority: 'Medium',
            status: 'Todo',
            assignedUser: memberA._id,
          },
        ],
      });

      taskId = project.tasks[0]._id.toString();
    });

    it('should allow assigned member to add a comment to their task', async () => {
      const res = await request(app)
        .post(`/api/projects/${project._id}/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${memberAToken}`)
        .send({
          text: 'Finished the initial implementation!',
        });

      expect(res.status).toBe(201);
      const task = res.body.tasks.find((t: any) => t._id.toString() === taskId);
      expect(task.comments.length).toBe(1);
      expect(task.comments[0].text).toBe('Finished the initial implementation!');
    });

    it('should allow Project Manager to archive and unarchive a project', async () => {
      const archiveRes = await request(app)
        .put(`/api/projects/${project._id}/archive`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.isArchived).toBe(true);

      const unarchiveRes = await request(app)
        .put(`/api/projects/${project._id}/unarchive`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(unarchiveRes.status).toBe(200);
      expect(unarchiveRes.body.isArchived).toBe(false);
    });
  });
});
