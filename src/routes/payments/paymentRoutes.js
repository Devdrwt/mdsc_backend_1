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

// Finaliser un paiement Kkiapay (callback après succès)
// Note: L'authentification est optionnelle car le callback peut venir du widget Kkiapay
router.post('/finalize-kkiapay',
  authenticateToken, // Garder l'authentification pour sécurité, mais gérer le cas sans token
  paymentController.finalizeKkiapayPayment
);

// Webhook Kkiapay (callback après échec)
router.post('/webhook/kkiapay',
  paymentController.handleKkiapayWebhook
);

module.exports = router;

