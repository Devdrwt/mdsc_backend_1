const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const { buildMediaUrl } = require('../utils/media');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');
const GobiPayService = require('../services/paymentProviders/gobipayService');
const KkiapayServiceClass = require('../services/paymentProviders/kkiapayService');
const KkiapayService = KkiapayServiceClass.default || new KkiapayServiceClass();
const FedapayServiceClass = require('../services/paymentProviders/fedapayService');
const FedapayService = FedapayServiceClass.default || new FedapayServiceClass();
const paymentConfigService = require('../services/paymentConfigService');

const ensureEnrollmentForPayment = async (paymentId) => {
  try {
    const [payments] = await pool.execute(
      'SELECT user_id, course_id FROM payments WHERE id = ? LIMIT 1',
      [paymentId]
    );

    if (!payments.length) {
      console.error('[Payment] ❌ Payment not found for enrollment creation', { paymentId });
      return;
    }

    const { user_id, course_id } = payments[0];

    // Vérifier si une inscription existe déjà (active ou inactive)
    const [existingActive] = await pool.execute(
      'SELECT id, is_active FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1',
      [user_id, course_id]
    );

    if (existingActive.length > 0) {
      const enrollment = existingActive[0];
      
      // Si l'inscription existe mais est inactive, la réactiver
      if (!enrollment.is_active) {
        await pool.execute(
          `UPDATE enrollments 
           SET is_active = TRUE, 
               status = 'enrolled',
               enrolled_at = NOW(),
               payment_id = ?,
               progress_percentage = 0.00,
               completed_at = NULL
           WHERE id = ?`,
          [paymentId, enrollment.id]
        );
        console.log('[Payment] ✅ Enrollment reactivated', {
          enrollmentId: enrollment.id,
          paymentId,
          user_id,
          course_id
        });
      } else {
        // Si l'inscription est déjà active, mettre à jour le payment_id si nécessaire
        await pool.execute(
          'UPDATE enrollments SET payment_id = ? WHERE id = ? AND (payment_id IS NULL OR payment_id != ?)',
          [paymentId, enrollment.id, paymentId]
        );
        console.log('[Payment] ℹ️ Active enrollment already exists', {
          enrollmentId: enrollment.id,
          paymentId,
          user_id,
          course_id
        });
      }
      return;
    }

    // Créer une nouvelle inscription
    const [enrollmentResult] = await pool.execute(
      `INSERT INTO enrollments (user_id, course_id, status, enrolled_at, payment_id, is_active, progress_percentage)
       VALUES (?, ?, 'enrolled', NOW(), ?, TRUE, 0.00)` ,
      [user_id, course_id, paymentId]
    );

    console.log('[Payment] ✅ New enrollment created', {
      enrollmentId: enrollmentResult.insertId,
      paymentId,
      user_id,
      course_id
    });

    // Créer une notification de paiement réussi
    try {
      // Récupérer les infos du cours pour la notification
      const [courses] = await pool.execute(
        'SELECT title FROM courses WHERE id = ?',
        [course_id]
      );
      const courseTitle = courses.length > 0 ? courses[0].title : 'le cours';

      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          '✅ Paiement reçu',
          `Votre paiement pour le cours "${courseTitle}" a été confirmé avec succès. Vous pouvez maintenant accéder au cours.`,
          'success', // Type valide selon l'ENUM de la table notifications
          `/dashboard/student/courses`,
          JSON.stringify({ paymentId: paymentId, courseId: course_id, courseTitle: courseTitle })
        ]
      );
      console.log('[Payment] ✅ Notification de paiement réussi créée', { user_id, paymentId });
    } catch (notificationError) {
      console.error('[Payment] ❌ Erreur lors de la création de la notification de paiement:', notificationError);
      // Ne pas faire échouer le processus si la notification échoue
    }
  } catch (error) {
    console.error('[Payment] ❌ Error ensuring enrollment for payment:', error);
    throw error; // Re-throw pour que l'appelant puisse gérer l'erreur
  }
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

    if (!courseId) {
      console.warn('[Payment] ❗ Missing courseId', { courseId });
      return res.status(400).json({
        success: false,
        message: 'courseId est requis'
      });
    }

    // Si paymentMethod n'est pas fourni, utiliser paymentProvider (ou vice versa)
    const effectivePaymentMethod = paymentMethod || paymentProvider;
    const effectivePaymentProvider = paymentProvider || paymentMethod;

    if (!effectivePaymentMethod) {
      console.warn('[Payment] ❗ Missing paymentMethod and paymentProvider', { courseId });
      return res.status(400).json({
        success: false,
        message: 'paymentMethod ou paymentProvider est requis'
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

    const isKkiapay = effectivePaymentMethod === 'kkiapay' || effectivePaymentProvider === 'kkiapay';
    const isFedapay = effectivePaymentMethod === 'fedapay' || effectivePaymentProvider === 'fedapay';

    // Vérifier que le provider demandé est actif et configuré
    if (isKkiapay) {
      const isActive = await paymentConfigService.isProviderActive('kkiapay');
      if (!isActive) {
        console.warn('[Payment] ❗ Kkiapay is not active or configured', { courseId });
        return res.status(400).json({
          success: false,
          message: 'Kkiapay n\'est pas activé ou configuré. Contactez un administrateur.'
        });
      }
    }

    if (isFedapay) {
      const isActive = await paymentConfigService.isProviderActive('fedapay');
      if (!isActive) {
        console.warn('[Payment] ❗ Fedapay is not active or configured', { courseId });
        return res.status(400).json({
          success: false,
          message: 'Fedapay n\'est pas activé ou configuré. Contactez un administrateur.'
        });
      }
    }

    // Pour Kkiapay, on ne crée PAS de paiement avec statut "pending"
    // Le paiement sera créé uniquement via les events Kkiapay (success/error) dans le webhook
    // Pas de vérification de paiement en cours, pas d'enregistrement "pending"
    if (isKkiapay) {
      console.log('[Payment][Kkiapay] 🚀 Starting Kkiapay flow (no payment record, will be created in webhook only)');
      
      const finalCustomerFullname =
        customerFullname ||
        req.user?.fullName ||
        `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() ||
        'Étudiant MdSC';
      const finalCustomerEmail = req.user?.email || customerEmail || 'student@mdsc.local';
      const finalCustomerPhone = customerPhone || req.user?.phone;

      // Générer un temp_payment_id pour les métadonnées (ne sera pas enregistré en DB)
      const tempPaymentId = `temp_${userId}_${courseId}_${Date.now()}`;

      // Charger la configuration depuis la DB ou utiliser les variables d'environnement
      let kkiapayInstance = KkiapayService;
      try {
        const kkiapayConfig = await paymentConfigService.getProviderConfigByName('kkiapay');
        if (kkiapayConfig && kkiapayConfig.public_key && kkiapayConfig.secret_key) {
          kkiapayInstance = new KkiapayServiceClass(kkiapayConfig);
          console.log('[Payment][Kkiapay] ✅ Configuration chargée depuis la base de données');
        } else {
          // Fallback vers les variables d'environnement
          console.log('[Payment][Kkiapay] ℹ️ Utilisation des variables d\'environnement (config DB non disponible)');
          kkiapayInstance = KkiapayService; // Utilise l'instance par défaut qui lit les variables d'environnement
        }
      } catch (configError) {
        // En cas d'erreur, utiliser les variables d'environnement
        console.warn('[Payment][Kkiapay] ⚠️ Erreur lors du chargement de la config DB, utilisation des variables d\'environnement:', configError.message);
        kkiapayInstance = KkiapayService;
      }

      // Préparer les données pour le widget Kkiapay
      const transactionResult = await kkiapayInstance.createTransaction({
        amount: course.price,
        currency: course.currency || 'XOF',
        description: `Paiement formation - ${course.title}`,
        customer_fullname: finalCustomerFullname,
        customer_email: finalCustomerEmail,
        customer_phone: finalCustomerPhone,
        metadata: {
          temp_payment_id: tempPaymentId,
          user_id: userId,
          course_id: courseId,
        },
      });

      console.log('[Payment][Kkiapay] ✅ Transaction data prepared', {
        tempPaymentId,
        hasPublicKey: !!transactionResult.raw?.public_key,
        sandbox: transactionResult.raw?.sandbox,
      });

      // Retourner les données du widget sans créer de paiement
      // Le paiement sera créé uniquement dans le webhook Kkiapay avec statut "completed" ou "failed"
      return res.status(201).json({
        success: true,
        message: 'Données du widget Kkiapay préparées',
        data: {
          temp_payment_id: tempPaymentId,
          payment_data: {
            raw: transactionResult.raw,
          },
          redirect_url: null,
          provider_transaction_id: null,
        }
      });
    }

    // Pour Fedapay, préparer les données pour le widget (comme Kkiapay)
    if (isFedapay) {
      console.log('[Payment][Fedapay] 🚀 Starting Fedapay flow');
      
      const finalCustomerFullname =
        customerFullname ||
        req.user?.fullName ||
        `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() ||
        'Étudiant MdSC';
      const finalCustomerEmail = req.user?.email || customerEmail || 'student@mdsc.local';
      const finalCustomerPhone = customerPhone || req.user?.phone;

      // Générer un temp_payment_id pour les métadonnées
      const tempPaymentId = `temp_${userId}_${courseId}_${Date.now()}`;

      // Charger la configuration depuis la DB ou utiliser les variables d'environnement
      let fedapayInstance = FedapayService;
      try {
        const fedapayConfig = await paymentConfigService.getProviderConfigByName('fedapay');
        if (fedapayConfig && fedapayConfig.public_key && fedapayConfig.secret_key) {
          fedapayInstance = new FedapayServiceClass(fedapayConfig);
          console.log('[Payment][Fedapay] ✅ Configuration chargée depuis la base de données');
        } else {
          // Fallback vers les variables d'environnement
          console.log('[Payment][Fedapay] ℹ️ Utilisation des variables d\'environnement (config DB non disponible)');
          fedapayInstance = FedapayService; // Utilise l'instance par défaut qui lit les variables d'environnement
        }
      } catch (configError) {
        // En cas d'erreur, utiliser les variables d'environnement
        console.warn('[Payment][Fedapay] ⚠️ Erreur lors du chargement de la config DB, utilisation des variables d\'environnement:', configError.message);
        fedapayInstance = FedapayService;
      }

      // Préparer les données pour le widget Fedapay (PAS d'appel API, comme Kkiapay)
      const transactionResult = await fedapayInstance.createTransaction({
        amount: course.price,
        currency: course.currency || 'XOF',
        description: `Paiement formation - ${course.title}`,
        customer_fullname: finalCustomerFullname,
        customer_email: finalCustomerEmail,
        customer_phone: finalCustomerPhone,
        metadata: {
          temp_payment_id: tempPaymentId,
          user_id: userId,
          course_id: courseId,
        },
      });

      console.log('[Payment][Fedapay] ✅ Transaction data prepared', {
        tempPaymentId,
        hasPublicKey: !!transactionResult.raw?.public_key,
        environment: transactionResult.raw?.environment,
        sandbox: transactionResult.raw?.sandbox,
      });

      // Retourner les données du widget sans créer de paiement
      // Le paiement sera créé uniquement dans le webhook Fedapay avec statut "completed" ou "failed"
      return res.status(201).json({
        success: true,
        message: 'Données du widget Fedapay préparées',
        data: {
          temp_payment_id: tempPaymentId,
          payment_data: {
            raw: transactionResult.raw,
          },
          redirect_url: null,
          provider_transaction_id: null,
        }
      });
    }

    // Pour les autres providers (GobiPay, Mobile Money, Stripe, etc.)
    // On ne crée PAS de paiement avec statut "pending"
    // Le paiement sera créé uniquement dans le webhook après succès/échec
    const supportedMethods = ['gobipay', 'card', 'mobile_money'];
    if (!supportedMethods.includes(effectivePaymentMethod) && !isKkiapay && !isFedapay) {
      console.warn('[Payment] ❗ Unsupported payment method', {
        effectivePaymentMethod,
        effectivePaymentProvider,
      });
      return res.status(400).json({
        success: false,
        message: 'Méthode de paiement non supportée',
      });
    }

    const normalizedPaymentMethod = effectivePaymentMethod === 'gobipay' ? 'other' : effectivePaymentMethod;
    const normalizedPaymentProvider = effectivePaymentMethod === 'gobipay' ? 'gobipay' : effectivePaymentProvider;

    // Générer un temp_payment_id pour les métadonnées (ne sera pas enregistré en DB)
    const tempPaymentId = `temp_${userId}_${courseId}_${Date.now()}`;

    console.log('[Payment] 📝 Preparing payment (will be created in webhook)', {
      tempPaymentId,
      normalizedPaymentMethod,
      normalizedPaymentProvider,
      amount: course.price,
    });

    // Initier le paiement selon le provider
    let paymentData = null;
    let redirectUrl = null;
    let providerTransactionId = null;

    try {
      if (effectivePaymentMethod === 'gobipay') {
        console.log('[Payment][GobiPay] 🚀 Starting GobiPay flow');
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
          currency: (course.currency || '').toString().toUpperCase(),
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
      } else if (effectivePaymentMethod === 'card' && effectivePaymentProvider === 'stripe') {
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

      } else if (effectivePaymentMethod === 'mobile_money') {
        console.log('[Payment][MobileMoney] 🚀 Starting Mobile Money flow', { paymentId, provider: effectivePaymentProvider });
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
          console.warn('[Payment][MobileMoney] ❗ Missing phone number');
          return res.status(400).json({
            success: false,
            message: 'Numéro de téléphone requis pour Mobile Money'
          });
        }

        paymentData = await MobileMoneyService.initiatePayment({
          provider: effectivePaymentProvider,
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
        console.warn('[Payment] ❗ Unsupported payment method', { effectivePaymentMethod, effectivePaymentProvider });
        return res.status(400).json({
          success: false,
          message: 'Méthode de paiement non supportée'
        });
      }
    } catch (paymentError) {
      console.error('[Payment] ❌ Error during provider flow', {
        paymentId,
        effectivePaymentMethod,
        provider: effectivePaymentProvider,
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

/**
 * Finaliser un paiement Kkiapay (appelé par le callback frontend après succès)
 */
const finalizeKkiapayPayment = async (req, res) => {
  try {
    const {
      transaction_id,
      status,
      amount,
      currency,
      metadata
    } = req.body;

    console.log('[Payment][Kkiapay] 📥 finalizeKkiapayPayment called', {
      transaction_id,
      status,
      amount,
      currency,
      metadata
    });

    // Vérifier que les métadonnées sont présentes
    if (!metadata || !metadata.user_id || !metadata.course_id) {
      console.error('[Payment][Kkiapay] ❌ Missing metadata', { metadata });
      return res.status(400).json({
        success: false,
        message: 'Les métadonnées du paiement sont manquantes'
      });
    }

    const { user_id, course_id } = metadata;

    // Vérifier que le statut est SUCCESS
    if (status !== 'SUCCESS') {
      console.warn('[Payment][Kkiapay] ⚠️ Unexpected status in finalize', { status });
      return res.status(400).json({
        success: false,
        message: 'Statut de paiement invalide'
      });
    }

    // Vérifier que le cours existe
    const [courses] = await pool.execute(
      'SELECT id, title, price FROM courses WHERE id = ?',
      [course_id]
    );

    if (courses.length === 0) {
      console.error('[Payment][Kkiapay] ❌ Course not found', { course_id });
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];

    // Vérifier qu'un paiement réussi n'existe pas déjà pour cette transaction
    const [existingPayments] = await pool.execute(
      'SELECT id FROM payments WHERE provider_transaction_id = ? AND status = "completed"',
      [transaction_id]
    );

    if (existingPayments.length > 0) {
      console.log('[Payment][Kkiapay] ℹ️ Payment already finalized', {
        paymentId: existingPayments[0].id,
        transaction_id
      });
      
      // Vérifier et créer l'inscription si nécessaire
      await ensureEnrollmentForPayment(existingPayments[0].id);
      
      return res.json({
        success: true,
        message: 'Paiement déjà finalisé',
        data: {
          payment_id: existingPayments[0].id
        }
      });
    }

    // Créer le paiement avec statut "completed" (pas "pending")
    const [paymentResult] = await pool.execute(
      `INSERT INTO payments (
        user_id, course_id, amount, currency,
        payment_method, payment_provider, status,
        provider_transaction_id, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, NOW())`,
      [
        user_id,
        course_id,
        amount || course.price,
        currency || 'XOF',
        'kkiapay',
        'kkiapay',
        transaction_id
      ]
    );

    const paymentId = paymentResult.insertId;
    console.log('[Payment][Kkiapay] ✅ Payment created with completed status', {
      paymentId,
      transaction_id,
      user_id,
      course_id
    });

    // Créer l'inscription automatiquement
    await ensureEnrollmentForPayment(paymentId);

    console.log('[Payment][Kkiapay] ✅ Enrollment ensured for payment', { paymentId });

    res.json({
      success: true,
      message: 'Paiement finalisé avec succès',
      data: {
        payment_id: paymentId,
        transaction_id
      }
    });

  } catch (error) {
    console.error('[Payment][Kkiapay] ❌ Error finalizing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la finalisation du paiement',
      error: error.message
    });
  }
};

/**
 * Finaliser un paiement Fedapay (appelé par le callback frontend après succès)
 */
const finalizeFedapayPayment = async (req, res) => {
  try {
    const {
      transaction_id,
      status,
      amount,
      currency,
      metadata
    } = req.body;

    console.log('[Payment][Fedapay] 📥 Finalizing payment', {
      transaction_id,
      status,
      amount,
      currency,
      metadata
    });

    // Vérifier que les métadonnées sont présentes
    if (!metadata || !metadata.user_id || !metadata.course_id) {
      console.error('[Payment][Fedapay] ❌ Missing metadata', { metadata });
      return res.status(400).json({
        success: false,
        message: 'Les métadonnées du paiement sont manquantes'
      });
    }

    const { user_id, course_id } = metadata;

    // Récupérer les infos du cours pour le montant
    const [courses] = await pool.execute(
      'SELECT id, title, price, currency FROM courses WHERE id = ?',
      [course_id]
    );

    if (courses.length === 0) {
      console.error('[Payment][Fedapay] ❌ Course not found', { course_id });
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];
    const finalAmount = amount || course.price;
    const finalCurrency = currency || course.currency || 'XOF';

    // Vérifier si un paiement avec cette transaction existe déjà
    const [existingPayments] = await pool.execute(
      'SELECT id FROM payments WHERE provider_transaction_id = ? LIMIT 1',
      [transaction_id]
    );

    if (existingPayments.length > 0) {
      console.log('[Payment][Fedapay] ℹ️ Payment already finalized', {
        paymentId: existingPayments[0].id,
        transaction_id
      });
      
      // Vérifier et créer l'inscription si nécessaire
      await ensureEnrollmentForPayment(existingPayments[0].id);
      
      return res.json({
        success: true,
        message: 'Paiement déjà finalisé',
        data: {
          payment_id: existingPayments[0].id
        }
      });
    }

    // Créer le paiement avec statut "completed"
    const [paymentResult] = await pool.execute(
      `INSERT INTO payments (
        user_id, course_id, amount, currency,
        payment_method, payment_provider, status,
        provider_transaction_id, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, NOW())`,
      [
        user_id,
        course_id,
        finalAmount,
        finalCurrency,
        'fedapay',
        'fedapay',
        transaction_id
      ]
    );

    const paymentId = paymentResult.insertId;
    console.log('[Payment][Fedapay] ✅ Payment created with completed status', {
      paymentId,
      transaction_id,
      user_id,
      course_id
    });

    // Créer l'inscription automatiquement
    await ensureEnrollmentForPayment(paymentId);

    console.log('[Payment][Fedapay] ✅ Enrollment ensured for payment', { paymentId });

    res.json({
      success: true,
      message: 'Paiement finalisé avec succès',
      data: {
        payment_id: paymentId,
        transaction_id
      }
    });

  } catch (error) {
    console.error('[Payment][Fedapay] ❌ Error finalizing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la finalisation du paiement',
      error: error.message
    });
  }
};

/**
 * Webhook Kkiapay pour les échecs (appelé par le callback frontend après échec)
 */
const handleKkiapayWebhook = async (req, res) => {
  try {
    const {
      transaction_id,
      status,
      amount,
      currency,
      error_message,
      metadata
    } = req.body;

    console.log('[Payment][Kkiapay] 📥 Webhook called', {
      transaction_id,
      status,
      amount,
      currency,
      error_message,
      metadata
    });

    // Vérifier que les métadonnées sont présentes
    if (!metadata || !metadata.user_id || !metadata.course_id) {
      console.error('[Payment][Kkiapay] ❌ Missing metadata in webhook', { metadata });
      return res.status(400).json({
        success: false,
        message: 'Les métadonnées du paiement sont manquantes'
      });
    }

    const { user_id, course_id } = metadata;

    // Gérer les statuts SUCCESS et FAILED
    if (status !== 'SUCCESS' && status !== 'FAILED') {
      console.warn('[Payment][Kkiapay] ⚠️ Unexpected status in webhook', { status });
      return res.status(400).json({
        success: false,
        message: 'Statut de paiement invalide'
      });
    }

    // Vérifier qu'un paiement n'existe pas déjà pour cette transaction
    const [existingPayments] = await pool.execute(
      'SELECT id, status FROM payments WHERE provider_transaction_id = ?',
      [transaction_id]
    );

    if (existingPayments.length > 0) {
      console.log('[Payment][Kkiapay] ℹ️ Payment already recorded', {
        paymentId: existingPayments[0].id,
        existingStatus: existingPayments[0].status
      });
      
      // Si le paiement existant est "completed" et qu'on reçoit un webhook de succès,
      // s'assurer que l'inscription existe
      if (status === 'SUCCESS' && existingPayments[0].status === 'completed') {
        await ensureEnrollmentForPayment(existingPayments[0].id);
      }
      
      return res.json({
        success: true,
        message: 'Paiement déjà enregistré'
      });
    }

    // Créer le paiement avec statut approprié (pas "pending")
    const [courses] = await pool.execute(
      'SELECT id, title, price FROM courses WHERE id = ?',
      [course_id]
    );

    const coursePrice = courses.length > 0 ? courses[0].price : amount;
    const paymentStatus = status === 'SUCCESS' ? 'completed' : 'failed';

    const [paymentResult] = await pool.execute(
      `INSERT INTO payments (
        user_id, course_id, amount, currency,
        payment_method, payment_provider, status,
        provider_transaction_id, error_message, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        course_id,
        amount || coursePrice,
        currency || 'XOF',
        'kkiapay',
        'kkiapay',
        paymentStatus,
        transaction_id || null,
        paymentStatus === 'failed' ? (error_message || 'Paiement échoué') : null,
        paymentStatus === 'completed' ? new Date() : null
      ]
    );

    const paymentId = paymentResult.insertId;
    console.log(`[Payment][Kkiapay] ✅ Payment created with ${paymentStatus} status`, {
      paymentId,
      transaction_id,
      user_id,
      course_id
    });

    // Si le paiement est réussi, créer l'inscription automatiquement
    if (paymentStatus === 'completed') {
      await ensureEnrollmentForPayment(paymentId);
      console.log('[Payment][Kkiapay] ✅ Enrollment ensured for payment', { paymentId });
    }

    res.json({
      success: true,
      message: 'Échec de paiement enregistré',
      data: {
        payment_id: paymentId
      }
    });

  } catch (error) {
    console.error('[Payment][Kkiapay] ❌ Error handling webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement du webhook',
      error: error.message
    });
  }
};

/**
 * Récupérer les providers de paiement actifs (endpoint public)
 */
const getActivePaymentProviders = async (req, res) => {
  try {
    console.log('[Payment] 🔍 Récupération des providers actifs...');
    
    const providers = await paymentConfigService.getAllProviders();
    console.log('[Payment] ✅ Providers récupérés:', providers.length);
    
    // Filtrer seulement les actifs et retourner seulement les infos nécessaires (pas les clés)
    const activeProviders = providers
      .filter(p => p.is_active)
      .map(p => ({
        id: p.id,
        provider_name: p.provider_name,
        is_sandbox: Boolean(p.is_sandbox), // S'assurer que c'est un booléen
        // Ne pas exposer les clés même masquées
      }));
    
    console.log('[Payment] ✅ Providers actifs filtrés:', activeProviders.length);
    
    res.json({
      success: true,
      data: activeProviders
    });
  } catch (error) {
    console.error('[Payment] ❌ Erreur lors de la récupération des providers actifs:', error);
    console.error('[Payment] ❌ Stack trace:', error.stack);
    
    // Vérifier si c'est une erreur de table manquante
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message?.includes('payment_providers')) {
      console.error('[Payment] ❌ La table payment_providers n\'existe pas dans la base de données');
      return res.status(500).json({
        success: false,
        message: 'Table payment_providers non trouvée. Veuillez exécuter les migrations de la base de données.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des providers de paiement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  initiatePayment,
  getPaymentStatus,
  getMyPayments,
  finalizeKkiapayPayment,
  finalizeFedapayPayment,
  handleKkiapayWebhook,
  getActivePaymentProviders
};

