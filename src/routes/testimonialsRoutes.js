const express = require('express');
const router = express.Router();
const testimonialsController = require('../controllers/testimonialsController');
const { authenticateToken, authorize, optionalAuth } = require('../middleware/auth');

// Routes publiques (avec authentification optionnelle pour filtrer is_active)
// GET /api/testimonials - Liste des témoignages
router.get('/', optionalAuth, testimonialsController.getTestimonials);

// Route pour les témoignages de l'utilisateur connecté (AVANT /:id pour éviter les conflits)
// GET /api/testimonials/my - Mes témoignages
router.get('/my', 
  authenticateToken,
  authorize(['student', 'instructor', 'admin']),
  testimonialsController.getMyTestimonials
);

// GET /api/testimonials/:id - Un témoignage spécifique
router.get('/:id', optionalAuth, testimonialsController.getTestimonial);

// Routes authentifiées (étudiants et admins peuvent créer)
// POST /api/testimonials - Créer un témoignage
// Les étudiants créent avec status='pending', les admins avec status='approved'
router.post(
  '/',
  authenticateToken,
  authorize(['student', 'instructor', 'admin']),
  testimonialsController.createTestimonial
);

// Routes admin seulement
// PUT /api/testimonials/:id - Mettre à jour un témoignage
router.put(
  '/:id',
  authenticateToken,
  authorize(['admin']),
  testimonialsController.updateTestimonial
);

// POST /api/testimonials/:id/approve - Approuver un témoignage
router.post(
  '/:id/approve',
  authenticateToken,
  authorize(['admin']),
  testimonialsController.approveTestimonial
);

// POST /api/testimonials/:id/reject - Rejeter un témoignage
router.post(
  '/:id/reject',
  authenticateToken,
  authorize(['admin']),
  testimonialsController.rejectTestimonial
);

// DELETE /api/testimonials/:id - Supprimer un témoignage
router.delete(
  '/:id',
  authenticateToken,
  authorize(['admin']),
  testimonialsController.deleteTestimonial
);

module.exports = router;

