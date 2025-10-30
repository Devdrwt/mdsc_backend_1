const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes pour les analytics
router.get('/dashboard/student', authenticateToken, analyticsController.getStudentDashboard);
router.get('/dashboard/instructor', authenticateToken, authorize('instructor', 'admin'), analyticsController.getInstructorDashboard);
// Alias explicite demandé: /api/analytics/instructor-dashboard
router.get('/instructor-dashboard', authenticateToken, authorize('instructor', 'admin'), analyticsController.getInstructorDashboard);
router.get('/dashboard/admin', authenticateToken, authorize('admin'), analyticsController.getAdminDashboard);
router.get('/reports', authenticateToken, analyticsController.getDetailedReport);

module.exports = router;
