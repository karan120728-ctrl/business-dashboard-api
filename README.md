Business Dashboard API
📌 Overview

Business Dashboard API is a scalable, production-ready backend system designed to manage core business operations such as users, customers, products, and orders.
It includes secure authentication, role-based authorization, soft delete, pagination, and advanced sales analytics, making it suitable for real-world business applications.

This project is built to demonstrate professional backend development standards and can be easily integrated with any frontend or admin dashboard.

🚀 Key Features
🔐 Authentication & Authorization

JWT-based authentication

Role-based access control (Admin / User)

Secure password hashing using bcrypt

👥 User Management

User registration & login

Admin-only protected routes

Secure user listing (passwords excluded)

🧑‍🤝‍🧑 Customer Management

Create, update, and soft-delete customers

Restore deleted customers (admin only)

Pagination & search support

📦 Product Management

Create, update, delete & restore products

Soft delete for data safety

Search and pagination support

🧾 Order Management

Create and view orders

Order status updates (pending, paid, shipped, cancelled)

Role-based order access

Stock handling logic (future-ready)

📊 Sales & Reports

Total orders count

Total revenue calculation

Status-wise order summary

Monthly sales analytics using MongoDB aggregation

🛠️ Tech Stack

Node.js

Express.js

MongoDB & Mongoose

JWT Authentication

Bcrypt

Postman (API Testing)

📂 Project Structure
business-dashboard-api/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middlewares/
│   ├── db/
│   └── app.js
├── postman/
│   └── BusinessDashboardAPI.postman_collection.json
├── .env.example
├── .gitignore
├── package.json
└── README.md

🧪 API Testing (Postman)

A ready-to-use Postman collection is included.

Steps:

Open Postman

Click Import

Select:

postman/BusinessDashboardAPI.postman_collection.json


Set JWT token in Authorization header for protected routes

⚙️ Installation & Setup
git clone https://github.com/karan-120728-ctrl/business-dashboard-api.git
cd business-dashboard-api
npm install
cp .env.example .env
npm run dev

🌱 Environment Variables

Create a .env file using .env.example:

PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/business-dashboard
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=1d

🎯 Use Cases

Admin dashboards

E-commerce backend

Business analytics systems

SaaS backend foundation

👨‍💻 Author

Karan
Backend Developer (Node.js & MongoDB)