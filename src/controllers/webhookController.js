const { pool } = require('../config/database');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');
const KkiapayService = require('../services/paymentProviders/kkiapayService');

/**
 * Webhook Stripe
 */
const handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = StripeService.verifyWebhookSignature(req.body, signature);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleStripePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handleStripePaymentFailed(event.data.object);
        break;
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Erreur webhook Stripe:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Gérer un paiement Stripe réussi
 */
const handleStripePaymentSuccess = async (paymentIntent) => {
  const paymentId = paymentIntent.metadata?.payment_id;

  if (!paymentId) {
    console.error('payment_id manquant dans metadata');
    return;
  }

  let connection = null;
  
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Mettre à jour le paiement avec verrou
    await connection.execute(
      'UPDATE payments SET status = "completed", completed_at = NOW(), provider_transaction_id = ? WHERE id = ?',
      [paymentIntent.id, paymentId]
    );

    // Récupérer les infos du paiement
    const [payments] = await connection.execute(
      'SELECT user_id, course_id FROM payments WHERE id = ?',
      [paymentId]
    );

    if (payments.length > 0) {
      const { user_id, course_id } = payments[0];

      // Vérifier qu'une inscription n'existe pas déjà avec verrou
      const [existing] = await connection.execute(
        'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1 FOR UPDATE',
        [user_id, course_id]
      );

      if (existing.length === 0) {
        try {
          // Créer l'inscription
          const [enrollmentResult] = await connection.execute(
            `INSERT INTO enrollments (user_id, course_id, payment_id, enrolled_at, status)
             VALUES (?, ?, ?, NOW(), 'enrolled')`,
            [user_id, course_id, paymentId]
          );

          console.log(`✅ Inscription créée automatiquement: ${enrollmentResult.insertId}`);
        } catch (insertError) {
          // Si erreur UNIQUE constraint (race condition)
          if (insertError.code === 'ER_DUP_ENTRY' || insertError.errno === 1062) {
            console.log('[Webhook][Stripe] ⚠️ Enrollment already exists (race condition)');
          } else {
            throw insertError;
          }
        }
      }
    }
    
    await connection.commit();
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('[Webhook][Stripe] ❌ Error:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }

  // Enregistrer l'activité (hors transaction pour ne pas bloquer)
  if (payments && payments.length > 0) {
    const { user_id, course_id } = payments[0];
    try {
      const [courses] = await pool.execute(
        'SELECT title FROM courses WHERE id = ?',
        [course_id]
      );
      const courseTitle = courses.length > 0 ? courses[0].title : 'Formation';
      
      const { recordActivity } = require('./gamificationController');
      await recordActivity(
        user_id,
        'payment_completed',
        0,
        `Paiement effectué pour la formation "${courseTitle}"`,
        {
          course_id: course_id,
          course_title: courseTitle,
          payment_id: paymentId,
          payment_method: 'stripe',
          transaction_id: paymentIntent.id,
        }
      );
      console.log('[Webhook][Stripe] ✅ Activity recorded for payment');
    } catch (activityError) {
      console.error('[Webhook][Stripe] ❌ Error recording activity:', activityError);
    }
  }
};

/**
 * Gérer un paiement Stripe échoué
 */
const handleStripePaymentFailed = async (paymentIntent) => {
  const paymentId = paymentIntent.metadata?.payment_id;

  if (!paymentId) return;

  await pool.execute(
    'UPDATE payments SET status = "failed", error_message = ? WHERE id = ?',
    [paymentIntent.last_payment_error?.message || 'Paiement échoué', paymentId]
  );
};

/**
 * Webhook Mobile Money
 */
const handleMobileMoneyWebhook = async (req, res) => {
  try {
    const { provider } = req.params;
    const payload = req.body;

    // Vérifier la signature selon le provider
    const isValid = await MobileMoneyService.verifyWebhookSignature(provider, payload);

    if (!isValid) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    // Traiter selon le provider
    switch (provider) {
      case 'orange-money':
        await handleOrangeMoneyWebhook(payload);
        break;
      case 'mtn-mobile-money':
        await handleMTNWebhook(payload);
        break;
      default:
        return res.status(400).json({ error: 'Provider non supporté' });
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Erreur webhook Mobile Money:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Handler spécifique Orange Money
 */
const handleOrangeMoneyWebhook = async (payload) => {
  const paymentId = payload.metadata?.payment_id;
  const status = payload.status;

  if (!paymentId) {
    console.error('payment_id manquant dans payload Orange Money');
    return;
  }

  if (status === 'SUCCESS' || status === 'COMPLETED') {
    let connection = null;
    let paymentData = null;
    
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      await connection.execute(
        'UPDATE payments SET status = "completed", completed_at = NOW(), provider_transaction_id = ? WHERE id = ?',
        [payload.transaction_id || payload.id, paymentId]
      );

      // Récupérer les infos du paiement
      const [payments] = await connection.execute(
        'SELECT user_id, course_id FROM payments WHERE id = ?',
        [paymentId]
      );

      if (payments.length > 0) {
        paymentData = payments[0];
        const { user_id, course_id } = paymentData;
        
        // Vérifier avec verrou
        const [existing] = await connection.execute(
          'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1 FOR UPDATE',
          [user_id, course_id]
        );

        if (existing.length === 0) {
          try {
            await connection.execute(
              `INSERT INTO enrollments (user_id, course_id, payment_id, enrolled_at, status)
               VALUES (?, ?, ?, NOW(), 'enrolled')`,
              [user_id, course_id, paymentId]
            );
          } catch (insertError) {
            if (insertError.code === 'ER_DUP_ENTRY' || insertError.errno === 1062) {
              console.log('[Webhook][OrangeMoney] ⚠️ Enrollment already exists (race condition)');
            } else {
              throw insertError;
            }
          }
        }
      }
      
      await connection.commit();
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      console.error('[Webhook][OrangeMoney] ❌ Error:', error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }

    // Enregistrer l'activité (hors transaction)
    if (paymentData) {
      const { user_id, course_id } = paymentData;
      try {
        const [courses] = await pool.execute(
          'SELECT title FROM courses WHERE id = ?',
          [course_id]
        );
        const courseTitle = courses.length > 0 ? courses[0].title : 'Formation';
        
        const { recordActivity } = require('./gamificationController');
        await recordActivity(
          user_id,
          'payment_completed',
          0,
          `Paiement effectué pour la formation "${courseTitle}"`,
          {
            course_id: course_id,
            course_title: courseTitle,
            payment_id: paymentId,
            payment_method: 'orange-money',
            transaction_id: payload.transaction_id || payload.id,
          }
        );
        console.log('[Webhook][OrangeMoney] ✅ Activity recorded for payment');
      } catch (activityError) {
        console.error('[Webhook][OrangeMoney] ❌ Error recording activity:', activityError);
      }
    }
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    await pool.execute(
      'UPDATE payments SET status = "failed", error_message = ? WHERE id = ?',
      [payload.error_message || 'Paiement échoué', paymentId]
    );
  }
};

/**
 * Handler spécifique MTN Mobile Money
 */
const handleMTNWebhook = async (payload) => {
  const paymentId = payload.metadata?.payment_id;
  const status = payload.status;

  if (!paymentId) {
    console.error('payment_id manquant dans payload MTN');
    return;
  }

  if (status === 'SUCCESS' || status === 'COMPLETED') {
    let connection = null;
    let paymentData = null;
    
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      await connection.execute(
        'UPDATE payments SET status = "completed", completed_at = NOW(), provider_transaction_id = ? WHERE id = ?',
        [payload.transaction_id || payload.id, paymentId]
      );

      // Récupérer les infos du paiement
      const [payments] = await connection.execute(
        'SELECT user_id, course_id FROM payments WHERE id = ?',
        [paymentId]
      );

      if (payments.length > 0) {
        paymentData = payments[0];
        const { user_id, course_id } = paymentData;
        
        // Vérifier avec verrou
        const [existing] = await connection.execute(
          'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1 FOR UPDATE',
          [user_id, course_id]
        );

        if (existing.length === 0) {
          try {
            await connection.execute(
              `INSERT INTO enrollments (user_id, course_id, payment_id, enrolled_at, status)
               VALUES (?, ?, ?, NOW(), 'enrolled')`,
              [user_id, course_id, paymentId]
            );
          } catch (insertError) {
            if (insertError.code === 'ER_DUP_ENTRY' || insertError.errno === 1062) {
              console.log('[Webhook][MTN] ⚠️ Enrollment already exists (race condition)');
            } else {
              throw insertError;
            }
          }
        }
      }
      
      await connection.commit();
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      console.error('[Webhook][MTN] ❌ Error:', error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }

    // Enregistrer l'activité (hors transaction)
    if (paymentData) {
      const { user_id, course_id } = paymentData;
      try {
        const [courses] = await pool.execute(
          'SELECT title FROM courses WHERE id = ?',
          [course_id]
        );
        const courseTitle = courses.length > 0 ? courses[0].title : 'Formation';
        
        const { recordActivity } = require('./gamificationController');
        await recordActivity(
          user_id,
          'payment_completed',
          0,
          `Paiement effectué pour la formation "${courseTitle}"`,
          {
            course_id: course_id,
            course_title: courseTitle,
            payment_id: paymentId,
            payment_method: 'mtn-mobile-money',
            transaction_id: payload.transaction_id || payload.id,
          }
        );
        console.log('[Webhook][MTN] ✅ Activity recorded for payment');
      } catch (activityError) {
        console.error('[Webhook][MTN] ❌ Error recording activity:', activityError);
      }
    }
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    await pool.execute(
      'UPDATE payments SET status = "failed", error_message = ? WHERE id = ?',
      [payload.error_message || 'Paiement échoué', paymentId]
    );
  }
};

/**
 * Webhook Kkiapay
 * Le paiement est créé uniquement ici après succès/échec du SDK
 */
const handleKkiapayWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('[Webhook][Kkiapay] 📥 Received webhook', JSON.stringify(payload, null, 2));

    // Extraire les métadonnées
    const metadata = payload.metadata || {};
    const tempPaymentId = metadata.temp_payment_id;
    const userId = metadata.user_id;
    const courseId = metadata.course_id;

    console.log('[Webhook][Kkiapay] 🔍 Extracted metadata', {
      tempPaymentId,
      userId,
      courseId,
      userIdType: typeof userId,
      courseIdType: typeof courseId,
    });

    if (!userId || !courseId) {
      console.error('[Webhook][Kkiapay] ❌ Missing user_id or course_id in metadata', {
        userId: userId,
        courseId: courseId,
        metadata: metadata,
        fullPayload: payload,
      });
      return res.status(400).json({ error: 'Métadonnées incomplètes' });
    }

    // Convertir en nombres si nécessaire
    const userIdNum = parseInt(userId, 10);
    const courseIdNum = parseInt(courseId, 10);

    if (isNaN(userIdNum) || isNaN(courseIdNum)) {
      console.error('[Webhook][Kkiapay] ❌ Invalid user_id or course_id', {
        userId,
        courseId,
        userIdNum,
        courseIdNum,
      });
      return res.status(400).json({ error: 'ID utilisateur ou cours invalide' });
    }

    const transactionId = payload.transaction_id || payload.id || null;
    // Extraire le statut - vérifier plusieurs emplacements possibles
    const status = payload.status || payload.state || payload.payment_status || null;
    const amount = payload.amount || payload.total || payload.amount_paid || 0;
    const currency = payload.currency || 'XOF';

    console.log('[Webhook][Kkiapay] 🔍 Payment details', {
      transactionId,
      status,
      statusRaw: payload.status,
      stateRaw: payload.state,
      paymentStatusRaw: payload.payment_status,
      amount,
      currency,
      statusIsSuccess: status === 'SUCCESS' || status === 'COMPLETED' || status === 'success',
      fullPayloadKeys: Object.keys(payload),
    });

    // Vérifier si un paiement existe déjà pour cette transaction
    let [existingPayments] = await pool.execute(
      'SELECT id FROM payments WHERE provider_transaction_id = ? AND payment_provider = "kkiapay"',
      [transactionId]
    );

    let paymentId;

    if (existingPayments.length > 0) {
      // Paiement existe déjà, mettre à jour
      paymentId = existingPayments[0].id;
      console.log('[Webhook][Kkiapay] 🔄 Updating existing payment', { paymentId, status });
      
      const isSuccessStatus = status === 'SUCCESS' || status === 'COMPLETED' || status === 'success' || status === 'SUCCEEDED';
      
      if (isSuccessStatus) {
        await pool.execute(
          'UPDATE payments SET status = "completed", completed_at = NOW() WHERE id = ?',
          [paymentId]
        );
      } else if (status === 'FAILED' || status === 'CANCELLED' || status === 'failed') {
        await pool.execute(
          'UPDATE payments SET status = "failed", error_message = ? WHERE id = ?',
          [payload.error_message || payload.message || 'Paiement échoué', paymentId]
        );
      }
    } else {
      // Créer le paiement (première fois)
      console.log('[Webhook][Kkiapay] 📝 Creating payment record', {
        userId,
        courseId,
        amount,
        status,
      });

      const [paymentResult] = await pool.execute(
        `INSERT INTO payments (
          user_id, course_id, amount, currency,
          payment_method, payment_provider, status,
          provider_transaction_id, payment_data, completed_at
        ) VALUES (?, ?, ?, ?, 'kkiapay', 'kkiapay', ?, ?, ?, ?)`,
        [
          userIdNum,
          courseIdNum,
          amount,
          currency,
          status === 'SUCCESS' || status === 'COMPLETED' || status === 'success' ? 'completed' : 'failed',
          transactionId,
          JSON.stringify(payload),
          status === 'SUCCESS' || status === 'COMPLETED' || status === 'success' ? new Date() : null,
        ]
      );

      paymentId = paymentResult.insertId;
      console.log('[Webhook][Kkiapay] ✅ Payment record created', { paymentId, status });
    }

    // Si le paiement est réussi, créer l'inscription
    // Normaliser le statut (enlever les espaces, convertir en majuscules)
    const normalizedStatus = String(status || '').trim().toUpperCase();
    const isSuccess = normalizedStatus === 'SUCCESS' || normalizedStatus === 'COMPLETED' || normalizedStatus === 'SUCCEEDED';
    
    console.log('[Webhook][Kkiapay] 🔍 Checking enrollment creation', {
      isSuccess,
      status,
      normalizedStatus,
      paymentId,
      userIdNum,
      courseIdNum,
      paymentIdType: typeof paymentId,
      userIdNumType: typeof userIdNum,
      courseIdNumType: typeof courseIdNum,
    });

    if (isSuccess && paymentId) {
      try {
        // Vérifier que le paiement existe et est bien complété
        const [paymentCheck] = await pool.execute(
          'SELECT id, status, user_id, course_id FROM payments WHERE id = ?',
          [paymentId]
        );
        
        console.log('[Webhook][Kkiapay] 🔍 Payment check', {
          paymentExists: paymentCheck.length > 0,
          paymentData: paymentCheck.length > 0 ? paymentCheck[0] : null,
          paymentId,
        });

        if (paymentCheck.length === 0) {
          console.error('[Webhook][Kkiapay] ❌ Payment not found in database', { paymentId });
          // Ne pas retourner une erreur 404, mais continuer quand même
          // Le paiement peut avoir été créé juste avant
          console.log('[Webhook][Kkiapay] ⚠️ Payment not found, but continuing enrollment creation anyway');
        }

        // Utiliser une transaction avec verrou pour éviter les conflits
        let connection = null;
        
        try {
          connection = await pool.getConnection();
          await connection.beginTransaction();

          // Vérifier avec verrou
          const [existing] = await connection.execute(
            'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1 FOR UPDATE',
            [userIdNum, courseIdNum]
          );

          console.log('[Webhook][Kkiapay] 🔍 Existing enrollment check', {
            existingCount: existing.length,
            existing: existing,
          });

          if (existing.length === 0) {
            console.log('[Webhook][Kkiapay] 📝 Creating enrollment', {
              userIdNum,
              courseIdNum,
              paymentId,
            });
            
            try {
              const [enrollmentResult] = await connection.execute(
                `INSERT INTO enrollments (user_id, course_id, payment_id, enrolled_at, status)
                 VALUES (?, ?, ?, NOW(), 'enrolled')`,
                [userIdNum, courseIdNum, paymentId]
              );
              
              const enrollmentId = enrollmentResult.insertId;
              console.log('[Webhook][Kkiapay] ✅ Enrollment created successfully', { 
                enrollmentId: enrollmentId,
                userId: userIdNum,
                courseId: courseIdNum,
                paymentId: paymentId,
              });
            } catch (insertError) {
              // Si erreur UNIQUE constraint (race condition)
              if (insertError.code === 'ER_DUP_ENTRY' || insertError.errno === 1062) {
                console.log('[Webhook][Kkiapay] ⚠️ Enrollment already exists (race condition)');
              } else {
                throw insertError;
              }
            }
          }
          
          await connection.commit();
        } catch (error) {
          if (connection) {
            await connection.rollback();
          }
          console.error('[Webhook][Kkiapay] ❌ Error:', error);
          throw error;
        } finally {
          if (connection) {
            connection.release();
          }
        }

        // Enregistrer l'activité (hors transaction)
        try {
          const [courses] = await pool.execute(
            'SELECT title FROM courses WHERE id = ?',
            [courseIdNum]
          );
          const courseTitle = courses.length > 0 ? courses[0].title : 'Formation';
          
          const { recordActivity } = require('./gamificationController');
          await recordActivity(
            userIdNum,
            'payment_completed',
            0,
            `Paiement effectué pour la formation "${courseTitle}"`,
            {
              course_id: courseIdNum,
              course_title: courseTitle,
              payment_id: paymentId,
              amount: amount,
              currency: currency,
              payment_method: 'kkiapay',
              transaction_id: transactionId,
            }
          );
          console.log('[Webhook][Kkiapay] ✅ Activity recorded for payment');
        } catch (activityError) {
          console.error('[Webhook][Kkiapay] ❌ Error recording activity:', activityError);
          // Ne pas bloquer le processus si l'activité échoue
        }
      } catch (enrollmentError) {
        console.error('[Webhook][Kkiapay] ❌ Error creating enrollment:', enrollmentError);
        console.error('[Webhook][Kkiapay] ❌ Enrollment error stack:', enrollmentError.stack);
        // Ne pas bloquer la réponse, mais logger l'erreur en détail
        // On continue quand même pour retourner une réponse au webhook
      }
    } else {
      console.log('[Webhook][Kkiapay] ⚠️ Payment not successful or paymentId missing, skipping enrollment', { 
        status,
        normalizedStatus,
        isSuccess,
        paymentId,
      });
    }

    res.json({ received: true, payment_id: paymentId });

  } catch (error) {
    console.error('[Webhook][Kkiapay] ❌ Error:', error);
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  handleStripeWebhook,
  handleMobileMoneyWebhook,
  handleKkiapayWebhook
};

