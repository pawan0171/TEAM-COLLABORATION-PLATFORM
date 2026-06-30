# CollabHub - Team Collaboration Platform

CollabHub is a real-time, responsive team collaboration and project management platform inspired by Jira and Asana. It provides teams with a centralized workspace to manage projects, coordinate task workflows, upload file attachments, comment on progress, receive real-time notifications, and view project productivity analytics.

## 🚀 Key Features

* **JWT Authentication & Authorization**: Secure user registration and login with Role-Based Access Control (Admin, Project Manager, and Team Member).
* **Project Workspace Management**: Create, edit, delete, and archive projects. Admins can assign Project Managers, and Managers can invite Team Members.
* **Interactive Kanban Board**: HTML5 native drag-and-drop card interface to move tasks across workflows (*To Do, In Progress, In Review, Completed*).
* **Real-time Live Sync**: Powered by Socket.io. Task movements, comments, file uploads, and notification indicators update instantly across all connected screens.
* **Interactive Analytics & Charts**: Rich visual reports powered by Recharts:
  * **Completion Progress**: A donut chart illustrating the ratio of completed vs. pending tasks.
  * **Task Status Distribution**: A pie chart showing the absolute status breakdown.
  * **Team Member Productivity**: A stacked bar chart showing completed and pending tasks assigned to each team member.
* **File Attachments**: Upload PDFs, documents, or images to tasks via Multer and Cloudinary (with a fail-safe local storage fallback).
* **Collapsible & Filterable Panels**: Search tasks by name, filter by priority, or hide sidebar components to maximize board visibility.

---

## 🛠️ Technology Stack

### Frontend Client
* **Framework**: React.js (Vite environment)
* **Styling**: Tailwind CSS v4
* **State Management**: React Context API (Auth, Sockets, and Notification queues)
* **Charts**: Recharts
* **Icons**: Lucide Icons
* **Real-Time Client**: Socket.io Client
* **HTTP Client**: Axios

### Backend Server
* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: MongoDB (Mongoose ODM)
* **Real-Time Server**: Socket.io
* **File Processing**: Multer & Cloudinary SDK
* **Security**: JSON Web Tokens (JWT) & bcryptjs password hashing

---

## 💻 Installation & Local Setup

### Prerequisites
* [Node.js](https://nodejs.org/) (v16+ recommended)
* [MongoDB](https://www.mongodb.com/) (Local server or MongoDB Atlas URI)

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd TEAM-COLLABORATION-PLATFORM
```

### 2. Configure the Backend Server
Navigate to the `backend` folder, install dependencies, and set up your `.env` configuration file:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/collabhub
JWT_SECRET=your_jwt_super_secret_key
# Optional: Cloudinary configuration for cloud uploads. If left blank, uploads will save locally in backend/uploads/
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Start the backend server in development mode:
```bash
npm run dev
```
The backend server will run at `http://localhost:5000`.

### 3. Configure the Frontend Client
Navigate to the `frontend` folder, install dependencies, and start the development server:

```bash
cd ../frontend
npm install
npm run dev
```
The frontend client will start at `http://localhost:5173`.

---

## 📂 Folder Structure

```
├── backend/
│   ├── config/            # Database and Cloudinary settings
│   ├── controllers/       # MVC Controllers (auth, projects, users)
│   ├── middleware/        # JWT auth verify and Multer upload settings
│   ├── models/            # Mongoose schemas (User, Project)
│   ├── routes/            # Express API endpoint definitions
│   ├── uploads/           # Fail-safe local files storage folder
│   ├── server.js          # Server entry point with Socket.io setup
│   └── package.json
│
├── frontend/
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # Reusable UI elements (Navbar, Modals)
│   │   ├── context/       # Auth and Real-time Socket providers
│   │   ├── pages/         # Page layouts (Dashboard, ProjectDetails, AdminPanel)
│   │   ├── services/      # Axios API handler
│   │   ├── App.jsx        # Routing configuration
│   │   ├── index.css      # CSS system with Tailwind v4 setup
│   │   └── main.jsx
│   └── package.json
```

---

## 🔒 License
This project is open-source and available under the [MIT License](LICENSE).
