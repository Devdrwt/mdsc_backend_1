const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/paymentController');
const { authenticateToken } = require('../../middleware/auth');

// Récupérer les providers de paiement actifs (public - pas d'authentification requise)
router.get('/providers',
  paymentController.getActivePaymentProviders
);

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

// Finaliser un paiement Fedapay (callback après succès ou échec)
// Authentification optionnelle - si le token est présent, l'utiliser
router.post('/finalize-fedapay',
  (req, res, next) => {
    // Authentification optionnelle - si le token est présent, l'utiliser
    if (req.headers.authorization) {
      return authenticateToken(req, res, next);
    }
    next();
  },
  paymentController.finalizeFedapayPayment
);

// Finaliser un paiement GobiPay (callback après succès)
// Route avec authentification (appelée depuis le frontend)
router.get('/finalize-gobipay',
  authenticateToken,
  paymentController.finalizeGobipayPayment
);

// Callback public GobiPay (peut être appelé sans authentification)
// Cette route peut être appelée directement depuis le navigateur quand GobiPay redirige
router.get('/callback/gobipay',
  paymentController.finalizeGobipayPayment
);

// Route GET simple pour finaliser GobiPay (peut être appelée directement depuis le navigateur)
// Format: /api/payments/gobipay-success?transaction_slug=XXX&order_slug=YYY&payment=success
router.get('/gobipay-success',
  paymentController.finalizeGobipayPayment
);

// Route publique pour finaliser GobiPay depuis le frontend (sans authentification requise)
// Cette route peut être appelée directement depuis le navigateur avec les paramètres de GobiPay
router.get('/gobipay-callback',
  paymentController.finalizeGobipayPayment
);

// Route automatique pour finaliser GobiPay - peut être appelée directement depuis le navigateur
// Format: /api/payments/auto-finalize-gobipay?payment=success&transaction_slug=XXX&order_slug=YYY
// Cette route force la création de l'enrollment même si le paiement n'est pas trouvé par identifier
router.get('/auto-finalize-gobipay',
  paymentController.autoFinalizeGobipayPayment
);

// Route pour finaliser automatiquement les paiements GobiPay récents non finalisés
// Cette route peut être appelée depuis le frontend pour finaliser automatiquement les paiements
router.get('/finalize-recent-gobipay',
  authenticateToken,
  paymentController.finalizeRecentGobipayPayments
);

// Route alternative pour finaliser GobiPay depuis le frontend (authentification optionnelle)
// Cette route peut être appelée depuis le frontend quand GobiPay redirige directement
router.post('/finalize-gobipay-frontend',
  (req, res, next) => {
    // Authentification optionnelle - si le token est présent, l'utiliser
    if (req.headers.authorization) {
      return authenticateToken(req, res, next);
    }
    next();
  },
  paymentController.finalizeGobipayPaymentFromFrontend
);

// Webhook Kkiapay (callback après échec)
router.post('/webhook/kkiapay',
  paymentController.handleKkiapayWebhook
);

module.exports = router;

