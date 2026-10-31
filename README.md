# CollabHub - Production-Grade Team Collaboration Platform

CollabHub is an enterprise-grade, real-time team collaboration and project management platform inspired by Jira and Linear. It provides teams with a centralized workspace to manage projects, coordinate task workflows via interactive Kanban boards, upload file attachments, comment on progress, receive real-time notifications, and view visual productivity analytics.

---

## 🚀 Key Features

* **Role-Based Access Control (RBAC)**: Fine-grained authorization for **Admin**, **Project Manager**, and **Team Member** roles with JWT authentication and secure bcrypt password hashing.
* **Personal Task Scoping**: Team members strictly view and update only the tasks assigned to them, enforced at both the API controller layer and UI Kanban columns. Admins and Project Managers retain full workspace visibility.
* **Interactive Kanban Board**: HTML5 native drag-and-drop workflow across customizable columns (*To Do, In Progress, In Review, Completed*).
* **Real-time Live Sync**: Powered by Socket.IO with authenticated handshakes. Task movements, comments, file uploads, and notification indicators update instantly across all connected screens.
* **Redis Caching & Distributed Presence**: Fault-tolerant query caching (`ioredis`) for high-traffic endpoints with automatic cache invalidation and distributed user online presence tracking (with seamless in-memory fallback).
* **Project Analytics & Charts**: Rich visual reports powered by Recharts:
  * **Completion Progress**: Donut chart illustrating the ratio of completed vs. pending tasks.
  * **Task Status Distribution**: Pie chart breaking down tasks across status stages.
  * **Team Member Productivity**: Stacked bar chart showing completed and pending tasks per member.
* **File Attachments**: Upload PDFs, documents, or images to tasks via Multer with Cloudinary cloud storage and local disk fallback.
* **Automated Testing Suite**: 24 Jest integration test cases using `mongodb-memory-server` and Supertest covering authentication, RBAC authorization, personal task scoping, and notifications.
* **Containerized Deployment**: Multi-stage production Dockerfiles for frontend and backend with a complete 4-service Docker Compose orchestration stack (MongoDB + Redis + Backend + Frontend).

---

## 🛠️ Technology Stack

### Frontend Client
* **Framework**: Next.js 15 (App Router) with React 19
* **Language**: TypeScript
* **Styling**: Tailwind CSS v4 & Lucide Icons
* **State & Real-Time**: React Context API (`AuthProvider`) & Socket.IO Client
* **Data Visualization**: Recharts
* **HTTP Client**: Axios

### Backend Server
* **Runtime**: Node.js & Express.js
* **Language**: TypeScript (`tsc` compilation)
* **Database**: MongoDB with Mongoose ODM
* **Cache & Presence**: Redis (`ioredis`) with graceful fallback
* **Real-Time Engine**: Socket.IO with JWT handshake authentication
* **File Storage**: Multer & Cloudinary SDK
* **Testing**: Jest, `ts-jest`, Supertest, `mongodb-memory-server`

### Infrastructure & DevOps
* **Containerization**: Docker (multi-stage standalone builds)
* **Orchestration**: Docker Compose with health checks and persistent named volumes

---

## 💻 Quick Start & Setup

### Option A: Running with Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/pawan0171/TEAM-COLLABORATION-PLATFORM.git
   cd TEAM-COLLABORATION-PLATFORM
   ```

2. Copy the Docker environment template:
   ```bash
   cp .env.docker.example .env
   ```

3. Start the entire containerized stack:
   ```bash
   docker compose up --build
   ```

* **Frontend**: `http://localhost:3000`
* **Backend API**: `http://localhost:5000`
* **MongoDB**: `localhost:27017`
* **Redis**: `localhost:6379`

---

### Option B: Local Development Setup

#### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v20+ recommended)
* [MongoDB](https://www.mongodb.com/) (running on `localhost:27017` or MongoDB Atlas URI)
* [Redis](https://redis.io/) (optional, system automatically falls back to in-memory)

#### 2. Backend Setup
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/team_collaboration
JWT_SECRET=your_super_secret_jwt_key
REDIS_URL=redis://localhost:6379
# Optional Cloudinary credentials
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Run in development mode:
```bash
npm run dev
```

Run automated tests:
```bash
npm test
```

Build for production:
```bash
npm run build
npm start
```

#### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

Start the Next.js development server:
```bash
npm run dev
```

Build and test production output:
```bash
npm run build
npm start
```

The frontend will be live at `http://localhost:3000`.

---

## 📂 Project Structure

```
├── .env.docker.example        # Docker Compose environment template
├── docker-compose.yml         # 4-service orchestration (Mongo, Redis, API, Web)
│
├── backend/
│   ├── Dockerfile             # Multi-stage production container build
│   ├── jest.config.js         # Jest testing configuration
│   ├── tsconfig.json          # TypeScript compiler configuration
│   └── src/
│       ├── config/            # DB, Redis, and Cloudinary clients
│       ├── controllers/       # Business logic (auth, project, user, notification)
│       ├── middleware/        # JWT protect, RBAC authorize, file upload, error handling
│       ├── models/            # Mongoose schemas (User, Project, Notification)
│       ├── routes/            # REST API endpoints
│       ├── tests/             # 24 automated integration test suites
│       ├── types/             # Global TypeScript type definitions
│       └── server.ts          # Express server with Socket.IO & Redis presence
│
└── frontend/
    ├── Dockerfile             # Next.js standalone multi-stage container build
    ├── next.config.mjs        # Next.js configuration (standalone output)
    ├── tsconfig.json          # Frontend TypeScript configuration
    └── src/
        ├── app/               # Next.js 15 App Router pages & layouts
        │   ├── layout.tsx     # Root layout with AuthProvider & Navbar
        │   ├── page.tsx       # Protected dashboard with project stats & filters
        │   ├── login/         # Authentication login route
        │   ├── register/      # User onboarding route with role selection
        │   ├── admin/         # Admin console for user role management
        │   └── projects/[id]/ # Dynamic project workspace (Kanban, drag-drop, analytics)
        ├── components/        # Reusable typed UI components (Modals, Navbar, Guards)
        ├── context/           # Centralized AuthContext & Socket.IO client
        ├── services/          # Axios HTTP instance with JWT interceptors
        └── types/             # Frontend TypeScript interfaces and models
```

---

## 🔒 Security & Data Privacy

* **Strict Server-Side Scoping**: Team members are confined to their assigned tasks at the API layer via `projectForUser()`, ensuring hidden data cannot be queried via API inspection.
* **Decoupled RBAC**: Route actions (project creation, task assignment, role updates, archiving) require specific permissions verified through Express middleware.
* **Socket Handshake Verification**: WebSocket connections require verified JWT tokens before granting access to personal and workspace rooms.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
