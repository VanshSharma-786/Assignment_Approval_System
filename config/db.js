const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
require('dotenv').config();

const isVercel = !!process.env.VERCEL;
const tmpDir = process.env.TMPDIR || '/tmp';
const databasePath = isVercel
  ? path.join(tmpDir, 'database.sqlite')
  : path.join(__dirname, '..', 'database.sqlite');

if (isVercel) {
  const databaseDir = path.dirname(databasePath);
  if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
  }
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: databasePath,
  logging: false,
  dialectModule: sqlite3
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`SQLite database connected successfully at ${databasePath}`);
    await sequelize.sync();

    const User = require('../models/User');
    const userCount = await User.count();

    if (userCount === 0) {
      console.log('Database is empty. Running automatic self-seed...');
      const Department = require('../models/Department');
      const bcrypt = require('bcrypt');

      const saltRounds = 10;
      const hashedAdminPassword = await bcrypt.hash('Admin@123', saltRounds);
      const hashedStudentPassword = await bcrypt.hash('StudentPassword123', saltRounds);
      const hashedProfessorPassword = await bcrypt.hash('Professor@123', saltRounds);
      const hashedHodPassword = await bcrypt.hash('Hod@123', saltRounds);

      const csDept = await Department.create({
        name: 'Computer Science',
        type: 'UG',
        address: 'Block A, Main Campus'
      });

      await User.create({
        email: 'admin@university.edu',
        password: hashedAdminPassword,
        role: 'admin',
        name: 'Administrator',
        phone: '+1 (555) 000-0000'
      });

      await User.create({
        email: 'student1@university.edu',
        password: hashedStudentPassword,
        role: 'student',
        name: 'Vansh Sharma',
        phone: '+1 (555) 010-1000',
        departmentId: csDept.id
      });

      await User.create({
        email: 'professor@university.edu',
        password: hashedProfessorPassword,
        role: 'professor',
        name: 'Dr. Ramesh Kumar',
        phone: '+1 (555) 020-2000',
        departmentId: csDept.id
      });

      await User.create({
        email: 'hod@university.edu',
        password: hashedHodPassword,
        role: 'hod',
        name: 'Dr. Sunita Sharma (HOD)',
        phone: '+1 (555) 030-3000',
        departmentId: csDept.id
      });

      console.log('Database successfully self-seeded on startup!');
    }
  } catch (error) {
    console.error('Unable to connect to the SQLite database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
