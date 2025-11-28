/**
 * Script de test pour vérifier et forcer la création d'enrollment pour un paiement GobiPay
 * Usage: node scripts/testGobipayEnrollment.js [payment_id]
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mdsc_auth',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const ensureEnrollmentForPayment = async (paymentId) => {
  try {
    const [payments] = await pool.execute(
      'SELECT user_id, course_id FROM payments WHERE id = ? LIMIT 1',
      [paymentId]
    );

    if (!payments.length) {
      console.error('❌ Payment not found for enrollment creation', { paymentId });
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
        console.log('✅ Enrollment reactivated', {
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
        console.log('ℹ️ Active enrollment already exists', {
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
       VALUES (?, ?, 'enrolled', NOW(), ?, TRUE, 0.00)`,
      [user_id, course_id, paymentId]
    );

    console.log('✅ New enrollment created', {
      enrollmentId: enrollmentResult.insertId,
      paymentId,
      user_id,
      course_id
    });

  } catch (error) {
    console.error('❌ Error ensuring enrollment for payment:', error);
    throw error;
  }
};

async function main() {
  try {
    const paymentId = process.argv[2] || '36'; // Utiliser le payment_id 36 par défaut (celui des logs)
    
    console.log('🔍 Checking payment:', paymentId);
    
    // Vérifier le paiement
    const [payments] = await pool.execute(
      `SELECT p.*, c.title as course_title, u.email as user_email
       FROM payments p
       JOIN courses c ON p.course_id = c.id
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [paymentId]
    );

    if (payments.length === 0) {
      console.error('❌ Payment not found:', paymentId);
      process.exit(1);
    }

    const payment = payments[0];
    console.log('📋 Payment found:', {
      id: payment.id,
      user_id: payment.user_id,
      user_email: payment.user_email,
      course_id: payment.course_id,
      course_title: payment.course_title,
      status: payment.status,
      payment_provider: payment.payment_provider,
      provider_transaction_id: payment.provider_transaction_id,
      created_at: payment.created_at,
    });

    // Vérifier l'enrollment actuel
    const [enrollments] = await pool.execute(
      `SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?`,
      [payment.user_id, payment.course_id]
    );

    console.log('📋 Current enrollments:', {
      count: enrollments.length,
      enrollments: enrollments.map(e => ({
        id: e.id,
        is_active: e.is_active,
        status: e.status,
        payment_id: e.payment_id,
        enrolled_at: e.enrolled_at,
      })),
    });

    // Si le paiement est completed, forcer la création de l'enrollment
    if (payment.status === 'completed' || payment.status === 'processing') {
      console.log('🚀 Forcing enrollment creation...');
      await ensureEnrollmentForPayment(payment.id);
      
      // Vérifier à nouveau
      const [newEnrollments] = await pool.execute(
        `SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?`,
        [payment.user_id, payment.course_id]
      );
      
      console.log('✅ Enrollment status after creation:', {
        count: newEnrollments.length,
        enrollments: newEnrollments.map(e => ({
          id: e.id,
          is_active: e.is_active,
          status: e.status,
          payment_id: e.payment_id,
          enrolled_at: e.enrolled_at,
        })),
      });
    } else {
      console.log('⚠️ Payment status is not completed or processing:', payment.status);
      console.log('💡 Updating payment status to completed...');
      await pool.execute(
        'UPDATE payments SET status = "completed", completed_at = NOW() WHERE id = ?',
        [payment.id]
      );
      console.log('✅ Payment status updated');
      
      console.log('🚀 Forcing enrollment creation...');
      await ensureEnrollmentForPayment(payment.id);
    }

    console.log('✅✅✅ Test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌❌❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

