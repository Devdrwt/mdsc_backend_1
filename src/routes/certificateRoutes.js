const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const { authenticateToken } = require('../middleware/auth');

// Routes pour les certificats (avec authentification)
router.get('/my-certificates', authenticateToken, certificateController.getMyCertificates);
router.get('/:certificateId', authenticateToken, certificateController.getCertificateById);
router.get('/:certificateId/download', authenticateToken, certificateController.downloadCertificate);
router.post('/generate/:courseId', authenticateToken, certificateController.generateCertificateForCourse);
router.delete('/:certificateId', authenticateToken, certificateController.revokeCertificate);

module.exports = router;