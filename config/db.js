const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
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
  logging: false
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`SQLite database connected successfully at ${databasePath}`);
    await sequelize.sync();
  } catch (error) {
    console.error('Unable to connect to the SQLite database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
