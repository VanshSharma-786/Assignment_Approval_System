const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Department = require('../models/Department');
const Assignment = require('../models/Assignment');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');

const isAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.session.loginError = 'Please log in to access the admin dashboard.';
  res.redirect('/auth/login');
};

router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const departmentCount = await Department.count();
    const studentCount = await User.count({ where: { role: 'student' } });
    const professorCount = await User.count({ where: { role: 'professor' } });
    const hodCount = await User.count({ where: { role: 'hod' } });

    res.render('admin-dashboard', {
      user: req.session.user,
      counts: {
        departments: departmentCount,
        students: studentCount,
        professors: professorCount,
        hods: hodCount
      }
    });
  } catch (error) {
    console.error('Dashboard load error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

router.get('/departments', isAdmin, async (req, res) => {
  try {
    const departments = await Department.findAll({
      attributes: [
        'id',
        'name',
        'type',
        'address',
        [
          sequelize.literal('(SELECT COUNT(*) FROM Users WHERE Users.departmentId = Department.id)'),
          'userCount'
        ]
      ],
      order: [['createdAt', 'DESC']]
    });
    const success = req.session.successMessage || null;
    req.session.successMessage = null;
    const error = req.session.errorMessage || null;
    req.session.errorMessage = null;
    res.render('departments-list', { user: req.session.user, departments, success, error });
  } catch (error) {
    console.error('Error loading departments:', error);
    res.status(500).send('Error loading departments');
  }
});

router.get('/departments/create', isAdmin, (req, res) => {
  const error = req.session.createError || null;
  req.session.createError = null;
  res.render('create-department', { user: req.session.user, error });
});

router.post('/departments/create', isAdmin, async (req, res) => {
  const { name, type, address } = req.body;

  if (!name || !type || !address) {
    req.session.createError = 'All fields are required.';
    return res.redirect('/admin/departments/create');
  }

  const validTypes = ['UG', 'PG', 'Research'];
  if (!validTypes.includes(type)) {
    req.session.createError = 'Invalid Program Type.';
    return res.redirect('/admin/departments/create');
  }

  try {
    const existingDept = await Department.findOne({ where: { name: name.trim() } });
    if (existingDept) {
      req.session.createError = 'A department with this name already exists.';
      return res.redirect('/admin/departments/create');
    }

    await Department.create({
      name: name.trim(),
      type,
      address: address.trim()
    });

    req.session.successMessage = 'Department created successfully.';
    res.redirect('/admin/departments');
  } catch (error) {
    console.error('Department creation error:', error);
    req.session.createError = 'An error occurred. Please try again.';
    res.redirect('/admin/departments/create');
  }
});

router.get('/departments/edit/:id', isAdmin, async (req, res) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) {
      req.session.errorMessage = 'Department not found.';
      return res.redirect('/admin/departments');
    }
    const error = req.session.editError || null;
    req.session.editError = null;
    res.render('edit-department', { user: req.session.user, department, error });
  } catch (error) {
    console.error('Error loading edit form:', error);
    res.status(500).send('Error loading edit form');
  }
});

router.post('/departments/:id/update', isAdmin, async (req, res) => {
  const { name, type, address } = req.body;
  const id = req.params.id;

  if (!name || !type || !address) {
    req.session.editError = 'All fields are required.';
    return res.redirect(`/admin/departments/edit/${id}`);
  }

  const validTypes = ['UG', 'PG', 'Research'];
  if (!validTypes.includes(type)) {
    req.session.editError = 'Invalid Program Type.';
    return res.redirect(`/admin/departments/edit/${id}`);
  }

  try {
    const department = await Department.findByPk(id);
    if (!department) {
      req.session.errorMessage = 'Department not found.';
      return res.redirect('/admin/departments');
    }

    const duplicateDept = await Department.findOne({
      where: {
        name: name.trim(),
        id: { [Op.ne]: id }
      }
    });

    if (duplicateDept) {
      req.session.editError = 'A department with this name already exists.';
      return res.redirect(`/admin/departments/edit/${id}`);
    }

    department.name = name.trim();
    department.type = type;
    department.address = address.trim();
    await department.save();

    req.session.successMessage = 'Department updated successfully.';
    res.redirect('/admin/departments');
  } catch (error) {
    console.error('Department update error:', error);
    req.session.editError = 'An error occurred. Please try again.';
    res.redirect(`/admin/departments/edit/${id}`);
  }
});

router.post('/departments/delete/:id', isAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    const userCount = await User.count({ where: { departmentId: id } });
    if (userCount > 0) {
      req.session.errorMessage = 'Cannot delete department. There are users associated with it.';
      return res.redirect('/admin/departments');
    }

    const department = await Department.findByPk(id);
    if (!department) {
      req.session.errorMessage = 'Department not found.';
      return res.redirect('/admin/departments');
    }

    await department.destroy();
    req.session.successMessage = 'Department deleted successfully.';
    res.redirect('/admin/departments');
  } catch (error) {
    console.error('Department deletion error:', error);
    req.session.errorMessage = 'An error occurred while deleting the department.';
    res.redirect('/admin/departments');
  }
});

router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      include: [{ model: Department, as: 'department', attributes: ['name'] }],
      order: [['createdAt', 'DESC']]
    });
    const departments = await Department.findAll({ attributes: ['id', 'name'] });
    const success = req.session.successMessage || null;
    req.session.successMessage = null;
    const error = req.session.errorMessage || null;
    req.session.errorMessage = null;
    res.render('users-list', { user: req.session.user, users, departments, success, error });
  } catch (error) {
    console.error('Error loading users:', error);
    res.status(500).send('Error loading users');
  }
});

router.get('/users/add', isAdmin, async (req, res) => {
  try {
    const departments = await Department.findAll({ attributes: ['id', 'name'] });
    const error = req.session.createError || null;
    req.session.createError = null;
    res.render('create-user', { user: req.session.user, departments, error });
  } catch (error) {
    console.error('Error loading create user form:', error);
    res.status(500).send('Error loading form');
  }
});

router.post('/users/create', isAdmin, async (req, res) => {
  const { name, email, password, phone, departmentId, role } = req.body;

  if (!name || !email || !password || !role) {
    req.session.createError = 'Name, Email, Password, and Role are required fields.';
    return res.redirect('/admin/users/add');
  }

  const validRoles = ['student', 'professor', 'hod'];
  if (!validRoles.includes(role)) {
    req.session.createError = 'Invalid Role selected.';
    return res.redirect('/admin/users/add');
  }

  try {
    const existingUser = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      req.session.createError = 'A user with this email already exists.';
      return res.redirect('/admin/users/add');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone ? phone.trim() : null,
      departmentId: departmentId ? parseInt(departmentId) : null,
      role
    });

    req.session.successMessage = 'User account created successfully.';
    res.redirect('/admin/users');
  } catch (error) {
    console.error('User creation error:', error);
    req.session.createError = 'An error occurred. Please try again.';
    res.redirect('/admin/users/add');
  }
});

router.get('/users/edit/:id', isAdmin, async (req, res) => {
  try {
    const targetUser = await User.findByPk(req.params.id);
    if (!targetUser) {
      req.session.errorMessage = 'User not found.';
      return res.redirect('/admin/users');
    }
    const departments = await Department.findAll({ attributes: ['id', 'name'] });
    const error = req.session.editError || null;
    req.session.editError = null;
    res.render('edit-user', { user: req.session.user, targetUser, departments, error });
  } catch (error) {
    console.error('Error loading edit user form:', error);
    res.status(500).send('Error loading form');
  }
});

router.post('/users/:id/update', isAdmin, async (req, res) => {
  const { name, email, phone, departmentId, password } = req.body;
  const id = req.params.id;

  if (!name || !email) {
    req.session.editError = 'Name and Email are required.';
    return res.redirect(`/admin/users/edit/${id}`);
  }

  try {
    const targetUser = await User.findByPk(id);
    if (!targetUser) {
      req.session.errorMessage = 'User not found.';
      return res.redirect('/admin/users');
    }

    const duplicateUser = await User.findOne({
      where: {
        email: email.toLowerCase().trim(),
        id: { [Op.ne]: id }
      }
    });

    if (duplicateUser) {
      req.session.editError = 'A user with this email already exists.';
      return res.redirect(`/admin/users/edit/${id}`);
    }

    targetUser.name = name.trim();
    targetUser.email = email.toLowerCase().trim();
    targetUser.phone = phone ? phone.trim() : null;
    targetUser.departmentId = departmentId ? parseInt(departmentId) : null;

    if (password && password.trim() !== '') {
      targetUser.password = await bcrypt.hash(password, 10);
    }

    await targetUser.save();

    req.session.successMessage = 'User account updated successfully.';
    res.redirect('/admin/users');
  } catch (error) {
    console.error('User update error:', error);
    req.session.editError = 'An error occurred. Please try again.';
    res.redirect(`/admin/users/edit/${id}`);
  }
});

router.post('/users/delete/:id', isAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    const targetUser = await User.findByPk(id);
    if (!targetUser) {
      req.session.errorMessage = 'User not found.';
      return res.redirect('/admin/users');
    }

    if (targetUser.role === 'student') {
      const pendingCount = await Assignment.count({
        where: {
          studentId: id,
          status: 'pending'
        }
      });

      if (pendingCount > 0) {
        req.session.errorMessage = 'Cannot delete user. Student has pending assignment submissions.';
        return res.redirect('/admin/users');
      }
    }

    await targetUser.destroy();
    req.session.successMessage = 'User account deleted successfully.';
    res.redirect('/admin/users');
  } catch (error) {
    console.error('User deletion error:', error);
    req.session.errorMessage = 'An error occurred while deleting the user.';
    res.redirect('/admin/users');
  }
});

module.exports = router;
