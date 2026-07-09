const { connectDB } = require('./config/db');
const User = require('./models/User');
const bcrypt = require('bcrypt');

const updateStudent = async () => {
  await connectDB();

  const student = await User.findOne({ where: { role: 'student' } });
  if (!student) {
    console.log('Student user not found in DB!');
    process.exit(1);
  }

  const newEmail = 'vansh1567.be23@chitkarauniversity.edu.in';
  const newPasswordRaw = 'Vansh@34716';
  const hashedPassword = await bcrypt.hash(newPasswordRaw, 10);

  student.email = newEmail;
  student.password = hashedPassword;
  await student.save();

  console.log('Student updated successfully!');
  console.log(`New Email: ${student.email}`);
  console.log(`Role: ${student.role}`);

  process.exit(0);
};

updateStudent();
