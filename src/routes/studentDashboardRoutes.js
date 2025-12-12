const express = require('express');
const router = express.Router();
const studentDashboardController = require('../controllers/studentDashboardController');
const { authenticateToken, authorize } = require('../middleware/auth');

const requireStudent = [
  authenticateToken,
  authorize(['student', 'admin'])
];

router.get('/courses', requireStudent, studentDashboardController.getCourses);
router.get('/progress/:courseId', requireStudent, studentDashboardController.getCourseProgress);
// Route alternative pour compatibilité frontend : /api/student/courses/:courseId/progress
router.get('/courses/:courseId/progress', requireStudent, studentDashboardController.getCourseProgress);
router.get('/schedule/:courseId', requireStudent, studentDashboardController.getStudentSchedule);
// Route alternative pour compatibilité frontend : /api/student/courses/:courseId/schedule
router.get('/courses/:courseId/schedule', requireStudent, studentDashboardController.getStudentSchedule);
router.get('/stats', requireStudent, studentDashboardController.getStats);
router.get('/recent-activity', requireStudent, studentDashboardController.getRecentActivity);
router.get('/badges', requireStudent, studentDashboardController.getBadges);
router.get('/certificates', requireStudent, studentDashboardController.getCertificates);
router.get('/activities', requireStudent, studentDashboardController.getActivities);
router.get('/catalogs/categories', requireStudent, studentDashboardController.getCatalogCategories);
router.get('/settings', requireStudent, studentDashboardController.getSettings);
router.put('/settings', requireStudent, studentDashboardController.updateSettings);
router.post('/settings/policies', requireStudent, studentDashboardController.updateSettingsPolicies);

module.exports = router;

