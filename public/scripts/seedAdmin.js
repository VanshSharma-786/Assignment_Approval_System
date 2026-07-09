const { connectDB } = require('../../config/db');
const User = require('../../models/User');
const Department = require('../../models/Department');
const Assignment = require('../../models/Assignment');
const Notification = require('../../models/Notification');
const bcrypt = require('bcryptjs');
require('dotenv').config({ override: true });

const seedAdmin = async () => {
  try {
    let adminEmail = process.env.ADMIN_EMAIL || 'admin@university.edu';
    let adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    let studentEmail = process.env.STUDENT_EMAIL || 'student1@university.edu';
    let studentPassword = process.env.STUDENT_PASSWORD || 'StudentPassword123';
    
    let professorEmail = 'professor@university.edu';
    let professorPassword = 'Professor@123';
    let hodEmail = 'hod@university.edu';
    let hodPassword = 'Hod@123';

    await connectDB();

    const saltRounds = 10;
    const hashedAdminPassword = await bcrypt.hash(adminPassword, saltRounds);
    const hashedStudentPassword = await bcrypt.hash(studentPassword, saltRounds);
    const hashedProfessorPassword = await bcrypt.hash(professorPassword, saltRounds);
    const hashedHodPassword = await bcrypt.hash(hodPassword, saltRounds);

    // Clean up assignments, notifications, departments and existing users
    await Assignment.destroy({ where: {} });
    await Notification.destroy({ where: {} });
    await Department.destroy({ where: {} });
    await User.destroy({ where: {} });

    // Seed default department
    const csDept = await Department.create({
      name: 'Computer Science',
      type: 'UG',
      address: 'Block A, Main Campus'
    });

    // Seed administrator
    await User.create({
      email: adminEmail.toLowerCase().trim(),
      password: hashedAdminPassword,
      role: 'admin',
      name: 'Administrator',
      phone: '+1 (555) 000-0000'
    });

    // Seed student
    await User.create({
      email: studentEmail.toLowerCase().trim(),
      password: hashedStudentPassword,
      role: 'student',
      name: 'Vansh Sharma',
      phone: '+1 (555) 010-1000',
      departmentId: csDept.id
    });

    // Seed professor
    await User.create({
      email: professorEmail.toLowerCase().trim(),
      password: hashedProfessorPassword,
      role: 'professor',
      name: 'Dr. Ramesh Kumar',
      phone: '+1 (555) 020-2000',
      departmentId: csDept.id
    });

    // Seed HOD
    await User.create({
      email: hodEmail.toLowerCase().trim(),
      password: hashedHodPassword,
      role: 'hod',
      name: 'Dr. Sunita Sharma (HOD)',
      phone: '+1 (555) 030-3000',
      departmentId: csDept.id
    });

    console.log('--------------------------------------------------');
    console.log('Database successfully seeded and cleaned!');
    console.log(`Admin Email: ${adminEmail} (Password: ${adminPassword})`);
    console.log(`Student Email: ${studentEmail} (Password: ${studentPassword})`);
    console.log(`Professor Email: ${professorEmail} (Password: ${professorPassword})`);
    console.log(`HOD Email: ${hodEmail} (Password: ${hodPassword})`);
    console.log('Default "Computer Science" department created.');
    console.log('--------------------------------------------------\n');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed database:', error);
    process.exit(1);
  }
};

seedAdmin();
