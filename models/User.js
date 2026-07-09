const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'student',
    allowNull: false
  },
  departmentId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

User.prototype.validPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const Department = require('./Department');
const Assignment = require('./Assignment');
const Notification = require('./Notification');
User.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
Department.hasMany(User, { foreignKey: 'departmentId', as: 'users' });

User.hasMany(Assignment, { foreignKey: 'studentId', as: 'assignments' });
Assignment.belongsTo(User, { foreignKey: 'studentId', as: 'student' });

User.hasMany(Assignment, { foreignKey: 'reviewerId', as: 'reviewedAssignments' });
Assignment.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = User;
