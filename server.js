const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config({ override: true });

const fs = require('fs');
const { connectDB } = require('./config/db');

const uploadDir = process.env.VERCEL
  ? path.join(process.env.TMPDIR || '/tmp', 'uploads')
  : path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const professorRoutes = require('./routes/professor');

const app = express();

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
if (uploadDir) {
  app.use('/uploads', express.static(uploadDir));
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'university-assignment-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 2,
    secure: false,
    httpOnly: true
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/student', studentRoutes);
app.use('/professor', professorRoutes);

app.get('/', (req, res) => {
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
  res.redirect('/auth/login');
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong on the server!');
});

if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
  });
}

module.exports = app;
