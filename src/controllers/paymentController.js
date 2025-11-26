const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const { buildMediaUrl } = require('../utils/media');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');
const GobiPayServiceClass = require('../services/paymentProviders/gobipayService');
const KkiapayServiceClass = require('../services/paymentProviders/kkiapayService');
const KkiapayService = KkiapayServiceClass.default || new KkiapayServiceClass();
const FedapayServiceClass = require('../services/paymentProviders/fedapayService');
const FedapayService = FedapayServiceClass.default || new FedapayServiceClass();
const paymentConfigService = require('../services/paymentConfigService');

/**
 * Créer une notification pour un paiement
 * @param {number} userId - ID de l'utilisateur
 * @param {number} paymentId - ID du paiement
 * @param {number} courseId - ID du cours
 * @param {string} status - Statut du paiement: 'success', 'failed', 'cancelled'
 * @param {boolean} createActivity - Si true, crée aussi une activité dans user_activities (par défaut: true pour failed/cancelled, false pour success car l'inscription crée déjà une activité)
 */
const createPaymentNotification = async (userId, paymentId, courseId, status = 'success', createActivity = null) => {
  try {
    // Récupérer les infos du cours
    const [courses] = await pool.execute(
      'SELECT title FROM courses WHERE id = ?',
      [courseId]
    );
    const courseTitle = courses.length > 0 ? courses[0].title : 'le cours';

    let title, message, notificationType, activityType, activityDescription, activityPoints;

    switch (status) {
      case 'success':
        title = '✅ Paiement confirmé';
        message = `Votre paiement pour le cours "${courseTitle}" a été confirmé avec succès. Vous pouvez maintenant accéder au cours.`;
        notificationType = 'success';
        // Pour success, l'activité course_enrolled est déjà créée, donc pas besoin de créer une activité de paiement
        activityType = null;
        activityDescription = null;
        activityPoints = 0;
        // Par défaut, ne pas créer d'activité pour success car l'inscription en crée déjà une
        if (createActivity === null) createActivity = false;
        break;
      case 'failed':
        title = '❌ Paiement échoué';
        message = `Votre paiement pour le cours "${courseTitle}" a échoué. Veuillez réessayer ou contacter le support si le problème persiste.`;
        notificationType = 'error';
        activityType = 'payment_failed';
        activityDescription = `Paiement échoué pour le cours "${courseTitle}"`;
        activityPoints = 0;
        if (createActivity === null) createActivity = true;
        break;
      case 'cancelled':
        title = '⚠️ Paiement annulé';
        message = `Votre paiement pour le cours "${courseTitle}" a été annulé. Vous pouvez réessayer quand vous le souhaitez.`;
        notificationType = 'warning';
        activityType = 'payment_cancelled';
        activityDescription = `Paiement annulé pour le cours "${courseTitle}"`;
        activityPoints = 0;
        if (createActivity === null) createActivity = true;
        break;
      case 'pending':
      case 'processing':
        title = '⏳ Paiement en cours';
        message = `Votre paiement pour le cours "${courseTitle}" est en cours de traitement. Vous serez notifié dès que le paiement sera confirmé.`;
        notificationType = 'info';
        activityType = 'payment_pending';
        activityDescription = `Paiement en cours pour le cours "${courseTitle}"`;
        activityPoints = 0;
        if (createActivity === null) createActivity = false; // Ne pas créer d'activité pour pending
        break;
      default:
        title = 'ℹ️ Statut de paiement';
        message = `Le statut de votre paiement pour le cours "${courseTitle}" a été mis à jour.`;
        notificationType = 'info';
        activityType = null;
        activityDescription = null;
        activityPoints = 0;
        if (createActivity === null) createActivity = false;
    }

    // Créer la notification
    await pool.execute(
      `INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        title,
        message,
        notificationType,
        `/dashboard/student/courses`,
        JSON.stringify({ 
          paymentId: paymentId, 
          courseId: courseId, 
          courseTitle: courseTitle,
          paymentStatus: status
        })
      ]
    );

    console.log(`[Payment] ✅ Notification de paiement ${status} créée`, { 
      userId, 
      paymentId, 
      courseId, 
      courseTitle,
      status 
    });

    // Créer une activité si demandé et si le type d'activité est défini
    if (createActivity && activityType) {
      try {
        const { recordActivity } = require('./gamificationController');
        await recordActivity(
          userId,
          activityType,
          activityPoints,
          activityDescription,
          { 
            paymentId: paymentId, 
            courseId: courseId, 
            courseTitle: courseTitle,
            paymentStatus: status
          }
        );
        console.log(`[Payment] ✅ Activity recorded for payment ${status}`, {
          userId,
          paymentId,
          courseId,
          courseTitle,
          activityType
        });
      } catch (activityError) {
        console.error(`[Payment] ❌ Error recording payment activity (${status}):`, activityError);
        // Ne pas bloquer si l'activité échoue
      }
    }
  } catch (notificationError) {
    console.error(`[Payment] ❌ Erreur lors de la création de la notification de paiement (${status}):`, notificationError);
    // Ne pas faire échouer le processus si la notification échoue
  }
};

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
        // Récupérer le titre du cours pour la notification et l'activité
        const [courseInfo] = await pool.execute(
          'SELECT title FROM courses WHERE id = ?',
          [course_id]
        );
        const courseTitle = courseInfo.length > 0 ? courseInfo[0].title : 'Votre formation';

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
        // Créer une notification même si l'enrollment existait déjà mais était inactive
        await createPaymentNotification(user_id, paymentId, course_id, 'success');

        // Créer une activité de réinscription pour les activités récentes
        try {
          const { recordActivity } = require('./gamificationController');
          await recordActivity(
            user_id,
            'course_enrolled',
            10, // Points pour la réinscription
            `Réinscription au cours "${courseTitle}" (paiement réussi)`,
            { 
              courseId: course_id, 
              courseTitle: courseTitle,
              paymentId: paymentId,
              enrollmentId: enrollment.id,
              reactivated: true,
              viaPayment: true
            }
          );
          console.log('[Payment] ✅ Activity recorded for reactivated enrollment', {
            enrollmentId: enrollment.id,
            courseId: course_id,
            courseTitle: courseTitle
          });
        } catch (activityError) {
          console.error('[Payment] ❌ Error recording reactivation activity:', activityError);
          // Ne pas bloquer si l'activité échoue
        }
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
        // Créer quand même une notification pour informer l'utilisateur du paiement réussi
        await createPaymentNotification(user_id, paymentId, course_id, 'success');
      }
      return;
    }

    // Récupérer le titre du cours pour la notification et l'activité
    const [courseInfo] = await pool.execute(
      'SELECT title FROM courses WHERE id = ?',
      [course_id]
    );
    const courseTitle = courseInfo.length > 0 ? courseInfo[0].title : 'Votre formation';

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
    await createPaymentNotification(user_id, paymentId, course_id, 'success');

    // Créer une activité d'inscription pour les activités récentes
    try {
      const { recordActivity } = require('./gamificationController');
      await recordActivity(
        user_id,
        'course_enrolled',
        10, // Points pour l'inscription
        `Inscription au cours "${courseTitle}" (paiement réussi)`,
        { 
          courseId: course_id, 
          courseTitle: courseTitle,
          paymentId: paymentId,
          enrollmentId: enrollmentResult.insertId,
          viaPayment: true
        }
      );
      console.log('[Payment] ✅ Activity recorded for enrollment', {
        enrollmentId: enrollmentResult.insertId,
        courseId: course_id,
        courseTitle: courseTitle
      });
    } catch (activityError) {
      console.error('[Payment] ❌ Error recording enrollment activity:', activityError);
      // Ne pas bloquer si l'activité échoue
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
          console.log('[Payment][Fedapay] ✅ Configuration chargée depuis la base de données', {
            isActive: fedapayConfig.is_active,
            isSandbox: fedapayConfig.is_sandbox,
          });
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
    // On crée un paiement avec statut "pending" ou "processing" avant d'appeler le provider
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

    // Créer un paiement en DB pour GobiPay, Mobile Money et Stripe
    // (contrairement à Kkiapay/Fedapay qui créent le paiement uniquement dans le webhook)
    console.log('[Payment] 📝 Creating payment record in DB', {
      normalizedPaymentMethod,
      normalizedPaymentProvider,
      amount: course.price,
    });

    const [paymentResult] = await pool.execute(
      `INSERT INTO payments (
        user_id, course_id, amount, currency, payment_method, payment_provider, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        userId,
        courseId,
        course.price,
        course.currency || 'XOF',
        normalizedPaymentMethod,
        normalizedPaymentProvider,
      ]
    );

    const paymentId = paymentResult.insertId;
    console.log('[Payment] ✅ Payment record created', { paymentId });

    // Créer une notification pour informer l'utilisateur que le paiement est en cours
    try {
      await createPaymentNotification(userId, paymentId, courseId, 'pending');
    } catch (notificationError) {
      console.error('[Payment] ❌ Erreur lors de la création de la notification d\'initiation:', notificationError);
      // Ne pas faire échouer le processus si la notification échoue
    }

    // Initier le paiement selon le provider
    let paymentData = null;
    let redirectUrl = null;
    let providerTransactionId = null;

    try {
      if (effectivePaymentMethod === 'gobipay') {
        console.log('[Payment][GobiPay] 🚀 Starting GobiPay flow');
        let gobiPayService;
        try {
          const gobiPayConfig = await paymentConfigService.getProviderConfigByName('gobipay');
          if (gobiPayConfig && gobiPayConfig.public_key && gobiPayConfig.secret_key) {
            gobiPayService = new GobiPayServiceClass(gobiPayConfig);
            console.log('[Payment][GobiPay] ✅ Configuration chargée depuis la base de données', {
              isActive: gobiPayConfig.is_active,
              isSandbox: gobiPayConfig.is_sandbox,
              baseUrl: gobiPayConfig.base_url,
              hasMetadata: Boolean(gobiPayConfig.metadata),
            });
          } else {
            gobiPayService = new GobiPayServiceClass();
            console.log('[Payment][GobiPay] ℹ️ Utilisation des variables d\'environnement (config DB non disponible)');
          }
        } catch (configError) {
          gobiPayService = new GobiPayServiceClass();
          console.warn('[Payment][GobiPay] ⚠️ Erreur lors du chargement de la config DB, utilisation des variables d\'environnement:', configError.message);
        }
        const platformMoney = gobiPayService.getPlatformMoneyList();
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
        const orderResult = await gobiPayService.createOrder({
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

        // Extraire order_uuid et store_slug depuis createOrder
        const orderUuid = orderResult.uuid || orderData.uuid || orderData.slug || orderResult.identifier;
        const storeSlugRaw = orderResult.store_slug || orderData.store || orderData.store_slug || orderData.store_identifier;
        
        // Normaliser store_slug : peut être un objet avec une propriété 'slug' ou une chaîne
        let storeSlug = null;
        if (storeSlugRaw) {
          if (typeof storeSlugRaw === 'string') {
            storeSlug = storeSlugRaw;
          } else if (typeof storeSlugRaw === 'object' && storeSlugRaw.slug) {
            storeSlug = storeSlugRaw.slug;
          } else if (typeof storeSlugRaw === 'object' && storeSlugRaw.identifier) {
            storeSlug = storeSlugRaw.identifier;
          }
        }
        
        // Construire l'URL de redirection GobiPay au format officiel
        let paymentUrlFromOrder = null;
        if (orderUuid && storeSlug) {
          paymentUrlFromOrder = `https://pay.gobiworld.com/payment/?store=${storeSlug}&order=${orderUuid}`;
          console.log('[Payment][GobiPay] 🔗 URL de redirection construite:', {
            storeSlug,
            orderUuid,
            paymentUrl: paymentUrlFromOrder,
          });
        } else {
          // Fallback sur les autres formats
          paymentUrlFromOrder = orderResult.payment_url || orderData.payment_url || orderData.redirect_url || orderData.payment_link || orderData.link;
        }

        console.log('[Payment][GobiPay] 🔄 Initiating transaction', {
          paymentId,
          orderUuid,
          storeSlug,
          paymentUrlFromOrder,
        });
        const transactionResult = await gobiPayService.initTransaction({
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
          paymentUrlFromTransaction: transactionResult.payment_url,
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
        const payResult = await gobiPayService.payOrder(transactionIdentifier);
        console.log('[Payment][GobiPay] ✅ Pay order response', {
          paymentId,
          redirect: payResult.redirect,
          redirectUrl: payResult.redirect_url,
          status: payResult.status,
        });

        // Construire l'URL de redirection GobiPay au format officiel
        // Priorité : order_uuid depuis orderData > payResult > transactionResult > orderResult
        // IMPORTANT : Utiliser l'UUID de la commande (order), pas celui de la transaction
        const finalOrderUuid = 
          orderData.uuid || // UUID de la commande (order)
          orderResult.uuid || // UUID depuis createOrder
          payResult.order_uuid || 
          transactionResult.extra?.order_uuid ||
          orderUuid ||
          null;
        
        // Récupérer le store_slug depuis le service (peut être dans la configuration)
        const serviceStoreSlug = gobiPayService.storeSlug || null;
        
        const finalStoreSlugRaw = 
          payResult.store_slug || 
          transactionResult.extra?.store || 
          transactionResult.extra?.store_slug ||
          storeSlug ||
          serviceStoreSlug || // Fallback sur la configuration du service
          null;
        
        // Normaliser finalStoreSlug : peut être un objet avec une propriété 'slug' ou une chaîne
        let finalStoreSlug = null;
        if (finalStoreSlugRaw) {
          if (typeof finalStoreSlugRaw === 'string') {
            finalStoreSlug = finalStoreSlugRaw;
          } else if (typeof finalStoreSlugRaw === 'object' && finalStoreSlugRaw.slug) {
            finalStoreSlug = finalStoreSlugRaw.slug;
          } else if (typeof finalStoreSlugRaw === 'object' && finalStoreSlugRaw.identifier) {
            finalStoreSlug = finalStoreSlugRaw.identifier;
          }
        }
        
        // Si on a order_uuid et store_slug, construire l'URL officielle GobiPay
        if (finalOrderUuid && finalStoreSlug) {
          redirectUrl = `https://pay.gobiworld.com/payment/?store=${finalStoreSlug}&order=${finalOrderUuid}`;
          console.log('[Payment][GobiPay] 🔗 URL de redirection officielle construite:', {
            storeSlug: finalStoreSlug,
            orderUuid: finalOrderUuid,
            redirectUrl,
          });
        } else {
          // Fallback : utiliser les URLs retournées par les API
          redirectUrl = 
            payResult.redirect_url || 
            transactionResult.payment_url || 
            paymentUrlFromOrder || 
            null;
          
          // Si on a une URL relative, construire l'URL complète
          if (redirectUrl && !redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
            const gobiBaseUrl = gobiPayService.baseUrl || 'https://api-pay.gobiworld.com/api';
            redirectUrl = redirectUrl.startsWith('/') 
              ? `${gobiBaseUrl}${redirectUrl}`
              : `${gobiBaseUrl}/${redirectUrl}`;
            console.log('[Payment][GobiPay] 🔗 URL complète construite depuis URL relative:', {
              original: payResult.redirect_url || transactionResult.payment_url || paymentUrlFromOrder,
              final: redirectUrl,
            });
          }
        }
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

      // Créer une notification pour l'échec
      try {
        await createPaymentNotification(userId, paymentId, courseId, 'failed');
      } catch (notificationError) {
        console.error('[Payment] ❌ Erreur lors de la création de la notification d\'échec:', notificationError);
      }

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
 * Finaliser un paiement GobiPay après redirection
 */
const finalizeGobipayPayment = async (req, res) => {
  try {
    const { transaction_slug, order_slug } = req.query;
    const userId = req.user?.userId;

    if (!transaction_slug && !order_slug) {
      return res.status(400).json({
        success: false,
        message: 'transaction_slug ou order_slug est requis'
      });
    }

    console.log('[Payment][GobiPay] 🔍 Finalizing payment', {
      transaction_slug,
      order_slug,
      userId,
      query: req.query,
      headers: {
        accept: req.headers.accept,
        'user-agent': req.headers['user-agent'],
      },
    });

    // Trouver le paiement correspondant
    // Essayer d'abord avec transaction_slug, puis order_slug
    let payments = [];
    let identifier = transaction_slug || order_slug;
    
    // Si pas d'identifier mais qu'on a payment=success, chercher les paiements récents
    if (!identifier && (req.query.payment === 'success' || req.query.payment === 'failed' || req.query.payment === 'cancelled')) {
      console.log('[Payment][GobiPay] 🔍 No identifier, searching recent payments', { userId });
      
      // Chercher d'abord avec userId si disponible
      if (userId) {
        [payments] = await pool.execute(
          `SELECT p.*, c.title as course_title 
           FROM payments p
           JOIN courses c ON p.course_id = c.id
           WHERE p.payment_provider = 'gobipay' 
           AND p.user_id = ?
           AND (p.status = 'processing' OR p.status = 'pending')
           AND p.created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
           ORDER BY p.created_at DESC LIMIT 1`,
          [userId]
        );
        
        if (payments.length > 0) {
          console.log('[Payment][GobiPay] ✅ Found recent payment without identifier (with userId)', {
            paymentId: payments[0].id,
            userId,
          });
        }
      }
      
      // Si pas trouvé avec userId, chercher tous les paiements récents (pour les callbacks sans auth)
      if (payments.length === 0) {
        [payments] = await pool.execute(
          `SELECT p.*, c.title as course_title 
           FROM payments p
           JOIN courses c ON p.course_id = c.id
           WHERE p.payment_provider = 'gobipay' 
           AND (p.status = 'processing' OR p.status = 'pending')
           AND p.created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
           ORDER BY p.created_at DESC LIMIT 1`,
          []
        );
        
        if (payments.length > 0) {
          console.log('[Payment][GobiPay] ✅ Found recent payment without identifier (no userId)', {
            paymentId: payments[0].id,
          });
        }
      }
    }
    
    // Si toujours pas de paiement trouvé et qu'on a un identifier, chercher normalement
    if (payments.length === 0 && identifier) {
      // Chercher d'abord par provider_transaction_id
      [payments] = await pool.execute(
      `SELECT p.*, c.title as course_title 
       FROM payments p
       JOIN courses c ON p.course_id = c.id
       WHERE p.provider_transaction_id = ? AND p.payment_provider = 'gobipay'
       ${userId ? 'AND p.user_id = ?' : ''}
       ORDER BY p.created_at DESC LIMIT 1`,
      userId ? [identifier, userId] : [identifier]
    );

    // Si pas trouvé, chercher dans payment_data (JSON)
    if (payments.length === 0) {
      console.log('[Payment][GobiPay] 🔍 Searching in payment_data', { identifier });
      [payments] = await pool.execute(
        `SELECT p.*, c.title as course_title 
         FROM payments p
         JOIN courses c ON p.course_id = c.id
         WHERE p.payment_provider = 'gobipay'
         AND (
           JSON_EXTRACT(p.payment_data, '$.transaction.identifier') = ?
           OR JSON_EXTRACT(p.payment_data, '$.transaction.slug') = ?
           OR JSON_EXTRACT(p.payment_data, '$.pay.data.exchange_transaction.slug') = ?
           OR JSON_EXTRACT(p.payment_data, '$.pay.data.exchange_transaction.gobi_app_transaction_id') = ?
           OR JSON_EXTRACT(p.payment_data, '$.order.identifier') = ?
           OR JSON_EXTRACT(p.payment_data, '$.order.slug') = ?
         )
         ${userId ? 'AND p.user_id = ?' : ''}
         ORDER BY p.created_at DESC LIMIT 1`,
        userId 
          ? [JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), userId]
          : [JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier)]
      );
    }

    // Si toujours pas trouvé, chercher les paiements récents en processing
    if (payments.length === 0) {
      console.log('[Payment][GobiPay] 🔍 Searching recent processing payments', { identifier });
      [payments] = await pool.execute(
        `SELECT p.*, c.title as course_title 
         FROM payments p
         JOIN courses c ON p.course_id = c.id
         WHERE p.payment_provider = 'gobipay' 
         AND p.status = 'processing'
         ${userId ? 'AND p.user_id = ?' : ''}
         ORDER BY p.created_at DESC LIMIT 5`,
        userId ? [userId] : []
      );
      
      // Filtrer manuellement dans les résultats
      if (payments.length > 0) {
        const matchingPayment = payments.find(p => {
          try {
            const paymentData = typeof p.payment_data === 'string' ? JSON.parse(p.payment_data) : p.payment_data;
            const transactionId = 
              paymentData?.transaction?.identifier ||
              paymentData?.transaction?.slug ||
              paymentData?.pay?.data?.exchange_transaction?.slug ||
              paymentData?.pay?.data?.exchange_transaction?.gobi_app_transaction_id ||
              paymentData?.order?.identifier ||
              paymentData?.order?.slug ||
              p.provider_transaction_id;
            return transactionId === identifier || transactionId === transaction_slug || transactionId === order_slug;
          } catch (e) {
            return false;
          }
        });
        
        if (matchingPayment) {
          payments = [matchingPayment];
        } else {
          payments = [];
        }
      }
    }
    } // Fin du bloc if (payments.length === 0 && identifier)

    // Si toujours pas trouvé et qu'on a un userId, chercher les paiements récents de l'utilisateur
    if (payments.length === 0 && userId) {
      console.log('[Payment][GobiPay] 🔍 Searching recent payments for user', { userId });
      [payments] = await pool.execute(
        `SELECT p.*, c.title as course_title 
         FROM payments p
         JOIN courses c ON p.course_id = c.id
         WHERE p.payment_provider = 'gobipay' 
         AND p.user_id = ?
         AND (p.status = 'processing' OR p.status = 'pending')
         ORDER BY p.created_at DESC LIMIT 1`,
        [userId]
      );
      
      if (payments.length > 0) {
        console.log('[Payment][GobiPay] ✅ Found recent payment for user', {
          paymentId: payments[0].id,
          userId,
        });
      }
    }

    if (payments.length === 0) {
      console.warn('[Payment][GobiPay] ❌ Payment not found', { 
        identifier,
        transaction_slug,
        order_slug,
        userId,
        searchAttempts: 4
      });
      
      // Si c'est une requête depuis le navigateur, rediriger quand même vers le frontend
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html') || !req.headers['content-type']?.includes('application/json')) {
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
        return res.redirect(`${frontendUrl}/dashboard/student/courses?payment=error&message=payment_not_found`);
      }
      
      return res.status(404).json({
        success: false,
        message: 'Paiement non trouvé. Veuillez vérifier les paramètres de redirection.'
      });
    }

    const payment = payments[0];

    // Si le paiement est déjà complété, vérifier l'enrollment et rediriger
    if (payment.status === 'completed') {
      console.log('[Payment][GobiPay] ✅ Payment already completed', { paymentId: payment.id });
      
      // S'assurer que l'enrollment existe
      await ensureEnrollmentForPayment(payment.id);
      
      // Rediriger vers le frontend
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
      const redirectUrl = `${frontendUrl}/dashboard/student/courses?payment=success&course_id=${payment.course_id}`;
      
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html') || !req.headers['content-type']?.includes('application/json')) {
        console.log('[Payment][GobiPay] 🔄 Redirecting to frontend (already completed)', { redirectUrl });
        return res.redirect(redirectUrl);
      }
      
      return res.json({
        success: true,
        message: 'Paiement déjà finalisé',
        data: {
          payment_id: payment.id,
          status: payment.status,
          course_id: payment.course_id,
        }
      });
    }

    // Vérifier le statut avec GobiPay
    let gobiPayService;
    try {
      const gobiPayConfig = await paymentConfigService.getProviderConfigByName('gobipay');
      if (gobiPayConfig && gobiPayConfig.public_key && gobiPayConfig.secret_key) {
        gobiPayService = new GobiPayServiceClass(gobiPayConfig);
      } else {
        gobiPayService = new GobiPayServiceClass();
      }
    } catch (configError) {
      gobiPayService = new GobiPayServiceClass();
    }

    let transactionStatusValue = null;
    try {
      const transactionStatus = await gobiPayService.getTransactionStatus(identifier);
      const statusData = transactionStatus?.data || transactionStatus || {};
      transactionStatusValue = statusData.status || statusData.transaction_status || statusData.exchange_transaction?.status || null;

      console.log('[Payment][GobiPay] 📊 Transaction status from API', {
        paymentId: payment.id,
        identifier,
        status: transactionStatusValue,
        fullResponse: JSON.stringify(transactionStatus, null, 2),
      });
    } catch (statusError) {
      console.error('[Payment][GobiPay] ⚠️ Error checking transaction status', {
        error: statusError.message,
        identifier,
      });
      // Si on ne peut pas vérifier le statut mais que le paiement est en processing,
      // on considère que c'est peut-être un succès (GobiPay a redirigé vers success)
      if (req.query.payment === 'success' || req.query.status === 'true') {
        transactionStatusValue = 'SUCCESS';
        console.log('[Payment][GobiPay] ✅ Assuming success from redirect parameters');
      }
    }

    // Vérifier si les paramètres de redirection indiquent un succès
    const isSuccessFromParams = req.query.payment === 'success' || req.query.status === 'true' || req.query.status === true;
    
    console.log('[Payment][GobiPay] 🔍 Payment status check', {
      paymentId: payment.id,
      currentStatus: payment.status,
      transactionStatusValue,
      isSuccessFromParams,
      queryParams: req.query,
    });
    
    // FORCER la création de l'enrollment si les paramètres indiquent un succès
    // Même si le statut de l'API n'est pas encore SUCCESS, on crée l'enrollment
    if (isSuccessFromParams) {
      console.log('[Payment][GobiPay] 🚀 FORCING enrollment creation from success parameters');
      
      // Mettre à jour le statut du paiement
      if (payment.status !== 'completed') {
        await pool.execute(
          'UPDATE payments SET status = "completed", completed_at = NOW() WHERE id = ?',
          [payment.id]
        );
        console.log('[Payment][GobiPay] 📝 Payment status updated to completed', { paymentId: payment.id });
      }

      // FORCER la création de l'inscription
      try {
        await ensureEnrollmentForPayment(payment.id);
        console.log('[Payment][GobiPay] ✅✅✅ Enrollment FORCED and created', {
          paymentId: payment.id,
          courseId: payment.course_id,
          userId: payment.user_id,
        });
      } catch (enrollmentError) {
        console.error('[Payment][GobiPay] ❌❌❌ CRITICAL: Error creating enrollment', {
          error: enrollmentError.message,
          stack: enrollmentError.stack,
          paymentId: payment.id,
          courseId: payment.course_id,
          userId: payment.user_id,
        });
        // Ne pas faire échouer la requête, mais logger l'erreur de manière visible
      }
    }
    
    // Mettre à jour le statut du paiement si l'API confirme le succès
    if (transactionStatusValue === 'SUCCESS' || transactionStatusValue === 'COMPLETED' || transactionStatusValue === 'PAID') {
      // Si le paiement n'est pas encore complété, le mettre à jour
      if (payment.status !== 'completed') {
        await pool.execute(
          'UPDATE payments SET status = "completed", completed_at = NOW() WHERE id = ?',
          [payment.id]
        );
        console.log('[Payment][GobiPay] 📝 Payment status updated to completed from API', { paymentId: payment.id });
      }

      // Créer l'inscription automatiquement (même si le paiement est déjà complété, s'assurer que l'enrollment existe)
      if (!isSuccessFromParams) {
        // Seulement si on ne l'a pas déjà fait ci-dessus
        try {
          await ensureEnrollmentForPayment(payment.id);
          console.log('[Payment][GobiPay] ✅ Enrollment ensured from API status', {
            paymentId: payment.id,
            courseId: payment.course_id,
            userId: payment.user_id,
          });
        } catch (enrollmentError) {
          console.error('[Payment][GobiPay] ❌ Error creating enrollment', {
            error: enrollmentError.message,
            paymentId: payment.id,
          });
        }
      }
    }
    
    // Si les paramètres indiquent un succès OU l'API confirme le succès, rediriger
    if (isSuccessFromParams || transactionStatusValue === 'SUCCESS' || transactionStatusValue === 'COMPLETED' || transactionStatusValue === 'PAID') {

      // Rediriger vers le frontend (toujours pour les callbacks)
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
      const redirectUrl = `${frontendUrl}/dashboard/student/courses?payment=success&course_id=${payment.course_id}`;
      
      // Si c'est une requête depuis le navigateur (callback), rediriger
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html') || !req.headers['content-type']?.includes('application/json')) {
        console.log('[Payment][GobiPay] 🔄 Redirecting to frontend', { redirectUrl });
        return res.redirect(redirectUrl);
      }

      return res.json({
        success: true,
        message: 'Paiement finalisé avec succès',
        data: {
          payment_id: payment.id,
          status: 'completed',
          course_id: payment.course_id,
          course_title: payment.course_title,
        }
      });
    } else if (transactionStatusValue === 'FAILED' || transactionStatusValue === 'CANCELLED' || transactionStatusValue === 'CANCELED' || req.query.payment === 'failed' || req.query.payment === 'cancelled') {
      // Mettre à jour le statut du paiement
      const errorStatus = req.query.payment === 'cancelled' ? 'cancelled' : 'failed';
      await pool.execute(
        'UPDATE payments SET status = ?, error_message = ? WHERE id = ?',
        [errorStatus, 'Paiement échoué ou annulé', payment.id]
      );

      // Créer une notification pour l'échec ou l'annulation
      await createPaymentNotification(payment.user_id, payment.id, payment.course_id, errorStatus);

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
      const redirectUrl = `${frontendUrl}/dashboard/student/courses?payment=${errorStatus}`;
      
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html') || !req.headers['content-type']?.includes('application/json')) {
        console.log('[Payment][GobiPay] 🔄 Redirecting to frontend (failed/cancelled)', { redirectUrl });
        return res.redirect(redirectUrl);
      }

      return res.json({
        success: false,
        message: 'Paiement échoué ou annulé',
        data: {
          payment_id: payment.id,
          status: errorStatus,
        }
      });
    } else {
      // Statut encore en attente ou inconnu
      // Si les paramètres indiquent un succès, créer quand même l'enrollment
      if (isSuccessFromParams) {
        console.log('[Payment][GobiPay] ⚠️ Status unknown but params indicate success, creating enrollment anyway');
        if (payment.status !== 'completed') {
          await pool.execute(
            'UPDATE payments SET status = "completed", completed_at = NOW() WHERE id = ?',
            [payment.id]
          );
        }
        await ensureEnrollmentForPayment(payment.id);
        
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
        const redirectUrl = `${frontendUrl}/dashboard/student/courses?payment=success&course_id=${payment.course_id}`;
        
        const acceptHeader = req.headers.accept || '';
        if (acceptHeader.includes('text/html') || !req.headers['content-type']?.includes('application/json')) {
          return res.redirect(redirectUrl);
        }
      }
      
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
      const redirectUrl = `${frontendUrl}/dashboard/student/courses?payment=pending`;
      
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html') || !req.headers['content-type']?.includes('application/json')) {
        return res.redirect(redirectUrl);
      }
      
      return res.json({
        success: true,
        message: 'Paiement en cours de traitement',
        data: {
          payment_id: payment.id,
          status: payment.status,
        }
      });
    }

  } catch (error) {
    console.error('[Payment][GobiPay] ❌ Error finalizing payment', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la finalisation du paiement',
      error: error.message
    });
  }
};

/**
 * Finaliser automatiquement un paiement GobiPay - Version agressive
 * Cette fonction force la création de l'enrollment même si le paiement n'est pas trouvé par identifier
 * Elle cherche les paiements récents et crée l'enrollment pour tous les paiements en processing
 */
const autoFinalizeGobipayPayment = async (req, res) => {
  try {
    const { payment, transaction_slug, order_slug, status } = req.query;
    const userId = req.user?.userId;

    console.log('[Payment][GobiPay][Auto] 🚀 Auto-finalizing payment', {
      payment,
      transaction_slug,
      order_slug,
      status,
      userId,
      query: req.query,
    });

    // Si payment=success, chercher et finaliser TOUS les paiements GobiPay récents
    if (payment === 'success' || status === 'true' || status === true) {
      let payments = [];

      // Chercher par identifier si disponible
      if (transaction_slug || order_slug) {
        const identifier = transaction_slug || order_slug;
        [payments] = await pool.execute(
          `SELECT p.*, c.title as course_title 
           FROM payments p
           JOIN courses c ON p.course_id = c.id
           WHERE p.payment_provider = 'gobipay'
           AND (
             p.provider_transaction_id = ?
             OR JSON_EXTRACT(p.payment_data, '$.transaction.slug') = ?
             OR JSON_EXTRACT(p.payment_data, '$.transaction.identifier') = ?
             OR JSON_EXTRACT(p.payment_data, '$.pay.data.exchange_transaction.slug') = ?
             OR JSON_EXTRACT(p.payment_data, '$.order.slug') = ?
             OR JSON_EXTRACT(p.payment_data, '$.order.identifier') = ?
           )
           ${userId ? 'AND p.user_id = ?' : ''}
           ORDER BY p.created_at DESC LIMIT 5`,
          userId
            ? [identifier, JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), userId]
            : [identifier, JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier)]
        );
      }

      // Si pas trouvé, chercher TOUS les paiements récents (des 15 dernières minutes)
      if (payments.length === 0) {
        console.log('[Payment][GobiPay][Auto] 🔍 Searching ALL recent GobiPay payments');
        [payments] = await pool.execute(
          `SELECT p.*, c.title as course_title 
           FROM payments p
           JOIN courses c ON p.course_id = c.id
           WHERE p.payment_provider = 'gobipay' 
           AND (p.status = 'processing' OR p.status = 'pending')
           AND p.created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
           ${userId ? 'AND p.user_id = ?' : ''}
           ORDER BY p.created_at DESC LIMIT 5`,
          userId ? [userId] : []
        );
      }

      if (payments.length === 0) {
        console.warn('[Payment][GobiPay][Auto] ❌ No recent payments found');
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
        return res.redirect(`${frontendUrl}/dashboard/student/courses?payment=error&message=no_payment_found`);
      }

      console.log('[Payment][GobiPay][Auto] 📋 Found payments to finalize', {
        count: payments.length,
        paymentIds: payments.map(p => p.id),
      });

      // Finaliser TOUS les paiements trouvés
      let finalizedCount = 0;
      let enrollmentCreated = false;

      for (const payment of payments) {
        try {
          // Mettre à jour le statut
          if (payment.status !== 'completed') {
            await pool.execute(
              'UPDATE payments SET status = "completed", completed_at = NOW() WHERE id = ?',
              [payment.id]
            );
            console.log('[Payment][GobiPay][Auto] 📝 Payment updated to completed', { paymentId: payment.id });
          }

          // FORCER la création de l'enrollment
          try {
            await ensureEnrollmentForPayment(payment.id);
            enrollmentCreated = true;
            finalizedCount++;
            console.log('[Payment][GobiPay][Auto] ✅✅✅ Enrollment FORCED and created', {
              paymentId: payment.id,
              courseId: payment.course_id,
              userId: payment.user_id,
            });
          } catch (enrollmentError) {
            console.error('[Payment][GobiPay][Auto] ❌❌❌ CRITICAL: Enrollment creation failed', {
              paymentId: payment.id,
              error: enrollmentError.message,
              stack: enrollmentError.stack,
            });
          }
        } catch (error) {
          console.error('[Payment][GobiPay][Auto] ❌ Error finalizing payment', {
            paymentId: payment.id,
            error: error.message,
          });
        }
      }

      // Rediriger vers le frontend
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
      const courseId = payments[0]?.course_id;
      const redirectUrl = `${frontendUrl}/dashboard/student/courses?payment=success${courseId ? `&course_id=${courseId}` : ''}`;

      console.log('[Payment][GobiPay][Auto] 🔄 Redirecting to frontend', {
        redirectUrl,
        finalizedCount,
        enrollmentCreated,
      });

      return res.redirect(redirectUrl);
    }

    // Pour failed ou cancelled, créer une notification et rediriger
    if (payment === 'failed' || payment === 'cancelled') {
      // Chercher le paiement le plus récent pour créer la notification
      let recentPayments = [];
      if (userId) {
        [recentPayments] = await pool.execute(
          `SELECT p.* FROM payments p
           WHERE p.payment_provider = 'gobipay' 
           AND p.user_id = ?
           AND p.created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
           ORDER BY p.created_at DESC LIMIT 1`,
          [userId]
        );
      } else {
        [recentPayments] = await pool.execute(
          `SELECT p.* FROM payments p
           WHERE p.payment_provider = 'gobipay' 
           AND (p.status = 'processing' OR p.status = 'pending')
           AND p.created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
           ORDER BY p.created_at DESC LIMIT 1`,
          []
        );
      }

      if (recentPayments.length > 0) {
        const recentPayment = recentPayments[0];
        // Mettre à jour le statut si nécessaire
        if (recentPayment.status !== payment) {
          await pool.execute(
            'UPDATE payments SET status = ?, error_message = ? WHERE id = ?',
            [payment, `Paiement ${payment === 'failed' ? 'échoué' : 'annulé'}`, recentPayment.id]
          );
        }
        // Créer la notification
        await createPaymentNotification(recentPayment.user_id, recentPayment.id, recentPayment.course_id, payment);
      }
    }

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
    return res.redirect(`${frontendUrl}/dashboard/student/courses?payment=${payment || 'error'}`);

  } catch (error) {
    console.error('[Payment][GobiPay][Auto] ❌❌❌ CRITICAL ERROR', {
      message: error.message,
      stack: error.stack,
    });
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
    return res.redirect(`${frontendUrl}/dashboard/student/courses?payment=error`);
  }
};

/**
 * Finaliser automatiquement les paiements GobiPay récents non finalisés
 * Cette fonction est appelée depuis le frontend pour finaliser automatiquement les paiements
 */
const finalizeRecentGobipayPayments = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    console.log('[Payment][GobiPay] 🔍 Finalizing recent payments for user', { userId });

    // Chercher les paiements GobiPay récents (des 10 dernières minutes) en processing ou pending
    const [payments] = await pool.execute(
      `SELECT p.*, c.title as course_title 
       FROM payments p
       JOIN courses c ON p.course_id = c.id
       WHERE p.payment_provider = 'gobipay' 
       AND p.user_id = ?
       AND (p.status = 'processing' OR p.status = 'pending')
       AND p.created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
       ORDER BY p.created_at DESC
       LIMIT 5`,
      [userId]
    );

    if (payments.length === 0) {
      console.log('[Payment][GobiPay] ℹ️ No recent payments to finalize', { userId });
      return res.json({
        success: true,
        message: 'Aucun paiement récent à finaliser',
        finalized: 0
      });
    }

    console.log('[Payment][GobiPay] 📋 Found recent payments', {
      count: payments.length,
      paymentIds: payments.map(p => p.id),
    });

    let finalizedCount = 0;
    const results = [];

    for (const payment of payments) {
      try {
        // Mettre à jour le statut du paiement à completed
        await pool.execute(
          'UPDATE payments SET status = "completed", completed_at = NOW() WHERE id = ?',
          [payment.id]
        );

        // Créer l'inscription automatiquement
        await ensureEnrollmentForPayment(payment.id);

        finalizedCount++;
        results.push({
          payment_id: payment.id,
          course_id: payment.course_id,
          course_title: payment.course_title,
          status: 'completed',
          enrollment_created: true
        });

        console.log('[Payment][GobiPay] ✅✅✅ Payment finalized and enrollment created', {
          paymentId: payment.id,
          courseId: payment.course_id,
          userId: payment.user_id,
        });
      } catch (error) {
        console.error('[Payment][GobiPay] ❌ Error finalizing payment', {
          paymentId: payment.id,
          error: error.message,
        });
        results.push({
          payment_id: payment.id,
          course_id: payment.course_id,
          status: 'error',
          error: error.message
        });
      }
    }

    return res.json({
      success: true,
      message: `${finalizedCount} paiement(s) finalisé(s) avec succès`,
      finalized: finalizedCount,
      total: payments.length,
      results
    });

  } catch (error) {
    console.error('[Payment][GobiPay] ❌ Error finalizing recent payments', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la finalisation des paiements',
      error: error.message
    });
  }
};

/**
 * Finaliser un paiement GobiPay depuis le frontend (route alternative)
 * Cette fonction est appelée depuis le frontend quand GobiPay redirige directement
 */
const finalizeGobipayPaymentFromFrontend = async (req, res) => {
  try {
    const { transaction_slug, order_slug, payment, status } = req.body;
    const userId = req.user?.userId;

    console.log('[Payment][GobiPay][Frontend] 🔍 Finalizing payment from frontend', {
      transaction_slug,
      order_slug,
      payment,
      status,
      userId,
    });

    // Si les paramètres indiquent un succès, chercher le paiement et créer l'enrollment
    if (payment === 'success' || status === 'true' || status === true) {
      // Chercher tous les paiements GobiPay récents pour cet utilisateur
      let payments = [];
      
      if (userId) {
        [payments] = await pool.execute(
          `SELECT p.*, c.title as course_title 
           FROM payments p
           JOIN courses c ON p.course_id = c.id
           WHERE p.payment_provider = 'gobipay' 
           AND p.user_id = ?
           AND (p.status = 'processing' OR p.status = 'pending')
           ORDER BY p.created_at DESC LIMIT 10`,
          [userId]
        );
      } else if (transaction_slug || order_slug) {
        // Chercher par transaction_slug ou order_slug
        const identifier = transaction_slug || order_slug;
        [payments] = await pool.execute(
          `SELECT p.*, c.title as course_title 
           FROM payments p
           JOIN courses c ON p.course_id = c.id
           WHERE p.payment_provider = 'gobipay'
           AND (
             p.provider_transaction_id = ?
             OR JSON_EXTRACT(p.payment_data, '$.transaction.slug') = ?
             OR JSON_EXTRACT(p.payment_data, '$.transaction.identifier') = ?
             OR JSON_EXTRACT(p.payment_data, '$.pay.data.exchange_transaction.slug') = ?
             OR JSON_EXTRACT(p.payment_data, '$.order.slug') = ?
             OR JSON_EXTRACT(p.payment_data, '$.order.identifier') = ?
           )
           ORDER BY p.created_at DESC LIMIT 5`,
          [identifier, JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier), JSON.stringify(identifier)]
        );
      }

      if (payments.length === 0) {
        console.warn('[Payment][GobiPay][Frontend] ❌ No payment found', {
          transaction_slug,
          order_slug,
          userId,
        });
        return res.json({
          success: false,
          message: 'Paiement non trouvé. Veuillez réessayer ou contacter le support.',
        });
      }

      // Prendre le paiement le plus récent
      const payment = payments[0];

      // Mettre à jour le statut du paiement
      if (payment.status !== 'completed') {
        await pool.execute(
          'UPDATE payments SET status = "completed", completed_at = NOW() WHERE id = ?',
          [payment.id]
        );
        console.log('[Payment][GobiPay][Frontend] 📝 Payment status updated to completed', { paymentId: payment.id });
      }

      // Créer l'inscription automatiquement
      try {
        await ensureEnrollmentForPayment(payment.id);
        console.log('[Payment][GobiPay][Frontend] ✅ Enrollment ensured', {
          paymentId: payment.id,
          courseId: payment.course_id,
          userId: payment.user_id,
        });
      } catch (enrollmentError) {
        console.error('[Payment][GobiPay][Frontend] ❌ Error creating enrollment', {
          error: enrollmentError.message,
          paymentId: payment.id,
        });
      }

      return res.json({
        success: true,
        message: 'Paiement finalisé avec succès',
        data: {
          payment_id: payment.id,
          status: 'completed',
          course_id: payment.course_id,
          course_title: payment.course_title,
        }
      });
    }

    return res.json({
      success: false,
      message: 'Paramètres de paiement invalides',
    });

  } catch (error) {
    console.error('[Payment][GobiPay][Frontend] ❌ Error', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la finalisation du paiement',
      error: error.message
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
 * Finaliser un paiement Fedapay (appelé par le callback frontend après succès ou échec)
 */
const finalizeFedapayPayment = async (req, res) => {
  try {
    console.log('========================================');
    console.log('[Payment][Fedapay] 📥📥📥 FINALIZING PAYMENT 📥📥📥');
    console.log('========================================');
    console.log('[Payment][Fedapay] 📦 REQUEST BODY (FULL):', JSON.stringify(req.body, null, 2));
    console.log('[Payment][Fedapay] 📦 REQUEST BODY (STRUCTURE):', {
      hasTransactionId: !!req.body.transaction_id,
      hasStatus: !!req.body.status,
      hasAmount: !!req.body.amount,
      hasCurrency: !!req.body.currency,
      hasErrorMessage: !!req.body.error_message,
      hasMetadata: !!req.body.metadata,
      hasTransactionData: !!req.body.transaction_data,
      keys: Object.keys(req.body),
    });
    console.log('========================================');

    const {
      transaction_id,
      status,
      amount,
      currency,
      error_message,
      metadata,
      transaction_data
    } = req.body;

    console.log('[Payment][Fedapay] 📋 EXTRACTED VALUES:', {
      transaction_id,
      status,
      amount,
      currency,
      error_message,
      metadata: metadata ? {
        user_id: metadata.user_id,
        course_id: metadata.course_id,
        temp_payment_id: metadata.temp_payment_id,
        allKeys: Object.keys(metadata),
      } : null,
      transaction_data: transaction_data ? {
        hasId: !!transaction_data.id,
        hasTransactionId: !!transaction_data.transaction_id,
        hasTransaction: !!transaction_data.transaction,
        hasStatus: !!transaction_data.status,
        hasState: !!transaction_data.state,
        status: transaction_data.status,
        state: transaction_data.state,
        transactionStatus: transaction_data.transaction?.status,
        transactionState: transaction_data.transaction?.state,
        keys: Object.keys(transaction_data),
        fullData: JSON.stringify(transaction_data, null, 2),
      } : null,
    });

    // Vérifier que les métadonnées sont présentes
    if (!metadata) {
      console.error('[Payment][Fedapay] ❌ Missing metadata object', { body: req.body });
      return res.status(400).json({
        success: false,
        message: 'Les métadonnées du paiement sont manquantes',
        error: 'metadata object is missing'
      });
    }

    if (!metadata.user_id) {
      console.error('[Payment][Fedapay] ❌ Missing user_id in metadata', { metadata, body: req.body });
      return res.status(400).json({
        success: false,
        message: 'L\'identifiant utilisateur est manquant dans les métadonnées',
        error: 'user_id is missing in metadata'
      });
    }

    if (!metadata.course_id) {
      console.error('[Payment][Fedapay] ❌ Missing course_id in metadata', { metadata, body: req.body });
      return res.status(400).json({
        success: false,
        message: 'L\'identifiant du cours est manquant dans les métadonnées',
        error: 'course_id is missing in metadata'
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

    // Normaliser le statut (SUCCESS, FAILED, CANCELLED, etc.)
    const normalizedStatus = status?.toUpperCase() || 'PENDING';
    const paymentStatus = normalizedStatus === 'SUCCESS' || normalizedStatus === 'COMPLETED' || normalizedStatus === 'APPROVED' 
      ? 'completed' 
      : normalizedStatus === 'FAILED' || normalizedStatus === 'ERROR'
      ? 'failed'
      : normalizedStatus === 'CANCELLED' || normalizedStatus === 'CANCELED'
      ? 'cancelled'
      : 'pending';

    console.log('[Payment][Fedapay] 🔄 STATUS PROCESSING:', {
      rawStatus: status,
      normalizedStatus,
      paymentStatus,
      isCompleted: paymentStatus === 'completed',
      isFailed: paymentStatus === 'failed',
      isCancelled: paymentStatus === 'cancelled',
      isPending: paymentStatus === 'pending',
    });

    // Vérifier si un paiement avec cette transaction existe déjà
    const [existingPayments] = await pool.execute(
      'SELECT id, status FROM payments WHERE provider_transaction_id = ? LIMIT 1',
      [transaction_id]
    );

    if (existingPayments.length > 0) {
      const existingPayment = existingPayments[0];
      console.log('[Payment][Fedapay] ℹ️ Payment already exists', {
        paymentId: existingPayment.id,
        existingStatus: existingPayment.status,
        newStatus: paymentStatus,
        transaction_id
      });
      
      // Si le paiement existant est "completed" et qu'on reçoit un statut de succès,
      // s'assurer que l'inscription existe
      if (paymentStatus === 'completed' && existingPayment.status === 'completed') {
        await ensureEnrollmentForPayment(existingPayment.id);
      } else if (paymentStatus === 'completed' && existingPayment.status !== 'completed') {
        // Mettre à jour le statut et créer l'inscription
        await pool.execute(
          'UPDATE payments SET status = ?, completed_at = NOW() WHERE id = ?',
          [paymentStatus, existingPayment.id]
        );
        await ensureEnrollmentForPayment(existingPayment.id);
      } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
        // Mettre à jour le statut et créer une notification
        await pool.execute(
          'UPDATE payments SET status = ?, error_message = ? WHERE id = ?',
          [paymentStatus, error_message || 'Paiement échoué', existingPayment.id]
        );
        await createPaymentNotification(user_id, existingPayment.id, course_id, paymentStatus);
      }
      
      return res.json({
        success: true,
        message: 'Paiement déjà enregistré',
        data: {
          payment_id: existingPayment.id,
          course_id: course_id
        }
      });
    }

    // Créer le paiement avec le statut approprié
    const [paymentResult] = await pool.execute(
      `INSERT INTO payments (
        user_id, course_id, amount, currency,
        payment_method, payment_provider, status,
        provider_transaction_id, error_message, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        course_id,
        finalAmount,
        finalCurrency,
        'fedapay',
        'fedapay',
        paymentStatus,
        transaction_id || null,
        paymentStatus === 'failed' || paymentStatus === 'cancelled' ? (error_message || 'Paiement échoué') : null,
        paymentStatus === 'completed' ? new Date() : null
      ]
    );

    const paymentId = paymentResult.insertId;
    console.log('========================================');
    console.log(`[Payment][Fedapay] ✅ PAYMENT CREATED (${paymentStatus})`);
    console.log('========================================');
    console.log('[Payment][Fedapay] 📊 PAYMENT DETAILS:', {
      paymentId,
      transaction_id,
      user_id,
      course_id,
      amount: finalAmount,
      currency: finalCurrency,
      status: paymentStatus,
    });
    console.log('========================================');

    // Si le paiement est réussi, créer l'inscription automatiquement
    if (paymentStatus === 'completed') {
      console.log('[Payment][Fedapay] 🎓 Creating enrollment...');
      await ensureEnrollmentForPayment(paymentId);
      console.log('[Payment][Fedapay] ✅ Enrollment ensured for payment', { paymentId });
    } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
      // Créer une notification pour l'échec ou l'annulation
      console.log('[Payment][Fedapay] 📢 Creating notification...');
      await createPaymentNotification(user_id, paymentId, course_id, paymentStatus);
      console.log('[Payment][Fedapay] ✅ Notification created');
    }

    const response = {
      success: true,
      message: paymentStatus === 'completed' ? 'Paiement finalisé avec succès' : 'Statut de paiement enregistré',
      data: {
        payment_id: paymentId,
        transaction_id,
        course_id: course_id
      }
    };

    console.log('========================================');
    console.log('[Payment][Fedapay] 📤 SENDING RESPONSE');
    console.log('========================================');
    console.log('[Payment][Fedapay] 📤 RESPONSE:', JSON.stringify(response, null, 2));
    console.log('========================================');

    res.json(response);

  } catch (error) {
    console.log('========================================');
    console.log('[Payment][Fedapay] ❌❌❌ ERROR ❌❌❌');
    console.log('========================================');
    console.error('[Payment][Fedapay] ❌ Error (full):', error);
    console.error('[Payment][Fedapay] ❌ Error (details):', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState,
    });
    console.log('========================================');
    
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
    } else if (paymentStatus === 'failed') {
      // Créer une notification pour l'échec
      await createPaymentNotification(user_id, paymentId, course_id, 'failed');
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
  finalizeGobipayPayment,
  finalizeGobipayPaymentFromFrontend,
  finalizeRecentGobipayPayments,
  autoFinalizeGobipayPayment,
  handleKkiapayWebhook,
  getActivePaymentProviders,
  ensureEnrollmentForPayment,
  createPaymentNotification
};

