const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Assignment = require('../models/Assignment');
const Notification = require('../models/Notification');
const Department = require('../models/Department');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = process.env.VERCEL
  ? path.join(process.env.TMPDIR || '/tmp', 'uploads')
  : path.join(__dirname, '..', 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const isStudent = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'student') {
    return next();
  }
  req.session.loginError = 'Please log in as a student to access this page.';
  res.redirect('/auth/login');
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('Only PDF files are allowed.'));
    }
    cb(null, true);
  }
});

router.get('/dashboard', isStudent, async (req, res) => {
  try {
    const studentId = req.session.user.id;
    
    const assignments = await Assignment.findAll({
      where: { studentId },
      order: [['createdAt', 'DESC']]
    });

    const recentSubmissions = assignments.slice(0, 5);

    const stats = {
      draft: assignments.filter(a => a.status.toLowerCase() === 'draft').length,
      submitted: assignments.filter(a => ['submitted', 'forwarded'].includes(a.status.toLowerCase())).length,
      approved: assignments.filter(a => a.status.toLowerCase() === 'approved').length,
      rejected: assignments.filter(a => a.status.toLowerCase() === 'rejected').length
    };

    const successMessage = req.session.successMessage || null;
    req.session.successMessage = null;

    res.render('student-dashboard', {
      user: req.session.user,
      recentSubmissions,
      stats,
      successMessage
    });
  } catch (error) {
    console.error('Error loading student dashboard:', error);
    res.status(500).send('Error loading dashboard');
  }
});

router.get('/assignments/upload', isStudent, (req, res) => {
  const error = req.session.uploadError || null;
  req.session.uploadError = null;
  res.render('upload-assignment', {
    user: req.session.user,
    error
  });
});

router.post('/assignments/upload', isStudent, (req, res) => {
  upload.single('assignmentFile')(req, res, async (err) => {
    if (err) {
      req.session.uploadError = err.message || 'File upload failed.';
      return res.redirect('/student/assignments/upload');
    }

    const { title, description, category } = req.body;
    const file = req.file;

    if (!title || !category || !file) {
      if (file) {
        fs.unlinkSync(file.path);
      }
      req.session.uploadError = 'Title, Category, and PDF File are required.';
      return res.redirect('/student/assignments/upload');
    }

    const validCategories = ['Assignment', 'Thesis', 'Report'];
    if (!validCategories.includes(category)) {
      if (file) {
        fs.unlinkSync(file.path);
      }
      req.session.uploadError = 'Invalid Category. Choose from Assignment, Thesis, or Report.';
      return res.redirect('/student/assignments/upload');
    }

    try {
      const assignment = await Assignment.create({
        title: title.trim(),
        description: description ? description.trim() : '',
        category,
        status: 'Draft',
        filePath: `/uploads/${file.filename}`,
        studentId: req.session.user.id
      });

      req.session.successMessage = `Assignment uploaded successfully as draft. ID: ${assignment.id}`;
      res.redirect('/student/dashboard');
    } catch (error) {
      console.error('Assignment upload database error:', error);
      if (file) {
        fs.unlinkSync(file.path);
      }
      req.session.uploadError = 'An error occurred while saving the assignment to database.';
      res.redirect('/student/assignments/upload');
    }
  });
});

router.get('/assignments/bulk-upload', isStudent, (req, res) => {
  const error = req.session.bulkUploadError || null;
  req.session.bulkUploadError = null;
  res.render('bulk-upload', {
    user: req.session.user,
    error
  });
});

router.post('/assignments/bulk-upload', isStudent, (req, res) => {
  upload.array('assignmentFiles', 5)(req, res, async (err) => {
    if (err) {
      req.session.bulkUploadError = err.message || 'Bulk upload failed.';
      return res.redirect('/student/assignments/bulk-upload');
    }

    const { category, description } = req.body;
    const files = req.files;

    if (!category || !files || files.length === 0) {
      if (files && files.length > 0) {
        files.forEach(f => fs.unlinkSync(f.path));
      }
      req.session.bulkUploadError = 'Category and at least one PDF file are required.';
      return res.redirect('/student/assignments/bulk-upload');
    }

    if (files.length > 5) {
      files.forEach(f => fs.unlinkSync(f.path));
      req.session.bulkUploadError = 'You can upload a maximum of 5 files at once.';
      return res.redirect('/student/assignments/bulk-upload');
    }

    const validCategories = ['Assignment', 'Thesis', 'Report'];
    if (!validCategories.includes(category)) {
      if (files && files.length > 0) {
        files.forEach(f => fs.unlinkSync(f.path));
      }
      req.session.bulkUploadError = 'Invalid Category. Choose from Assignment, Thesis, or Report.';
      return res.redirect('/student/assignments/bulk-upload');
    }

    try {
      const createdAssignments = [];
      for (const file of files) {
        const originalName = path.parse(file.originalname).name;
        const title = originalName.replace(/[-_]/g, ' ').trim();

        const assignment = await Assignment.create({
          title: title || 'Untitled Bulk Assignment',
          description: description ? description.trim() : '',
          category,
          status: 'Draft',
          filePath: `/uploads/${file.filename}`,
          studentId: req.session.user.id
        });
        createdAssignments.push(assignment.toJSON());
      }

      req.session.bulkSummary = {
        category,
        description: description || 'No description provided.',
        assignments: createdAssignments
      };

      res.redirect('/student/assignments/bulk-summary');
    } catch (error) {
      console.error('Bulk upload DB error:', error);
      if (files && files.length > 0) {
        files.forEach(f => fs.unlinkSync(f.path));
      }
      req.session.bulkUploadError = 'An error occurred while saving bulk assignments to database.';
      res.redirect('/student/assignments/bulk-upload');
    }
  });
});

router.get('/assignments/bulk-summary', isStudent, (req, res) => {
  const summary = req.session.bulkSummary;
  if (!summary) {
    return res.redirect('/student/dashboard');
  }
  req.session.bulkSummary = null;

  res.render('bulk-summary', {
    user: req.session.user,
    summary
  });
});

router.get('/assignments', isStudent, async (req, res) => {
  try {
    const studentId = req.session.user.id;

    const student = await User.findByPk(studentId);
    let professors = [];
    if (student && student.departmentId) {
      professors = await User.findAll({
        where: {
          departmentId: student.departmentId,
          role: 'professor'
        },
        attributes: ['id', 'name', 'email']
      });
    } else {
      professors = await User.findAll({
        where: { role: 'professor' },
        attributes: ['id', 'name', 'email']
      });
    }

    const assignments = await Assignment.findAll({
      where: { studentId },
      include: [
        {
          model: User,
          as: 'reviewer',
          attributes: ['name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const successMessage = req.session.successMessage || null;
    req.session.successMessage = null;

    res.render('my-assignments', {
      user: req.session.user,
      assignments,
      professors,
      successMessage
    });
  } catch (error) {
    console.error('Error fetching student assignments:', error);
    res.status(500).send('Error loading assignments list');
  }
});

router.post('/assignments/:id/submit', isStudent, async (req, res) => {
  const { id } = req.params;
  const { reviewerId } = req.body;

  if (!reviewerId) {
    req.session.successMessage = null;
    return res.redirect('/student/assignments');
  }

  try {
    const assignment = await Assignment.findOne({
      where: {
        id,
        studentId: req.session.user.id
      }
    });

    if (!assignment) {
      return res.status(404).send('Assignment not found.');
    }

    if (assignment.status.toLowerCase() !== 'draft') {
      return res.status(400).send('Only draft assignments can be submitted for review.');
    }

    const reviewer = await User.findByPk(reviewerId);
    if (!reviewer || (reviewer.role !== 'professor' && reviewer.role !== 'hod')) {
      return res.status(400).send('Invalid reviewer selected.');
    }

    const history = JSON.parse(assignment.history || '[]');
    const studentName = req.session.user.name || 'Student';
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    history.push({
      status: 'Submitted',
      reviewerName: 'Student',
      remark: 'Submission',
      date: formattedDate,
      signature: studentName.replace(/\s+/g, '')
    });

    assignment.status = 'Submitted';
    assignment.reviewerId = reviewerId;
    assignment.history = JSON.stringify(history);
    await assignment.save();

    const studentNameLog = req.session.user.name || 'A student';
    await Notification.create({
      message: `Assignment "${assignment.title}" has been submitted by ${studentNameLog} for your review.`,
      userId: reviewerId,
      isRead: false
    });

    req.session.successMessage = 'Assignment submitted successfully for review.';
    res.redirect(`/student/assignments/${id}`);
  } catch (error) {
    console.error('Error submitting assignment:', error);
    res.status(500).send('Error submitting assignment for review.');
  }
});

router.get('/assignments/:id', isStudent, async (req, res) => {
  try {
    const studentId = req.session.user.id;
    const { id } = req.params;

    const assignment = await Assignment.findOne({
      where: { id, studentId },
      include: [
        {
          model: User,
          as: 'reviewer',
          attributes: ['name', 'email', 'role'],
          include: [
            {
              model: Department,
              as: 'department',
              attributes: ['name']
            }
          ]
        }
      ]
    });

    if (!assignment) {
      return res.status(404).send('Assignment not found.');
    }

    const student = await User.findByPk(studentId);
    let professors = [];
    if (student && student.departmentId) {
      professors = await User.findAll({
        where: {
          departmentId: student.departmentId,
          role: 'professor'
        },
        attributes: ['id', 'name', 'email']
      });
    } else {
      professors = await User.findAll({
        where: { role: 'professor' },
        attributes: ['id', 'name', 'email']
      });
    }

    const history = JSON.parse(assignment.history || '[]');
    const successMessage = req.session.successMessage || null;
    req.session.successMessage = null;

    const resubmitError = req.session.resubmitError || null;
    req.session.resubmitError = null;

    res.render('assignment-details', {
      user: req.session.user,
      assignment,
      professors,
      history,
      successMessage,
      resubmitError
    });
  } catch (error) {
    console.error('Error loading assignment details:', error);
    res.status(500).send('Error loading assignment details.');
  }
});

router.get('/assignments/:id/download', isStudent, async (req, res) => {
  try {
    const { id } = req.params;
    const { version } = req.query;
    const studentId = req.session.user.id;

    const assignment = await Assignment.findOne({
      where: { id, studentId }
    });

    if (!assignment) {
      return res.status(404).send('Assignment not found.');
    }

    let filePathToDownload = assignment.filePath;

    if (version) {
      const history = JSON.parse(assignment.history || '[]');
      const matchesHistory = history.some(entry => entry.filePath === version);
      if (!matchesHistory) {
        return res.status(403).send('Unauthorized file access.');
      }
      filePathToDownload = version;
    }

    if (!filePathToDownload) {
      return res.status(404).send('File path not defined.');
    }

    const absolutePath = path.join(__dirname, '..', 'public', filePathToDownload);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).send('Physical file does not exist on the server.');
    }

    res.download(absolutePath, path.basename(filePathToDownload));
  } catch (error) {
    console.error('Error serving file download:', error);
    res.status(500).send('Error downloading file.');
  }
});

router.post('/assignments/:id/resubmit', isStudent, (req, res) => {
  upload.single('assignmentFile')(req, res, async (err) => {
    const { id } = req.params;

    if (err) {
      req.session.successMessage = null;
      req.session.resubmitError = err.message || 'File upload failed.';
      return res.redirect(`/student/assignments/${id}`);
    }

    try {
      const assignment = await Assignment.findOne({
        where: { id, studentId: req.session.user.id }
      });

      if (!assignment) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).send('Assignment not found.');
      }

      if (assignment.status.toLowerCase() !== 'rejected') {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).send('Only rejected assignments can be resubmitted.');
      }

      const { description } = req.body;
      const oldFilePath = assignment.filePath;

      if (description && description.trim()) {
        assignment.description = description.trim();
      }

      const history = JSON.parse(assignment.history || '[]');
      const studentName = req.session.user.name || 'Student';
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      history.push({
        status: 'Submitted',
        reviewerName: 'Student',
        remark: `Resubmission: ${description ? description.trim() : 'Updated description/files'}`,
        date: formattedDate,
        signature: studentName.replace(/\s+/g, ''),
        filePath: oldFilePath
      });

      assignment.status = 'Submitted';
      if (req.file) {
        assignment.filePath = `/uploads/${req.file.filename}`;
      }
      assignment.history = JSON.stringify(history);
      await assignment.save();

      if (assignment.reviewerId) {
        await Notification.create({
          message: `Assignment "${assignment.title}" has been resubmitted by ${studentName} for your review.`,
          userId: assignment.reviewerId,
          isRead: false
        });
      }

      req.session.successMessage = 'Assignment resubmitted successfully for review.';
      res.redirect(`/student/assignments/${id}`);
    } catch (error) {
      console.error('Error resubmitting assignment:', error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).send('Error resubmitting assignment.');
    }
  });
});

router.get('/profile', isStudent, (req, res) => {
  res.redirect('/student/dashboard');
});

module.exports = router;
