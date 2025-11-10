const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const { buildMediaUrl } = require('../utils/media');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');

/**
 * Initier un paiement
 */
const initiatePayment = async (req, res) => {
  try {
    const { courseId, paymentMethod, paymentProvider } = req.body;
    const userId = req.user.userId;

    if (!courseId || !paymentMethod || !paymentProvider) {
      return res.status(400).json({
        success: false,
        message: 'courseId, paymentMethod et paymentProvider sont requis'
      });
    }

    // Vérifier que le cours existe et est payant
    const [courses] = await pool.execute(
      'SELECT id, title, price, currency FROM courses WHERE id = ? AND is_published = TRUE',
      [courseId]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];

    if (!course.price || course.price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Ce cours est gratuit. Utilisez directement l\'inscription.'
      });
    }

    // Vérifier qu'un paiement n'est pas déjà en cours
    const [existingPayments] = await pool.execute(
      'SELECT id FROM payments WHERE user_id = ? AND course_id = ? AND status IN ("pending", "processing")',
      [userId, courseId]
    );

    if (existingPayments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un paiement est déjà en cours pour ce cours'
      });
    }

    // Créer l'enregistrement de paiement
    const [paymentResult] = await pool.execute(
      `INSERT INTO payments (
        user_id, course_id, amount, currency,
        payment_method, payment_provider, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        courseId,
        course.price,
        course.currency || 'XOF',
        paymentMethod,
        paymentProvider
      ]
    );

    const paymentId = paymentResult.insertId;

    // Initier le paiement selon le provider
    let paymentData = null;

    try {
      if (paymentMethod === 'card' && paymentProvider === 'stripe') {
        paymentData = await StripeService.createPaymentIntent({
          amount: course.price,
          currency: course.currency || 'xof',
          metadata: {
            payment_id: paymentId.toString(),
            user_id: userId.toString(),
            course_id: courseId.toString()
          }
        });

        // Mettre à jour avec l'ID de transaction
        await pool.execute(
          'UPDATE payments SET provider_transaction_id = ?, payment_data = ?, status = "processing" WHERE id = ?',
          [
            paymentData.client_secret,
            JSON.stringify(paymentData),
            paymentId
          ]
        );

      } else if (paymentMethod === 'mobile_money') {
        // Récupérer le numéro de téléphone depuis req.body
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
          return res.status(400).json({
            success: false,
            message: 'Numéro de téléphone requis pour Mobile Money'
          });
        }

        paymentData = await MobileMoneyService.initiatePayment({
          provider: paymentProvider,
          amount: course.price,
          currency: course.currency || 'XOF',
          phoneNumber,
          paymentId,
          userId,
          courseId
        });

        // Mettre à jour avec l'ID de transaction
        await pool.execute(
          'UPDATE payments SET provider_transaction_id = ?, payment_data = ?, status = "processing" WHERE id = ?',
          [
            paymentData.transactionId,
            JSON.stringify(paymentData),
            paymentId
          ]
        );
      } else {
        return res.status(400).json({
          success: false,
          message: 'Méthode de paiement non supportée'
        });
      }
    } catch (paymentError) {
      // En cas d'erreur, marquer le paiement comme échoué
      await pool.execute(
        'UPDATE payments SET status = "failed", error_message = ? WHERE id = ?',
        [paymentError.message, paymentId]
      );

      return res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'initiation du paiement',
        error: paymentError.message
      });
    }

    res.status(201).json({
      success: true,
      message: 'Paiement initié avec succès',
      data: {
        payment_id: paymentId,
        payment_data: paymentData,
        redirect_url: paymentData.redirectUrl || null
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'initiation du paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'initiation du paiement',
      error: error.message
    });
  }
};

/**
 * Vérifier le statut d'un paiement
 */
const getPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const [payments] = await pool.execute(
      `SELECT 
        p.*,
        c.title as course_title,
        c.slug as course_slug
       FROM payments p
       JOIN courses c ON p.course_id = c.id
       WHERE p.id = ? AND p.user_id = ?`,
      [id, userId]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paiement non trouvé'
      });
    }

    const payment = payments[0];

    // Si le paiement est en cours, vérifier avec le provider
    if (payment.status === 'processing' && payment.provider_transaction_id) {
      // TODO: Vérifier le statut avec le provider si nécessaire
      // await verifyPaymentWithProvider(payment);
    }

    res.json({
      success: true,
      data: {
        ...payment,
        thumbnail_url: buildMediaUrl(payment.thumbnail_url)
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
};

/**
 * Historique des paiements
 */
const getMyPayments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.user_id = ?';
    let params = [userId];

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    const [payments] = await pool.execute(
      `SELECT 
        p.*,
        c.title as course_title,
        c.slug as course_slug,
        c.thumbnail_url
       FROM payments p
       JOIN courses c ON p.course_id = c.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Compter le total
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM payments p ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        payments: payments.map((payment) => ({
          ...payment,
          thumbnail_url: buildMediaUrl(payment.thumbnail_url)
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

module.exports = {
  initiatePayment,
  getPaymentStatus,
  getMyPayments
};

