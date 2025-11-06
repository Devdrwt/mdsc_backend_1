const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/paymentController');
const { authenticateToken } = require('../../middleware/auth');

// Initier un paiement
router.post('/initiate',
  authenticateToken,
  paymentController.initiatePayment
);

// Vérifier le statut d'un paiement
router.get('/:id/status',
  authenticateToken,
  paymentController.getPaymentStatus
);

// Historique des paiements
router.get('/my-payments',
  authenticateToken,
  paymentController.getMyPayments
);

module.exports = router;

