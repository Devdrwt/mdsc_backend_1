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

// Finaliser un paiement Kkiapay (appelé par le frontend après succès)
router.post('/finalize-kkiapay',
  authenticateToken,
  paymentController.finalizeKkiapayPayment
);

module.exports = router;

