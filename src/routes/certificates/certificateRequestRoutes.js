const express = require('express');
const router = express.Router();
const certificateRequestController = require('../../controllers/certificateRequestController');
const { authenticateToken, authorize } = require('../../middleware/auth');

// Routes étudiant
router.post('/enrollments/:enrollmentId/certificate/request',
  authenticateToken,
  certificateRequestController.requestCertificate
);

router.get('/my-certificates',
  authenticateToken,
  certificateRequestController.getMyCertificateRequests
);

// Routes admin
router.get('/admin/certificates/requests',
  authenticateToken,
  authorize(['admin']),
  certificateRequestController.getAllCertificateRequests
);

router.post('/admin/certificates/requests/:requestId/approve',
  authenticateToken,
  authorize(['admin']),
  certificateRequestController.approveCertificateRequest
);

router.post('/admin/certificates/requests/:requestId/reject',
  authenticateToken,
  authorize(['admin']),
  certificateRequestController.rejectCertificateRequest
);

module.exports = router;

