const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const { buildMediaUrl } = require('../utils/media');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');
const GobiPayService = require('../services/paymentProviders/gobipayService');

const ensureEnrollmentForPayment = async (paymentId) => {
  const [payments] = await pool.execute(
    'SELECT user_id, course_id FROM payments WHERE id = ? LIMIT 1',
    [paymentId]
  );

  if (!payments.length) {
    return;
  }

  const { user_id, course_id } = payments[0];

  const [existing] = await pool.execute(
    'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1',
    [user_id, course_id]
  );

  if (existing.length > 0) {
    return;
  }

  await pool.execute(
    `INSERT INTO enrollments (user_id, course_id, status, enrolled_at, payment_id)
     VALUES (?, ?, 'enrolled', NOW(), ?)` ,
    [user_id, course_id, paymentId]
  );
};

/**
 * Initier un paiement
 */
const initiatePayment = async (req, res) => {
  try {
    const { courseId, paymentMethod, paymentProvider, customerPhone, customerEmail, customerFullname } = req.body;
    const userId = req.user.userId;

    console.log('[Payment] ➡️ initiatePayment called', {
      userId,
      courseId,
      paymentMethod,
      paymentProvider,
    });

    if (!courseId || !paymentMethod) {
      console.warn('[Payment] ❗ Missing courseId or paymentMethod', { courseId, paymentMethod });
      return res.status(400).json({
        success: false,
        message: 'courseId et paymentMethod sont requis'
      });
    }

    // Vérifier que le cours existe et est payant
    console.log('[Payment] 🔎 Fetching course data', { courseId });
    const [courses] = await pool.execute(
      'SELECT id, title, price, currency FROM courses WHERE id = ? AND is_published = TRUE',
      [courseId]
    );

    if (courses.length === 0) {
      console.warn('[Payment] ❗ Course not found or unpublished', { courseId });
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];
    console.log('[Payment] ✅ Course found', {
      courseId: course.id,
      title: course.title,
      price: course.price,
      currency: course.currency,
    });

    if (!course.price || course.price <= 0) {
      console.warn('[Payment] ❗ Attempt to pay for free course', { courseId });
      return res.status(400).json({
        success: false,
        message: 'Ce cours est gratuit. Utilisez directement l\'inscription.'
      });
    }

    // Vérifier qu'un paiement n'est pas déjà en cours
    console.log('[Payment] 🔄 Checking existing payments', { userId, courseId });
    const [existingPayments] = await pool.execute(
      'SELECT id FROM payments WHERE user_id = ? AND course_id = ? AND status IN ("pending", "processing")',
      [userId, courseId]
    );

    if (existingPayments.length > 0) {
      console.warn('[Payment] ❗ Payment already in progress', { paymentId: existingPayments[0].id });
      return res.status(400).json({
        success: false,
        message: 'Un paiement est déjà en cours pour ce cours'
      });
    }

    const normalizedPaymentMethod = paymentMethod === 'gobipay' ? 'other' : paymentMethod;
    const normalizedPaymentProvider = paymentMethod === 'gobipay' ? 'gobipay' : paymentProvider;

    console.log('[Payment] 📝 Creating payment record', {
      normalizedPaymentMethod,
      normalizedPaymentProvider,
      amount: course.price,
    });

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
        normalizedPaymentMethod,
        normalizedPaymentProvider || null
      ]
    );

    const paymentId = paymentResult.insertId;
    console.log('[Payment] ✅ Payment record created', { paymentId });

    // Initier le paiement selon le provider
    let paymentData = null;
    let redirectUrl = null;
    let providerTransactionId = null;

    try {
      if (paymentMethod === 'gobipay') {
        console.log('[Payment][GobiPay] 🚀 Starting GobiPay flow', { paymentId });
        const platformMoney = process.env.GOBIPAY_PLATFORM_MONEY || 'MTN_BEN_XOF';
        const finalCustomerFullname =
          customerFullname ||
          req.user?.fullName ||
          `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() ||
          'Étudiant MdSC';
        const finalCustomerEmail = req.user?.email || customerEmail || 'student@mdsc.local';
        const finalCustomerPhone = customerPhone || req.user?.phone;

        if (!finalCustomerPhone) {
          console.warn('[Payment][GobiPay] ❗ Missing customer phone');
          return res.status(400).json({
            success: false,
            message: 'Numéro de téléphone requis pour GobiPay',
          });
        }

        console.log('[Payment][GobiPay] 🧾 Creating order', {
          paymentId,
          amount: course.price,
          customer: finalCustomerFullname,
          phone: finalCustomerPhone,
        });
        const orderResult = await GobiPayService.createOrder({
          description: `Paiement formation - ${course.title}`,
          total: course.price,
          order_type: 'global',
          customer_fullname: finalCustomerFullname,
          customer_email: finalCustomerEmail,
          metadata: {
            payment_id: paymentId,
            course_id: course.id,
            user_id: userId,
          },
        });
        console.log('[Payment][GobiPay] ✅ Order created', {
          paymentId,
          orderIdentifier: orderResult.identifier,
        });

        const orderData = orderResult.raw?.data || {};

        console.log('[Payment][GobiPay] 🔄 Initiating transaction', {
          paymentId,
          orderUuid: orderData.uuid || orderData.slug || orderResult.identifier,
        });
        const transactionResult = await GobiPayService.initTransaction({
          amount: course.price,
          customer_fullname: finalCustomerFullname,
          customer_email: finalCustomerEmail,
          customer_phone: finalCustomerPhone,
          order_uuid: orderData.uuid || orderData.slug || orderResult.identifier,
          from_plateform_money: platformMoney,
          extra_infos: {
            payment_id: paymentId,
            course_id: course.id,
            user_id: userId,
          },
        });
        console.log('[Payment][GobiPay] ✅ Transaction initiated', {
          paymentId,
          transactionIdentifier: transactionResult.identifier || transactionResult.extra?.slug,
        });

        const transactionIdentifier =
          transactionResult.identifier ||
          transactionResult.extra?.slug ||
          transactionResult.extra?.id;

        if (!transactionIdentifier) {
          console.error('[Payment][GobiPay] ❌ Missing transaction identifier', {
            paymentId,
            transactionResult: transactionResult.raw,
          });
          throw new Error("Identifiant de transaction GobiPay introuvable");
        }

        console.log('[Payment][GobiPay] 💳 Paying order', {
          paymentId,
          transactionIdentifier,
        });
        const payResult = await GobiPayService.payOrder(transactionIdentifier);
        console.log('[Payment][GobiPay] ✅ Pay order response', {
          paymentId,
          redirect: payResult.redirect,
          redirectUrl: payResult.redirect_url,
          status: payResult.status,
        });

        redirectUrl = payResult.redirect ? payResult.redirect_url : null;
        providerTransactionId = transactionIdentifier;
        paymentData = {
          order: orderResult.raw,
          transaction: transactionResult.raw,
          pay: payResult.raw,
        };

        await pool.execute(
          'UPDATE payments SET provider_transaction_id = ?, payment_data = ?, status = "processing" WHERE id = ?',
          [
            providerTransactionId,
            JSON.stringify(paymentData),
            paymentId,
          ]
        );
        console.log('[Payment][GobiPay] 📝 Payment record updated to processing', {
          paymentId,
          providerTransactionId,
        });
      } else if (paymentMethod === 'card' && paymentProvider === 'stripe') {
        console.log('[Payment][Stripe] 🚀 Starting Stripe flow', { paymentId });
        paymentData = await StripeService.createPaymentIntent({
          amount: course.price,
          currency: course.currency || 'xof',
          metadata: {
            payment_id: paymentId.toString(),
            user_id: userId.toString(),
            course_id: courseId.toString()
          }
        });

        await pool.execute(
          'UPDATE payments SET provider_transaction_id = ?, payment_data = ?, status = "processing" WHERE id = ?',
          [
            paymentData.client_secret,
            JSON.stringify(paymentData),
            paymentId
          ]
        );
        console.log('[Payment][Stripe] 📝 Payment record updated to processing', {
          paymentId,
          clientSecret: paymentData.client_secret,
        });

      } else if (paymentMethod === 'mobile_money') {
        console.log('[Payment][MobileMoney] 🚀 Starting Mobile Money flow', { paymentId, provider: paymentProvider });
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
          console.warn('[Payment][MobileMoney] ❗ Missing phone number');
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

        providerTransactionId = paymentData.transactionId;
        redirectUrl = paymentData.redirectUrl || null;

        await pool.execute(
          'UPDATE payments SET provider_transaction_id = ?, payment_data = ?, status = "processing" WHERE id = ?',
          [
            providerTransactionId,
            JSON.stringify(paymentData),
            paymentId
          ]
        );
        console.log('[Payment][MobileMoney] 📝 Payment record updated to processing', {
          paymentId,
          providerTransactionId,
        });
      } else {
        console.warn('[Payment] ❗ Unsupported payment method', { paymentMethod, paymentProvider });
        return res.status(400).json({
          success: false,
          message: 'Méthode de paiement non supportée'
        });
      }
    } catch (paymentError) {
      console.error('[Payment] ❌ Error during provider flow', {
        paymentId,
        paymentMethod,
        provider: paymentProvider,
        message: paymentError.message,
        stack: paymentError.stack,
      });
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

    console.log('[Payment] ✅ Payment initiated successfully', {
      paymentId,
      redirectUrl,
      providerTransactionId,
    });

    res.status(201).json({
      success: true,
      message: 'Paiement initié avec succès',
      data: {
        payment_id: paymentId,
        payment_data: paymentData,
        redirect_url: redirectUrl,
        provider_transaction_id: providerTransactionId,
      }
    });

  } catch (error) {
    console.error('[Payment] ❌ Unexpected error during initiatePayment', {
      message: error.message,
      stack: error.stack,
    });
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

