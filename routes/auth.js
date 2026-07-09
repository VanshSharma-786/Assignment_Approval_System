const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.get('/login', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else if (req.session.user.role === 'student') {
      return res.redirect('/student/dashboard');
    } else if (req.session.user.role === 'professor') {
      return res.redirect('/professor/dashboard');
    } else if (req.session.user.role === 'hod') {
      return res.redirect('/professor/dashboard');
    }
  }
  
  const error = req.session.loginError || null;
  req.session.loginError = null;
  res.render('login', { error });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.session.loginError = 'Please fill in all fields.';
    return res.redirect('/auth/login');
  }

  try {
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      req.session.loginError = 'Invalid email or password.';
      return res.redirect('/auth/login');
    }

    const isMatch = await user.validPassword(password);
    if (!isMatch) {
      req.session.loginError = 'Invalid email or password.';
      return res.redirect('/auth/login');
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name || 'User',
      role: user.role,
      departmentId: user.departmentId
    };

    if (user.role === 'admin') {
      res.redirect('/admin/dashboard');
    } else if (user.role === 'student') {
      res.redirect('/student/dashboard');
    } else if (user.role === 'professor') {
      res.redirect('/professor/dashboard');
    } else if (user.role === 'hod') {
      res.redirect('/professor/dashboard');
    }
  } catch (error) {
    console.error('Login error:', error);
    req.session.loginError = 'An internal error occurred. Please try again.';
    res.redirect('/auth/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/auth/login');
  });
});

module.exports = router;
