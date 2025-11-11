const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { verifyEmailConfig } = require('../services/emailService');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');

const MONTH_WINDOW = 6;
const MAX_RECENT_ACTIVITY_LIMIT = 100;

const formatMonthKey = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

const buildMonthBuckets = (size = MONTH_WINDOW) => {
  const buckets = [];
  const now = new Date();
  // Normaliser au premier jour du mois courant
  const current = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let i = size - 1; i >= 0; i -= 1) {
    const bucketDate = new Date(current.getFullYear(), current.getMonth() - i, 1);
    buckets.push(formatMonthKey(bucketDate));
  }

  return buckets;
};

const mapByMonth = (rows, valueKey = 'count') => {
  const map = new Map();
  for (const row of rows) {
    map.set(row.month, Number(row[valueKey] || 0));
  }
  return map;
};

const buildMonthlySeries = (buckets, rowMap) => {
  return buckets.map((month) => ({
    month,
    value: rowMap.get(month) || 0
  }));
};

const buildRevenueSeries = (buckets, rows) => {
  const grouped = new Map();

  for (const row of rows) {
    const month = row.month;
    if (!grouped.has(month)) {
      grouped.set(month, []);
    }
    grouped.get(month).push({
      currency: row.currency,
      total_amount: Number(row.total_amount || 0),
      payments: Number(row.payments || 0)
    });
  }

  return buckets.map((month) => {
    const breakdown = grouped.get(month) || [];
    const total_amount = breakdown.reduce((acc, entry) => acc + entry.total_amount, 0);

    return {
      month,
      total_amount,
      breakdown
    };
  });
};

const parseJsonSafe = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const ensureAdmin = (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Accès réservé aux administrateurs'
    });
    return false;
  }
  return true;
};

const getOverview = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const monthBuckets = buildMonthBuckets();

    const [
      [userTotals = {}],
      [courseTotals = {}],
      [enrollmentTotals = {}],
      revenueTotals,
      userGrowthRows,
      courseGrowthRows,
      revenueGrowthRows
    ] = await Promise.all([
      pool.execute(
        `SELECT
          COUNT(*) AS total_users,
          SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) AS total_students,
          SUM(CASE WHEN role = 'instructor' THEN 1 ELSE 0 END) AS total_instructors,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS total_admins,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active_users
        FROM users`
      ).then(([rows]) => rows),
      pool.execute(
        `SELECT
          COUNT(*) AS total_courses,
          SUM(CASE WHEN COALESCE(status, CASE WHEN is_published = 1 THEN 'published' ELSE 'draft' END) = 'published' THEN 1 ELSE 0 END) AS published_courses,
          SUM(CASE WHEN COALESCE(status, 'draft') = 'pending_approval' THEN 1 ELSE 0 END) AS pending_courses,
          SUM(CASE WHEN COALESCE(status, 'draft') = 'draft' THEN 1 ELSE 0 END) AS draft_courses
        FROM courses`
      ).then(([rows]) => rows),
      pool.execute(
        `SELECT
          COUNT(*) AS total_enrollments,
          SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed_enrollments,
          SUM(CASE WHEN status = 'enrolled' OR status IS NULL THEN 1 ELSE 0 END) AS active_enrollments
        FROM enrollments`
      ).then(([rows]) => rows),
      pool.execute(
        `SELECT
          currency,
          SUM(amount) AS total_amount,
          COUNT(*) AS completed_payments,
          MAX(completed_at) AS last_payment_at
        FROM payments
        WHERE status = 'completed'
        GROUP BY currency
        ORDER BY currency`
      ).then(([rows]) => rows),
      pool.execute(
        `SELECT
          DATE_FORMAT(created_at, '%Y-%m') AS month,
          COUNT(*) AS count
        FROM users
        WHERE created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month ASC`,
        [MONTH_WINDOW]
      ).then(([rows]) => rows),
      pool.execute(
        `SELECT
          DATE_FORMAT(created_at, '%Y-%m') AS month,
          COUNT(*) AS count
        FROM courses
        WHERE created_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month ASC`,
        [MONTH_WINDOW]
      ).then(([rows]) => rows),
      pool.execute(
        `SELECT
          DATE_FORMAT(completed_at, '%Y-%m') AS month,
          currency,
          SUM(amount) AS total_amount,
          COUNT(*) AS payments
        FROM payments
        WHERE status = 'completed'
          AND completed_at IS NOT NULL
          AND completed_at >= DATE_SUB(DATE_FORMAT(NOW(), '%Y-%m-01'), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(completed_at, '%Y-%m'), currency
        ORDER BY month ASC`,
        [MONTH_WINDOW]
      ).then(([rows]) => rows)
    ]);

    const userGrowthMap = mapByMonth(userGrowthRows);
    const courseGrowthMap = mapByMonth(courseGrowthRows);

    const monthlyUsers = buildMonthlySeries(monthBuckets, userGrowthMap);
    const monthlyCourses = buildMonthlySeries(monthBuckets, courseGrowthMap);
    const monthlyRevenue = buildRevenueSeries(monthBuckets, revenueGrowthRows);

    res.json({
      success: true,
      data: {
        totals: {
          users: {
            total: Number(userTotals.total_users || 0),
            active: Number(userTotals.active_users || 0),
            students: Number(userTotals.total_students || 0),
            instructors: Number(userTotals.total_instructors || 0),
            admins: Number(userTotals.total_admins || 0)
          },
          courses: {
            total: Number(courseTotals.total_courses || 0),
            published: Number(courseTotals.published_courses || 0),
            pending: Number(courseTotals.pending_courses || 0),
            draft: Number(courseTotals.draft_courses || 0)
          },
          enrollments: {
            total: Number(enrollmentTotals.total_enrollments || 0),
            completed: Number(enrollmentTotals.completed_enrollments || 0),
            active: Number(enrollmentTotals.active_enrollments || 0)
          },
          revenue: {
            totals: revenueTotals.map((row) => ({
              currency: row.currency,
              amount: Number(row.total_amount || 0),
              completed_payments: Number(row.completed_payments || 0),
              last_payment_at: row.last_payment_at
            }))
          }
        },
        monthly_growth: {
          users: monthlyUsers,
          courses: monthlyCourses,
          revenue: monthlyRevenue
        }
      }
    });
  } catch (error) {
    console.error('Erreur overview admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer l’overview admin',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getSystemMetrics = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const rangeMinutes = Math.min(
      Math.max(parseInt(req.query.rangeMinutes, 10) || 60, 5),
      24 * 60
    );

    const historyLimit = Math.min(
      Math.max(parseInt(req.query.historyLimit, 10) || 200, 10),
      1000
    );

    const [latestMetrics] = await pool.execute(`
      SELECT pm.metric_name,
             pm.metric_value,
             pm.metric_unit,
             pm.context,
             pm.recorded_at
      FROM performance_metrics pm
      INNER JOIN (
        SELECT metric_name, MAX(recorded_at) AS max_recorded
        FROM performance_metrics
        GROUP BY metric_name
      ) latest ON pm.metric_name = latest.metric_name AND pm.recorded_at = latest.max_recorded
      ORDER BY pm.metric_name ASC
    `);

    const [historyRows] = await pool.execute(
      `
      SELECT metric_name,
             metric_value,
             metric_unit,
             context,
             recorded_at
      FROM performance_metrics
      WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      ORDER BY recorded_at DESC
      LIMIT ?
    `,
      [rangeMinutes, historyLimit]
    );

    const [uptimeRow] = await pool.execute(
      `
      SELECT metric_value AS uptime_seconds
      FROM performance_metrics
      WHERE metric_name IN ('uptime_seconds', 'uptime')
      ORDER BY recorded_at DESC
      LIMIT 1
    `
    );

    const [lastBackupRow] = await pool.execute(
      `
      SELECT MAX(created_at) AS last_backup_at
      FROM system_events
      WHERE event_type = 'backup_completed'
    `
    );

    const metrics = latestMetrics.map((row) => ({
      metric: row.metric_name,
      value: Number(row.metric_value || 0),
      unit: row.metric_unit || null,
      context: parseJsonSafe(row.context),
      recorded_at: row.recorded_at
    }));

    const historyMap = new Map();
    for (const row of historyRows) {
      if (!historyMap.has(row.metric_name)) {
        historyMap.set(row.metric_name, []);
      }
      historyMap.get(row.metric_name).push({
        value: Number(row.metric_value || 0),
        unit: row.metric_unit || null,
        context: parseJsonSafe(row.context),
        recorded_at: row.recorded_at
      });
    }

    res.json({
      success: true,
      data: {
        metrics,
        history: Object.fromEntries(historyMap.entries()),
        uptime_seconds:
          uptimeRow && uptimeRow.length > 0
            ? Number(uptimeRow[0].uptime_seconds || 0)
            : null,
        last_backup_at:
          lastBackupRow && lastBackupRow.length > 0
            ? lastBackupRow[0].last_backup_at
            : null
      }
    });
  } catch (error) {
    console.error('Erreur system metrics admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les métriques système',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getRecentActivity = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const limitParam = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(limitParam)
      ? 20
      : Math.min(Math.max(limitParam, 1), MAX_RECENT_ACTIVITY_LIMIT);

    const eventType = req.query.eventType || null;

    const params = [limit];
    let whereClause = '';

    if (eventType) {
      whereClause = 'WHERE se.event_type = ?';
      params.unshift(eventType);
    }

    const [events] = await pool.execute(
      `
      SELECT
        se.id,
        se.event_type,
        se.description,
        se.metadata,
        se.ip_address,
        se.user_agent,
        se.created_at,
        u.id AS user_id,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.email AS user_email,
        c.id AS course_id,
        c.title AS course_title
      FROM system_events se
      LEFT JOIN users u ON se.user_id = u.id
      LEFT JOIN courses c ON se.course_id = c.id
      ${whereClause}
      ORDER BY se.created_at DESC
      LIMIT ?
    `,
      params
    );

    res.json({
      success: true,
      data: events.map((event) => ({
        id: event.id,
        type: event.event_type,
        description: event.description,
        metadata: parseJsonSafe(event.metadata),
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        created_at: event.created_at,
        user: event.user_id
          ? {
              id: event.user_id,
              first_name: event.user_first_name,
              last_name: event.user_last_name,
              email: event.user_email
            }
          : null,
        course: event.course_id
          ? {
              id: event.course_id,
              title: event.course_title
            }
          : null
      }))
    });
  } catch (error) {
    console.error('Erreur recent activity admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les activités récentes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const buildAlertEntry = ({ id, type, severity, title, description, created_at, metadata }) => ({
  id,
  type,
  severity,
  title,
  description,
  created_at,
  metadata: metadata || null
});

const getAlerts = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const limitParam = parseInt(req.query.limit, 10);
    const limit = Number.isNaN(limitParam)
      ? 20
      : Math.min(Math.max(limitParam, 1), 100);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      [pendingCourses],
      [pendingCertificates],
      [failedPayments],
      [systemErrors],
      [unreadMessages]
    ] = await Promise.all([
      pool.execute(
        `
        SELECT
          c.id,
          c.title,
          COALESCE(c.status, CASE WHEN c.is_published = 1 THEN 'published' ELSE 'draft' END) AS status,
          COALESCE(ca.created_at, c.updated_at, c.created_at) AS request_date,
          u.id AS instructor_id,
          u.first_name,
          u.last_name,
          u.email
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        LEFT JOIN course_approvals ca ON ca.course_id = c.id AND ca.status = 'pending'
        WHERE COALESCE(c.status, CASE WHEN c.is_published = 1 THEN 'published' ELSE 'draft' END) = 'pending_approval'
        ORDER BY COALESCE(ca.created_at, c.updated_at, c.created_at) DESC
        LIMIT ?
      `,
        [limit]
      ),
      pool.execute(
        `
        SELECT
          cr.id,
          cr.course_id,
          cr.user_id,
          cr.created_at,
          cr.user_info,
          c.title AS course_title,
          u.first_name,
          u.last_name,
          u.email
        FROM certificate_requests cr
        JOIN courses c ON cr.course_id = c.id
        JOIN users u ON cr.user_id = u.id
        WHERE cr.status = 'pending'
        ORDER BY cr.created_at DESC
        LIMIT ?
      `,
        [limit]
      ),
      pool.execute(
        `
        SELECT
          p.id,
          p.user_id,
          p.course_id,
          p.amount,
          p.currency,
          p.status,
          p.error_message,
          p.updated_at,
          u.first_name,
          u.last_name,
          u.email,
          c.title AS course_title
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN courses c ON p.course_id = c.id
        WHERE p.status IN ('failed', 'cancelled', 'refunded')
          AND p.updated_at >= ?
        ORDER BY p.updated_at DESC
        LIMIT ?
      `,
        [last24h, limit]
      ),
      pool.execute(
        `
        SELECT
          se.id,
          se.description,
          se.metadata,
          se.created_at,
          se.user_id,
          u.first_name,
          u.last_name,
          u.email
        FROM system_events se
        LEFT JOIN users u ON se.user_id = u.id
        WHERE se.event_type = 'error_occurred'
          AND se.created_at >= ?
        ORDER BY se.created_at DESC
        LIMIT ?
      `,
        [last24h, limit]
      ),
      pool.execute(
        `
        SELECT
          COUNT(*) AS unread_count
        FROM messages m
        JOIN users u ON m.recipient_id = u.id
        WHERE m.is_read = 0
          AND m.message_type IN ('system', 'announcement')
          AND u.role = 'admin'
      `
      )
    ]);

    const alerts = [];

    for (const course of pendingCourses) {
      alerts.push(
        buildAlertEntry({
          id: `course-${course.id}`,
          type: 'course_pending_approval',
          severity: 'warning',
          title: `Cours en attente de validation`,
          description: `Le cours "${course.title}" par ${course.first_name} ${course.last_name} attend une approbation.`,
          created_at: course.request_date,
          metadata: {
            course_id: course.id,
            instructor_id: course.instructor_id,
            instructor_email: course.email
          }
        })
      );
    }

    for (const request of pendingCertificates) {
      alerts.push(
        buildAlertEntry({
          id: `certificate-${request.id}`,
          type: 'certificate_pending',
          severity: 'info',
          title: `Demande de certificat en attente`,
          description: `L'utilisateur ${request.first_name} ${request.last_name} a demandé un certificat pour "${request.course_title}".`,
          created_at: request.created_at,
          metadata: {
            request_id: request.id,
            course_id: request.course_id,
            user_id: request.user_id,
            user_email: request.email,
            user_info: parseJsonSafe(request.user_info)
          }
        })
      );
    }

    for (const payment of failedPayments) {
      alerts.push(
        buildAlertEntry({
          id: `payment-${payment.id}`,
          type: 'payment_issue',
          severity: 'error',
          title: `Paiement ${payment.status}`,
          description: `Paiement ${payment.status} pour ${payment.first_name || 'Un utilisateur'} ${payment.last_name || ''} (cours "${payment.course_title || 'N/A'}").`,
          created_at: payment.updated_at,
          metadata: {
            payment_id: payment.id,
            user_id: payment.user_id,
            user_email: payment.email,
            amount: Number(payment.amount || 0),
            currency: payment.currency,
            error: payment.error_message
          }
        })
      );
    }

    for (const error of systemErrors) {
      alerts.push(
        buildAlertEntry({
          id: `system-error-${error.id}`,
          type: 'system_error',
          severity: 'error',
          title: `Erreur système détectée`,
          description: error.description || 'Erreur système signalée.',
          created_at: error.created_at,
          metadata: {
            event_id: error.id,
            user_id: error.user_id,
            user_email: error.email,
            metadata: parseJsonSafe(error.metadata)
          }
        })
      );
    }

    const unreadCount = unreadMessages.length > 0 ? Number(unreadMessages[0].unread_count || 0) : 0;
    if (unreadCount > 0) {
      alerts.push(
        buildAlertEntry({
          id: 'unread-messages',
          type: 'inbox_unread',
          severity: 'info',
          title: 'Messages système non lus',
          description: `${unreadCount} message(s) système ou annonce(s) non lus pour les administrateurs.`,
          created_at: now,
          metadata: {
            unread_count: unreadCount
          }
        })
      );
    }

    alerts.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    res.json({
      success: true,
      data: alerts.slice(0, limit)
    });
  } catch (error) {
    console.error('Erreur alerts admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les alertes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const checkDatabaseStatus = async () => {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return {
      name: 'database',
      status: 'up',
      latency_ms: Date.now() - start
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'down',
      latency_ms: Date.now() - start,
      error: error.message
    };
  }
};

const checkEmailStatus = async () => {
  try {
    const emailEnabled = process.env.EMAIL_ENABLED !== 'false';
    const hasCreds = (process.env.EMAIL_USER || '').trim() && (process.env.EMAIL_PASSWORD || '').trim();

    if (!emailEnabled) {
      return {
        name: 'email',
        status: 'disabled'
      };
    }

    if (!hasCreds) {
      return {
        name: 'email',
        status: 'degraded',
        error: 'EMAIL_USER ou EMAIL_PASSWORD manquant'
      };
    }

    await verifyEmailConfig();
    return {
      name: 'email',
      status: 'up'
    };
  } catch (error) {
    return {
      name: 'email',
      status: 'degraded',
      error: error.message
    };
  }
};

const checkStripeStatus = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return res.status(200).json({
      success: false,
      error: 'STRIPE_SECRET_KEY absent'
    });
  }

  if (!StripeService || !StripeService.stripe) {
    return {
      name: 'stripe',
      status: 'degraded',
      error: 'Client Stripe non initialisé'
    };
  }

  return {
    name: 'stripe',
    status: 'up'
  };
};

const checkMobileMoneyStatus = () => {
  const providers = ['orange-money', 'mtn-mobile-money'];
  const statuses = [];

  providers.forEach((provider) => {
    try {
      const config = MobileMoneyService.getProviderConfig(provider);
      const credsReady = config.merchantId && config.merchantKey && config.apiKey;

      statuses.push({
        name: `mobile-money:${provider}`,
        status: credsReady ? 'up' : 'degraded',
        details: {
          hasMerchantId: Boolean(config.merchantId),
          hasMerchantKey: Boolean(config.merchantKey),
          hasApiKey: Boolean(config.apiKey)
        }
      });
    } catch (error) {
      statuses.push({
        name: `mobile-money:${provider}`,
        status: 'disabled',
        error: error.message
      });
    }
  });

  return statuses;
};

const checkStorageStatus = () => {
  const uploadsPath = path.join(__dirname, '../../uploads');
  try {
    fs.accessSync(uploadsPath, fs.constants.R_OK | fs.constants.W_OK);
    return {
      name: 'uploads_storage',
      status: 'up',
      path: uploadsPath
    };
  } catch (error) {
    return {
      name: 'uploads_storage',
      status: 'degraded',
      error: error.message,
      path: uploadsPath
    };
  }
};

const getServicesStatus = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) {
      return;
    }

    const databaseStatus = await checkDatabaseStatus();
    const emailStatus = await checkEmailStatus();
    const stripeStatus = checkStripeStatus();
    const mobileMoneyStatuses = checkMobileMoneyStatus();
    const storageStatus = checkStorageStatus();

    const services = [
      databaseStatus,
      emailStatus,
      stripeStatus,
      storageStatus,
      ...mobileMoneyStatuses
    ];

    const summary = services.reduce(
      (acc, service) => {
        if (service.status === 'up') {
          acc.up += 1;
        } else if (service.status === 'disabled') {
          acc.disabled += 1;
        } else {
          acc.degraded += 1;
        }
        return acc;
      },
      { up: 0, degraded: 0, disabled: 0 }
    );

    res.json({
      success: true,
      data: {
        services,
        summary,
        checked_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erreur services status admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer le statut des services',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getOverview,
  getSystemMetrics,
  getRecentActivity,
  getAlerts,
  getServicesStatus
};

