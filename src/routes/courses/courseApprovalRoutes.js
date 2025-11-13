const express = require('express');
const router = express.Router();
const courseApprovalController = require('../../controllers/courseApprovalController');
const { authenticateToken, authorize } = require('../../middleware/auth');
const { authenticateAdminToken } = require('../../middleware/adminAuth');

// Instructeur : Demander publication
router.post('/courses/:id/request-publication',
  authenticateToken,
  authorize(['instructor']),
  courseApprovalController.requestPublication
);

// Admin : Liste des cours en attente (route spécifique avant les routes avec paramètres)
router.get('/admin/courses/pending',
  authenticateAdminToken,
  courseApprovalController.getPendingCourses
);

// Admin : Détails d'un cours pour approbation (avant la route générique)
router.get('/admin/courses/:id',
  authenticateAdminToken,
  courseApprovalController.getCourseForApproval
);

// Admin : Liste de tous les cours (pour modération) - route générique en dernier
router.get('/admin/courses',
  authenticateAdminToken,
  courseApprovalController.getAllCourses
);

// Admin : Approuver
router.post('/admin/courses/:id/approve',
  authenticateAdminToken,
  courseApprovalController.approveCourse
);

// Admin : Rejeter
router.post('/admin/courses/:id/reject',
  authenticateAdminToken,
  courseApprovalController.rejectCourse
);

// Admin : Mettre à jour le statut d'un cours (PUT pour modification)
router.put('/admin/courses/:id/status',
  authenticateAdminToken,
  courseApprovalController.updateCourseStatus
);

// Admin : Mettre un cours en attente de validation
router.post('/admin/courses/:id/set-pending',
  authenticateAdminToken,
  courseApprovalController.setCoursePending
);

module.exports = router;

