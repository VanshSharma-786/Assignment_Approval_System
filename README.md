# University Assignment Approval System

**University Assignment Approval & Tracking Platform** built with **Node.js, Express, EJS, and SQLite (via Sequelize)**. It facilitates a smooth digital workflow for submitting, reviewing, forwarding, and signing academic assignments, catering to four distinct roles: Students, Professors, HODs, and Administrators.

---

## 🌟 Key Features

### 👤 Role-based Access Control
- **Student Dashboard**: 
  - Upload assignments (PDF format) with detailed description & category.
  - Track live submission status (Draft, Submitted, Approved, Rejected).
  - Resubmit rejected assignments with revised notes and files.
  - View full approval/rejection timeline history.
- **Professor Portal**:
  - Review student submissions with inline PDF preview.
  - Approve assignments with remarks and digital signature (upload signature image or generate secure text hash signature).
  - Reject assignments back to student for revision.
  - Forward submissions to other professors/HODs inside the department.
- **HOD Dashboard**:
  - Perform all reviewer actions (approvals, rejections, forwarding).
  - Full management of assignments inside their department.
- **Admin Control Panel**:
  - Manage Departments (Create, Read, Update, Delete departments).
  - Manage User Accounts (Add students, professors, HODs, assign departments, reset passwords).

### 🎨 Design & Accessibility
- **Modern Dark & Light Mode**: Auto HSL-based theme switching honoring browser preferences.
- **Responsive Layout**: Designed for mobile, tablet, and desktop views.
- **Interactive UI Components**: Glassmorphism visual cues, custom CSS micro-animations, SVG input visibility toggles (eye icon), and accessible keyboard controls.

---

## 🛠️ Technology Stack

- **Core**: Node.js & Express.js
- **Database**: SQLite3 with Sequelize ORM
- **Authentication**: Express Session based secure sessions
- **UI Engine**: EJS (Embedded JavaScript) Templating & Vanilla CSS

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory of the project:
```env
PORT=3000
SESSION_SECRET=your_session_secret_key
DATABASE_URL=sqlite:./database.sqlite
```

### 3. Initialize & Seed Database
Run the seeding script to create the initial database tables and seed test accounts (Admin, Student, Professor, HOD). 

*Note: The generated test emails and passwords will be printed directly in your terminal console.*
```bash
npm run seed
```

### 4. Run the Application
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🔄 System Workflow

Here is how the assignment approval and tracking process works in **Projectfy**:

### 1. Setup & User Management (Admin)
- The **Administrator** logs in to manage university departments and register users.
- They create profiles for **Students**, **Professors**, and **HODs**, assigning them to their respective academic departments.

### 2. Assignment Submission (Student)
- A **Student** uploads an assignment (PDF format), specifies details like Title, Description, and Category, and selects their respective subject **Professor** for review.
- The student can track the approval status of their submission in real-time on their dashboard.

### 3. Review & Verification (Professor)
- The designated **Professor** receives the submission, views the assignment details, and previews the uploaded PDF directly in their browser.
- **Actions available to the Professor:**
  - **Approve**: Provide remarks and digitally sign the assignment (by uploading a signature image or generating a secure digital hash signature).
  - **Reject**: Return the assignment to the student for modifications with feedback.
  - **Forward**: Forward the submission to another Professor or the HOD within the department for verification.

### 4. Departmental Oversight (HOD)
- The **HOD (Head of Department)** monitors all submissions in their department.
- They have authority to approve, reject, or forward assignments, completing the departmental workflow.

---

## 📁 Project Directory Structure
```text
PROJECTFY/
├── config/              # Database connections
├── models/              # Sequelize database schemas (User, Department, Assignment, etc.)
├── public/              # Static assets (CSS styles, frontend JavaScript scripts, uploads)
├── routes/              # Express API and web routing (auth, admin, student, professor)
├── views/               # EJS template views for rendering UI pages
├── .env                 # Environment config file
├── database.sqlite      # SQLite database file (ignored/generated at run)
├── package.json         # Node.js project meta & dependencies
└── server.js            # Main entry point of the server
```
