const express = require('express');
const router = express.Router();
const instructorDashboardController = require('../controllers/instructorDashboardController');
const { authenticateToken, authorize } = require('../middleware/auth');

const requireInstructor = [
  authenticateToken,
  authorize(['instructor', 'admin'])
];

router.get('/dashboard', requireInstructor, instructorDashboardController.getDashboard);
router.get('/courses', requireInstructor, instructorDashboardController.getCourses);
router.get('/courses/:courseId/performance', requireInstructor, instructorDashboardController.getCoursePerformance);
router.get('/students', requireInstructor, instructorDashboardController.getStudents);
router.get('/settings', requireInstructor, instructorDashboardController.getSettings);
router.post('/settings/policies', requireInstructor, instructorDashboardController.updateSettingsPolicies);
router.get('/enrollments/trend', requireInstructor, instructorDashboardController.getEnrollmentTrend);
router.get('/recent-activity', requireInstructor, instructorDashboardController.getRecentActivity);
router.get('/messages/unread-count', requireInstructor, instructorDashboardController.getUnreadMessagesCount);
router.get('/analytics', requireInstructor, instructorDashboardController.getAnalytics);
router.get('/notifications', requireInstructor, instructorDashboardController.getNotifications);

module.exports = router;

