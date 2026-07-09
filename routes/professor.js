const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const User = require('../models/User');
const Assignment = require('../models/Assignment');
const Notification = require('../models/Notification');
const Department = require('../models/Department');
const uploadDir = process.env.VERCEL
  ? path.join(process.env.TMPDIR || '/tmp', 'uploads')
  : path.join(__dirname, '..', 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
    if (file.mimetype.startsWith('image/') || allowed.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed.'));
  }
});

const isProfessor = (req, res, next) => {
  if (req.session.user && ['professor', 'hod'].includes(req.session.user.role)) {
    return next();
  }
  req.session.loginError = 'Please log in as a reviewer to access this page.';
  res.redirect('/auth/login');
};

router.get('/dashboard', isProfessor, async (req, res) => {
  try {
    const professorId = req.session.user.id;

    const allReviews = await Assignment.findAll({
      where: { reviewerId: professorId }
    });

    const pendingCount = allReviews.filter(a => ['submitted', 'forwarded'].includes(a.status.toLowerCase())).length;
    const approvedCount = allReviews.filter(a => a.status.toLowerCase() === 'approved').length;
    const rejectedCount = allReviews.filter(a => a.status.toLowerCase() === 'rejected').length;
    const totalReviewed = approvedCount + rejectedCount;

    const notifications = await Notification.findAll({
      where: { userId: professorId, isRead: false },
      order: [['createdAt', 'DESC']]
    });

    const pendingAssignments = await Assignment.findAll({
      where: { 
        reviewerId: professorId, 
        status: { [Op.in]: ['Submitted', 'forwarded'] } 
      },
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['name', 'email']
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    const successMessage = req.session.successMessage || null;
    req.session.successMessage = null;

    res.render('professor-dashboard', {
      user: req.session.user,
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total: totalReviewed
      },
      notifications,
      assignments: pendingAssignments,
      successMessage
    });
  } catch (error) {
    console.error('Error loading professor dashboard:', error);
    res.status(500).send('Error loading dashboard');
  }
});

router.get('/reviews', isProfessor, async (req, res) => {
  try {
    const professorId = req.session.user.id;
    const assignments = await Assignment.findAll({
      where: { reviewerId: professorId },
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.render('professor-reviews', {
      user: req.session.user,
      assignments
    });
  } catch (error) {
    console.error('Error loading reviews catalog:', error);
    res.status(500).send('Error loading reviews.');
  }
});

router.get('/profile', isProfessor, (req, res) => {
  res.redirect('/professor/dashboard');
});

router.post('/notifications/:id/read', isProfessor, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: { id: req.params.id, userId: req.session.user.id }
    });

    if (notification) {
      notification.isRead = true;
      await notification.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

const sendOTPEmail = async (email, otp) => {
  try {
    let transporter;
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: 'mockuser@ethereal.email',
          pass: 'mockpass'
        }
      });
    }

    const info = await transporter.sendMail({
      from: '"University Portal" <no-reply@university.edu>',
      to: email,
      subject: 'Verification OTP - Assignment Approval',
      text: `Your OTP code for assignment review approval is: ${otp}. It is valid for 10 minutes.`,
      html: `<p>Your OTP code for assignment review approval is: <strong>${otp}</strong>.</p><p>It is valid for 10 minutes.</p>`
    });
    console.log(`[Email Sent] OTP ${otp} dispatched to ${email}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Nodemailer send error, logging OTP to console:', error);
    console.log(`\n========================================\n[OTP DEBUG] OTP for ${email}: ${otp}\n========================================\n`);
    return false;
  }
};

router.get('/assignments/:id/review', isProfessor, async (req, res) => {
  try {
    const assignment = await Assignment.findOne({
      where: { id: req.params.id, reviewerId: req.session.user.id },
      include: [{ model: User, as: 'student', attributes: ['name', 'email'] }]
    });

    if (!assignment) {
      return res.status(404).send('Assignment not found or not assigned to you.');
    }

    if (!['submitted', 'forwarded'].includes(assignment.status.toLowerCase())) {
      return res.status(400).send('Only submitted or forwarded assignments can be reviewed.');
    }

    const whereClause = {
      role: ['professor', 'hod'],
      id: { [Op.ne]: req.session.user.id }
    };
    if (req.session.user.departmentId) {
      whereClause.departmentId = req.session.user.departmentId;
    }
    const reviewers = await User.findAll({
      where: whereClause,
      attributes: ['id', 'name', 'email', 'role']
    });

    const error = req.session.reviewError || null;
    req.session.reviewError = null;

    res.render('review-assignment', {
      user: req.session.user,
      assignment,
      reviewers,
      error
    });
  } catch (error) {
    console.error('Error loading review page:', error);
    res.status(500).send('Error loading review page.');
  }
});

router.post('/assignments/:id/approve', isProfessor, (req, res) => {
  upload.single('signatureFile')(req, res, async (err) => {
    const { id } = req.params;

    if (err) {
      req.session.successMessage = null;
      req.session.reviewError = err.message || 'Signature image upload failed.';
      return res.redirect(`/professor/assignments/${id}/review`);
    }

    const { remarks, signatureType, signatureText } = req.body;

    if (!remarks || !remarks.trim()) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      req.session.reviewError = 'Remarks are required.';
      return res.redirect(`/professor/assignments/${id}/review`);
    }

    let signatureVal = '';
    if (signatureType === 'image') {
      if (!req.file) {
        req.session.reviewError = 'Signature image file is required.';
        return res.redirect(`/professor/assignments/${id}/review`);
      }
      signatureVal = `/uploads/${req.file.filename}`;
    } else {
      if (!signatureText || !signatureText.trim()) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        req.session.reviewError = 'Digital text signature name is required.';
        return res.redirect(`/professor/assignments/${id}/review`);
      }
      signatureVal = signatureText.trim();
    }

    try {
      const assignment = await Assignment.findOne({
        where: { id, reviewerId: req.session.user.id }
      });

      if (!assignment) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).send('Assignment not found.');
      }

      if (!['submitted', 'forwarded'].includes(assignment.status.toLowerCase())) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).send('Only submitted or forwarded assignments can be reviewed.');
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      req.session.pendingReview = {
        assignmentId: id,
        remarks: remarks.trim(),
        signatureType,
        signature: signatureVal,
        action: 'Approve',
        otp,
        createdAt: Date.now()
      };

      await sendOTPEmail(req.session.user.email, otp);

      res.redirect(`/professor/assignments/${id}/verify-otp`);
    } catch (error) {
      console.error('Error initiating approval:', error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).send('Error initiating approval.');
    }
  });
});

router.get('/assignments/:id/verify-otp', isProfessor, async (req, res) => {
  const { id } = req.params;
  const pending = req.session.pendingReview;

  if (!pending || pending.assignmentId !== id) {
    return res.redirect(`/professor/assignments/${id}/review`);
  }

  const error = req.session.otpError || null;
  req.session.otpError = null;

  res.render('verify-otp', {
    user: req.session.user,
    assignmentId: id,
    error
  });
});

router.post('/assignments/:id/verify-otp', isProfessor, async (req, res) => {
  const { id } = req.params;
  const { otp } = req.body;
  const pending = req.session.pendingReview;

  if (!pending || pending.assignmentId !== id) {
    req.session.reviewError = 'Session expired or invalid review state.';
    return res.redirect(`/professor/assignments/${id}/review`);
  }

  const isExpired = (Date.now() - pending.createdAt) > 10 * 60 * 1000;
  if (isExpired) {
    req.session.pendingReview = null;
    req.session.reviewError = 'OTP has expired. Please try again.';
    return res.redirect(`/professor/assignments/${id}/review`);
  }

  if (pending.otp !== otp.trim()) {
    req.session.otpError = 'Invalid OTP entered. Please try again.';
    return res.redirect(`/professor/assignments/${id}/verify-otp`);
  }

  try {
    const assignment = await Assignment.findOne({
      where: { id, reviewerId: req.session.user.id }
    });

    if (!assignment) {
      return res.status(404).send('Assignment not found.');
    }

    let sigValToStore = pending.signature;
    if (pending.signatureType !== 'image') {
      sigValToStore = crypto.createHash('sha256').update(pending.signature).digest('hex');
    }

    const history = JSON.parse(assignment.history || '[]');
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const profTitleName = `Prof. ${req.session.user.name}`;
    history.unshift({
      status: 'Approved',
      reviewerName: profTitleName,
      remark: pending.remarks,
      date: formattedDate,
      signature: sigValToStore
    });

    assignment.status = 'Approved';
    assignment.history = JSON.stringify(history);
    await assignment.save();

    await Notification.create({
      message: `Your assignment "${assignment.title}" has been approved by ${profTitleName}.`,
      userId: assignment.studentId,
      isRead: false
    });

    req.session.pendingReview = null;
    req.session.successMessage = 'Assignment approved successfully.';

    res.redirect('/professor/dashboard');
  } catch (error) {
    console.error('Error completing OTP verification approval:', error);
    res.status(500).send('Error finalizing approval.');
  }
});

router.post('/assignments/:id/reject', isProfessor, (req, res) => {
  upload.none()(req, res, async (err) => {
    const { id } = req.params;

    if (err) {
      req.session.successMessage = null;
      req.session.reviewError = err.message || 'Form submission failed.';
      return res.redirect(`/professor/assignments/${id}/review`);
    }

    const { remarks } = req.body;

    if (!remarks || remarks.trim().length < 10) {
      req.session.reviewError = 'Rejection remarks must be at least 10 characters long.';
      return res.redirect(`/professor/assignments/${id}/review`);
    }

    try {
      const assignment = await Assignment.findOne({
        where: { id, reviewerId: req.session.user.id }
      });

      if (!assignment) {
        return res.status(404).send('Assignment not found.');
      }

      if (!['submitted', 'forwarded'].includes(assignment.status.toLowerCase())) {
        return res.status(400).send('Only submitted or forwarded assignments can be rejected.');
      }

      const history = JSON.parse(assignment.history || '[]');
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      const profTitleName = `Prof. ${req.session.user.name}`;
      history.unshift({
        status: 'Rejected',
        reviewerName: profTitleName,
        remark: remarks.trim(),
        date: formattedDate,
        signature: 'Rejected'
      });

      assignment.status = 'Rejected';
      assignment.reviewerId = null;
      assignment.history = JSON.stringify(history);
      await assignment.save();

      await Notification.create({
        message: `Your assignment "${assignment.title}" has been rejected by ${profTitleName}. Feedback: ${remarks.trim()}`,
        userId: assignment.studentId,
        isRead: false
      });

      const student = await User.findByPk(assignment.studentId);
      if (student && student.email) {
        try {
          let transporter;
          if (process.env.SMTP_HOST) {
            transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: process.env.SMTP_PORT || 587,
              secure: process.env.SMTP_SECURE === 'true',
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
              }
            });
          } else {
            transporter = nodemailer.createTransport({
              host: 'smtp.ethereal.email',
              port: 587,
              auth: {
                user: 'mockuser@ethereal.email',
                pass: 'mockpass'
              }
            });
          }

          const info = await transporter.sendMail({
            from: '"University Portal" <no-reply@university.edu>',
            to: student.email,
            subject: `Assignment Rejected: ${assignment.title}`,
            text: `Hello ${student.name},\n\nYour assignment "${assignment.title}" has been rejected by ${profTitleName}.\n\nFeedback:\n${remarks.trim()}\n\nPlease address the feedback and resubmit from your dashboard.\n\nBest regards,\nUniversity Portal`,
            html: `<p>Hello <strong>${student.name}</strong>,</p><p>Your assignment "<strong>${assignment.title}</strong>" has been rejected by ${profTitleName}.</p><h3>Feedback:</h3><blockquote style="border-left: 4px solid #ccc; padding-left: 16px; font-style: italic;">${remarks.trim()}</blockquote><p>Please address the feedback and resubmit from your dashboard.</p><br><p>Best regards,<br>University Portal</p>`
          });
          console.log(`[Email Sent] Rejection email dispatched to ${student.email}. Message ID: ${info.messageId}`);
        } catch (emailErr) {
          console.error('Nodemailer send error, logging student rejection to console:', emailErr);
          console.log(`\n========================================\n[REJECTION MAIL DEBUG] Mail to ${student.email}:\nRejection Feedback: ${remarks.trim()}\n========================================\n`);
        }
      }

      req.session.successMessage = 'Assignment rejected successfully.';
      res.redirect('/professor/dashboard');
    } catch (error) {
      console.error('Error rejecting assignment:', error);
      res.status(500).send('Error rejecting assignment.');
    }
  });
});

router.post('/assignments/:id/forward', isProfessor, async (req, res) => {
  try {
    const { id } = req.params;
    const { recipientId, forwardingNote } = req.body;

    if (!recipientId) {
      req.session.reviewError = 'Please select a recipient reviewer.';
      return res.redirect(`/professor/assignments/${id}/review`);
    }

    if (!forwardingNote || !forwardingNote.trim()) {
      req.session.reviewError = 'Forwarding note is required.';
      return res.redirect(`/professor/assignments/${id}/review`);
    }

    const assignment = await Assignment.findOne({
      where: { id, reviewerId: req.session.user.id }
    });

    if (!assignment) {
      return res.status(404).send('Assignment not found.');
    }

    if (!['submitted', 'forwarded'].includes(assignment.status.toLowerCase())) {
      return res.status(400).send('Only submitted or forwarded assignments can be forwarded.');
    }

    const targetWhere = {
      id: recipientId,
      role: ['professor', 'hod']
    };
    if (req.session.user.departmentId) {
      targetWhere.departmentId = req.session.user.departmentId;
    }

    const targetReviewer = await User.findOne({ where: targetWhere });

    if (!targetReviewer) {
      req.session.reviewError = 'Invalid recipient reviewer. Must be a professor or HOD in your department.';
      return res.redirect(`/professor/assignments/${id}/review`);
    }

    if (targetReviewer.id === req.session.user.id) {
      req.session.reviewError = 'You cannot forward the assignment to yourself.';
      return res.redirect(`/professor/assignments/${id}/review`);
    }

    const history = JSON.parse(assignment.history || '[]');
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const fromRoleName = req.session.user.role === 'hod' ? 'HOD' : 'Prof.';
    const toRoleName = targetReviewer.role === 'hod' ? 'HOD' : 'Prof.';
    const fromName = `${fromRoleName} ${req.session.user.name}`;
    const toName = `${toRoleName} ${targetReviewer.name}`;

    history.unshift({
      status: 'Forwarded',
      reviewerName: fromName,
      remark: `Forwarded to ${toName}. Note: ${forwardingNote.trim()}`,
      date: formattedDate,
      signature: 'Forwarded'
    });

    assignment.status = 'forwarded';
    assignment.reviewerId = targetReviewer.id;
    assignment.history = JSON.stringify(history);
    await assignment.save();

    await Notification.create({
      message: `Assignment "${assignment.title}" has been forwarded to you by ${fromName}.`,
      userId: targetReviewer.id,
      isRead: false
    });

    req.session.successMessage = `Assignment forwarded successfully to ${toName}.`;
    res.redirect('/professor/dashboard');
  } catch (error) {
    console.error('Error forwarding assignment:', error);
    res.status(500).send('Error forwarding assignment.');
  }
});

router.get('/assignments/:id', isProfessor, async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findOne({
      where: { id, reviewerId: req.session.user.id },
      include: [
        {
          model: User,
          as: 'student',
          attributes: ['name', 'email']
        }
      ]
    });

    if (!assignment) {
      return res.status(404).send('Assignment not found.');
    }

    const history = JSON.parse(assignment.history || '[]');

    res.render('assignment-details', {
      user: req.session.user,
      assignment,
      history,
      successMessage: null,
      professors: []
    });
  } catch (error) {
    console.error('Error loading details:', error);
    res.status(500).send('Error loading details.');
  }
});

module.exports = router;
