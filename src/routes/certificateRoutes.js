const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Route publique pour vérifier un certificat par code (QR code)
router.get('/verify/:code', certificateController.verifyCertificate);

// Routes pour les certificats (avec authentification)
router.get('/', authenticateToken, certificateController.getMyCertificates); // Alias pour GET /api/certificates
router.get('/my-certificates', authenticateToken, certificateController.getMyCertificates);

// Routes admin (doivent être avant /:certificateId pour éviter les conflits)
router.get('/admin/all', 
  authenticateToken, 
  authorize(['admin']), 
  certificateController.getAllCertificates
);

// Routes avec paramètres (après les routes spécifiques)
router.get('/:certificateId', authenticateToken, certificateController.getCertificateById);
router.get('/:certificateId/download', authenticateToken, certificateController.downloadCertificate);
router.post('/generate/:courseId', authenticateToken, certificateController.generateCertificateForCourse);
router.delete('/:certificateId', authenticateToken, certificateController.revokeCertificate);

module.exports = router;