const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const { buildMediaUrl } = require('../utils/media');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');
const GobiPayService = require('../services/paymentProviders/gobipayService');
const KkiapayService = require('../services/paymentProviders/kkiapayService');

const ensureEnrollmentForPayment = async (paymentId) => {
  let connection = null;
  
  try {
    // Obtenir une connexion dédiée pour la transaction
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    const [payments] = await connection.execute(
      'SELECT user_id, course_id FROM payments WHERE id = ? LIMIT 1',
      [paymentId]
    );

    if (!payments.length) {
      console.log('[ensureEnrollmentForPayment] ⚠️ Payment not found', { paymentId });
      await connection.rollback();
      return;
    }

    const { user_id, course_id } = payments[0];

    // Utiliser SELECT FOR UPDATE pour verrouiller la ligne et éviter les race conditions
    const [existing] = await connection.execute(
      'SELECT id, payment_id, is_active, status FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1 FOR UPDATE',
      [user_id, course_id]
    );

    if (existing.length > 0) {
      const existingEnrollment = existing[0];
      
      // Si l'enrollment existe mais est inactif OU a le statut 'in_progress', le supprimer complètement pour repartir à zéro
      const isInactive = existingEnrollment.is_active === false || existingEnrollment.is_active === 0;
      const isInProgress = existingEnrollment.status === 'in_progress';
      
      if (isInactive || isInProgress) {
        console.log('[ensureEnrollmentForPayment] 🗑️ Removing enrollment to start fresh', {
          enrollmentId: existingEnrollment.id,
          reason: isInactive ? 'inactive' : 'in_progress',
          status: existingEnrollment.status,
        });
        await connection.execute(
          'DELETE FROM enrollments WHERE id = ?',
          [existingEnrollment.id]
        );
        // Continuer pour créer un nouvel enrollment
      } else {
        // Enrollment actif existe, mettre à jour le payment_id si nécessaire
        const existingPaymentId = existingEnrollment.payment_id;
        if (!existingPaymentId || existingPaymentId !== paymentId) {
          console.log('[ensureEnrollmentForPayment] 🔄 Updating enrollment payment_id', {
            enrollmentId: existingEnrollment.id,
            oldPaymentId: existingPaymentId,
            newPaymentId: paymentId,
          });
          await connection.execute(
            'UPDATE enrollments SET payment_id = ? WHERE id = ?',
            [paymentId, existingEnrollment.id]
          );
        }
        console.log('[ensureEnrollmentForPayment] ✅ Enrollment already exists', { enrollmentId: existingEnrollment.id });
        await connection.commit();
        return;
      }
    }

    // Créer le nouvel enrollment avec gestion d'erreur UNIQUE constraint
    console.log('[ensureEnrollmentForPayment] 📝 Creating new enrollment', { user_id, course_id, paymentId });
    try {
      await connection.execute(
        `INSERT INTO enrollments (user_id, course_id, status, enrolled_at, payment_id)
         VALUES (?, ?, 'enrolled', NOW(), ?)` ,
        [user_id, course_id, paymentId]
      );
      console.log('[ensureEnrollmentForPayment] ✅ Enrollment created');
    } catch (insertError) {
      // Si erreur UNIQUE constraint (un autre thread a créé l'enrollment entre temps)
      if (insertError.code === 'ER_DUP_ENTRY' || insertError.errno === 1062) {
        console.log('[ensureEnrollmentForPayment] ⚠️ Enrollment already exists (race condition), updating payment_id');
        // Mettre à jour le payment_id de l'enrollment existant
        await connection.execute(
          'UPDATE enrollments SET payment_id = ? WHERE user_id = ? AND course_id = ?',
          [paymentId, user_id, course_id]
        );
        console.log('[ensureEnrollmentForPayment] ✅ Enrollment payment_id updated after race condition');
      } else {
        throw insertError; // Re-lancer l'erreur si ce n'est pas une erreur UNIQUE
      }
    }
    
    await connection.commit();
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('[ensureEnrollmentForPayment] ❌ Error:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
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

    // Pour Kkiapay, on ne crée PAS de paiement "en cours"
    // Le paiement sera créé uniquement dans le webhook après succès/échec
    // Le SDK gère les succès/échecs côté client
    if (paymentMethod === 'kkiapay') {
      console.log('[Payment][Kkiapay] 🚀 Starting Kkiapay flow (no payment record yet)');
      
      const finalCustomerFullname =
        customerFullname ||
        req.user?.fullName ||
        `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() ||
        'Étudiant MdSC';
      const finalCustomerEmail = req.user?.email || customerEmail || 'student@mdsc.local';
      const finalCustomerPhone = customerPhone || req.user?.phone;

      // Générer un temp_payment_id pour les métadonnées
      const tempPaymentId = `temp_${userId}_${courseId}_${Date.now()}`;

      // Préparer les données pour le widget Kkiapay
      const transactionResult = await KkiapayService.createTransaction({
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

    // Pour les autres providers (GobiPay, Mobile Money, etc.), on crée le paiement
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

    // Normaliser les méthodes de paiement pour la base de données
    let normalizedPaymentMethod = paymentMethod;
    let normalizedPaymentProvider = paymentProvider;
    
    // GobiPay est mappé vers 'other' car il n'est plus utilisé
    if (paymentMethod === 'gobipay') {
      normalizedPaymentMethod = 'other';
      normalizedPaymentProvider = 'gobipay';
    }

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

/**
 * Finaliser un paiement Kkiapay (appelé par le frontend après succès)
 * En mode local, Kkiapay ne peut pas envoyer de webhook, donc le frontend appelle cette route
 */
const finalizeKkiapayPayment = async (req, res) => {
  try {
    console.log('[Payment][Kkiapay] 🎯 Finalizing payment - Full request body:', JSON.stringify(req.body, null, 2));
    console.log('[Payment][Kkiapay] 🎯 User from token:', req.user);
    
    const { transaction_id, transactionId, id, amount, currency, metadata } = req.body;
    const userId = req.user.userId;

    // Extraire transaction_id de plusieurs emplacements possibles
    const finalTransactionId = transaction_id || transactionId || id || `kkiapay_${Date.now()}`;

    console.log('[Payment][Kkiapay] 🎯 Finalizing payment', {
      userId,
      transaction_id: finalTransactionId,
      amount,
      currency,
      metadata,
      hasMetadata: !!metadata,
      metadataKeys: metadata ? Object.keys(metadata) : [],
    });

    if (!metadata || !metadata.temp_payment_id || !metadata.user_id || !metadata.course_id) {
      console.error('[Payment][Kkiapay] ❌ Métadonnées incomplètes', {
        metadata,
        hasTempPaymentId: !!metadata?.temp_payment_id,
        hasUserId: !!metadata?.user_id,
        hasCourseId: !!metadata?.course_id,
      });
      return res.status(400).json({
        success: false,
        message: 'Métadonnées incomplètes',
        details: {
          hasMetadata: !!metadata,
          hasTempPaymentId: !!metadata?.temp_payment_id,
          hasUserId: !!metadata?.user_id,
          hasCourseId: !!metadata?.course_id,
        },
      });
    }

    const courseId = parseInt(metadata.course_id, 10);
    const metadataUserId = parseInt(metadata.user_id, 10);

    // Vérifier que l'utilisateur correspond
    if (userId !== metadataUserId) {
      return res.status(403).json({
        success: false,
        message: 'Utilisateur non autorisé',
      });
    }

    // Utiliser une transaction pour éviter les conflits de concurrence
    let connection = null;
    let paymentId;
    
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      // Vérifier si un paiement existe déjà pour cette transaction (avec verrou)
      let [existingPayments] = await connection.execute(
        'SELECT id FROM payments WHERE provider_transaction_id = ? AND payment_provider = "kkiapay" LIMIT 1 FOR UPDATE',
        [finalTransactionId]
      );

      if (existingPayments.length > 0) {
        // Paiement existe déjà, mettre à jour
        paymentId = existingPayments[0].id;
        console.log('[Payment][Kkiapay] 🔄 Updating existing payment', { paymentId });
        
        await connection.execute(
          'UPDATE payments SET status = "completed", completed_at = NOW() WHERE id = ?',
          [paymentId]
        );
      } else {
        // Créer le paiement
        console.log('[Payment][Kkiapay] 📝 Creating payment record', {
          userId,
          courseId,
          amount,
          transaction_id: finalTransactionId,
        });

        // Récupérer les informations du cours
        const [courses] = await connection.execute(
          'SELECT id, title, price, currency FROM courses WHERE id = ?',
          [courseId]
        );

        if (courses.length === 0) {
          await connection.rollback();
          return res.status(404).json({
            success: false,
            message: 'Cours non trouvé',
          });
        }

        const course = courses[0];
        const finalAmount = amount || course.price;
        const finalCurrency = currency || course.currency || 'XOF';

        try {
          const [paymentResult] = await connection.execute(
            `INSERT INTO payments (
              user_id, course_id, amount, currency,
              payment_method, payment_provider, status,
              provider_transaction_id, payment_data, completed_at
            ) VALUES (?, ?, ?, ?, 'kkiapay', 'kkiapay', 'completed', ?, ?, NOW())`,
            [
              userId,
              courseId,
              finalAmount,
              finalCurrency,
              finalTransactionId,
              JSON.stringify(req.body),
            ]
          );

          paymentId = paymentResult.insertId;
          console.log('[Payment][Kkiapay] ✅ Payment record created', { paymentId });
        } catch (insertError) {
          // Si erreur UNIQUE constraint (un autre thread a créé le paiement entre temps)
          if (insertError.code === 'ER_DUP_ENTRY' || insertError.errno === 1062) {
            console.log('[Payment][Kkiapay] ⚠️ Payment already exists (race condition), fetching existing');
            // Récupérer le paiement existant
            const [existing] = await connection.execute(
              'SELECT id FROM payments WHERE provider_transaction_id = ? AND payment_provider = "kkiapay" LIMIT 1',
              [finalTransactionId]
            );
            if (existing.length > 0) {
              paymentId = existing[0].id;
              await connection.execute(
                'UPDATE payments SET status = "completed", completed_at = NOW() WHERE id = ?',
                [paymentId]
              );
            } else {
              throw insertError; // Re-lancer si vraiment pas trouvé
            }
          } else {
            throw insertError; // Re-lancer l'erreur si ce n'est pas une erreur UNIQUE
          }
        }
      }
      
      await connection.commit();
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }

    // CRÉER L'INSCRIPTION - Utiliser la fonction simple qui existe déjà
    console.log('[Payment][Kkiapay] 📝 Ensuring enrollment for payment (NOUVELLE VERSION)', { paymentId });
    await ensureEnrollmentForPayment(paymentId);
    console.log('[Payment][Kkiapay] ✅ Enrollment ensured for payment (NOUVELLE VERSION)', { paymentId });

    // Récupérer le titre du cours pour l'activité
    const [courses] = await pool.execute(
      'SELECT title FROM courses WHERE id = ?',
      [courseId]
    );
    const courseTitle = courses.length > 0 ? courses[0].title : 'Formation';
    
    // Enregistrer l'activité de paiement réussi
    try {
      const { recordActivity } = require('./gamificationController');
      await recordActivity(
        userId,
        'payment_completed',
        0,
        `Paiement effectué pour la formation "${courseTitle}"`,
        {
          course_id: courseId,
          course_title: courseTitle,
          payment_id: paymentId,
          amount: amount,
          currency: currency || 'XOF',
          payment_method: 'kkiapay',
          transaction_id: finalTransactionId,
        }
      );
      console.log('[Payment][Kkiapay] ✅ Activity recorded for payment');
    } catch (activityError) {
      console.error('[Payment][Kkiapay] ❌ Error recording activity:', activityError);
      // Ne pas bloquer le processus si l'activité échoue
    }

    // Récupérer l'enrollment final pour la réponse
    const [finalEnrollment] = await pool.execute(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    res.json({
      success: true,
      message: 'Paiement finalisé avec succès',
      data: {
        payment_id: paymentId,
        enrollment_id: finalEnrollment.length > 0 ? finalEnrollment[0].id : null,
        enrollment_exists: finalEnrollment.length > 0,
        user_id: userId,
        course_id: courseId,
      },
    });

  } catch (error) {
    console.error('[Payment][Kkiapay] ❌ Error finalizing payment:', error);
    console.error('[Payment][Kkiapay] ❌ Error stack:', error.stack);
    console.error('[Payment][Kkiapay] ❌ Error details:', {
      message: error.message,
      code: error.code,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      name: error.name,
    });
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la finalisation du paiement',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        stack: error.stack,
      } : undefined,
    });
  }
};

module.exports = {
  initiatePayment,
  getPaymentStatus,
  getMyPayments,
  finalizeKkiapayPayment
};

