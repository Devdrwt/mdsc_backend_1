const { pool } = require('../config/database');
const { buildMediaUrl } = require('../utils/media');

const DEFAULT_PAGINATION_LIMIT = 10;
const MAX_PAGINATION_LIMIT = 50;
const MAX_RECENT_ACTIVITY_LIMIT = 50;

const ensureInstructor = (req, res) => {
  const user = req.user || {};
  if (!user.userId && !user.id) {
    res.status(401).json({
      success: false,
      message: 'Utilisateur non authentifié'
    });
    return null;
  }

  const role = user.role;
  if (role !== 'instructor' && role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Accès réservé aux instructeurs'
    });
    return null;
  }

  return user.userId || user.id;
};

const parseRangeDays = (value, fallback = 30) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, 7), 365);
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

const getDashboard = async (req, res) => {
  const instructorId = ensureInstructor(req, res);
  if (!instructorId) {
    return;
  }

  try {
    const [
      [courseStats = {}],
      [studentStats = {}],
      revenueRows,
      [ratingStats = {}],
      [viewsStats = {}],
      topCoursesRows,
      recentEnrollmentsRows,
      recentPaymentsRows
    ] = await Promise.all([
      pool
        .execute(
          `
          SELECT
            COUNT(*) AS total_courses,
            SUM(CASE WHEN COALESCE(status, CASE WHEN is_published = 1 THEN 'published' ELSE 'draft' END) = 'published' THEN 1 ELSE 0 END) AS published_courses,
            SUM(CASE WHEN COALESCE(status, 'draft') = 'pending_approval' THEN 1 ELSE 0 END) AS pending_courses,
            SUM(CASE WHEN COALESCE(status, 'draft') = 'draft' THEN 1 ELSE 0 END) AS draft_courses
          FROM courses
          WHERE instructor_id = ?
        `,
          [instructorId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            COUNT(DISTINCT e.user_id) AS total_students,
            COUNT(DISTINCT CASE WHEN e.completed_at IS NOT NULL THEN e.user_id END) AS completed_students,
            AVG(e.progress_percentage) AS avg_completion_rate
          FROM enrollments e
          JOIN courses c ON c.id = e.course_id
          WHERE c.instructor_id = ?
        `,
          [instructorId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            p.currency,
            SUM(p.amount) AS total_amount,
            COUNT(*) AS completed_payments,
            MAX(p.completed_at) AS last_payment_at
          FROM payments p
          JOIN courses c ON c.id = p.course_id
          WHERE p.status = 'completed'
            AND c.instructor_id = ?
          GROUP BY p.currency
          ORDER BY p.currency
        `,
          [instructorId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            AVG(cr.rating) AS avg_rating
          FROM course_reviews cr
          JOIN courses c ON c.id = cr.course_id
          WHERE cr.is_approved = 1
            AND c.instructor_id = ?
        `,
          [instructorId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            SUM(ca.total_views) AS total_views
          FROM course_analytics ca
          JOIN courses c ON c.id = ca.course_id
          WHERE c.instructor_id = ?
        `,
          [instructorId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
        c.id,
        c.title,
        c.thumbnail_url,
        COALESCE(ca.total_enrollments, COUNT(DISTINCT e.id)) AS total_enrollments,
            COALESCE(ca.average_rating, AVG(CASE WHEN cr.is_approved = 1 THEN cr.rating END), 0) AS average_rating,
            COALESCE(ca.completion_rate, AVG(e.progress_percentage), 0) AS completion_rate
          FROM courses c
          LEFT JOIN enrollments e ON e.course_id = c.id
          LEFT JOIN course_reviews cr ON cr.course_id = c.id
          LEFT JOIN course_analytics ca ON ca.course_id = c.id
          WHERE c.instructor_id = ?
          GROUP BY c.id, c.title, c.thumbnail_url, ca.total_enrollments, ca.average_rating, ca.completion_rate
          ORDER BY total_enrollments DESC
          LIMIT 5
        `,
          [instructorId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            e.id,
            e.course_id,
            e.enrolled_at,
            e.progress_percentage,
            u.id AS student_id,
            u.first_name,
            u.last_name,
            c.title AS course_title
          FROM enrollments e
          JOIN courses c ON c.id = e.course_id
          JOIN users u ON u.id = e.user_id
          WHERE c.instructor_id = ?
          ORDER BY e.enrolled_at DESC
          LIMIT 5
        `,
          [instructorId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            p.id,
            p.course_id,
            p.amount,
            p.currency,
            p.completed_at,
            c.title AS course_title
          FROM payments p
          JOIN courses c ON c.id = p.course_id
          WHERE p.status = 'completed'
            AND c.instructor_id = ?
          ORDER BY p.completed_at DESC
          LIMIT 5
        `,
          [instructorId]
        )
        .then(([rows]) => rows)
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          courses: {
            total: Number(courseStats.total_courses || 0),
            published: Number(courseStats.published_courses || 0),
            pending: Number(courseStats.pending_courses || 0),
            draft: Number(courseStats.draft_courses || 0)
          },
          students: {
            total: Number(studentStats.total_students || 0),
            completed: Number(studentStats.completed_students || 0),
            avg_completion_rate: Number(studentStats.avg_completion_rate || 0)
          },
          revenue: revenueRows.map((row) => ({
            currency: row.currency,
            total_amount: Number(row.total_amount || 0),
            completed_payments: Number(row.completed_payments || 0),
            last_payment_at: row.last_payment_at
          })),
          average_rating: Number(ratingStats.avg_rating || 0),
          total_views: Number(viewsStats.total_views || 0)
        },
        top_courses: topCoursesRows.map((course) => ({
          id: course.id,
          title: course.title,
          thumbnail_url: buildMediaUrl(course.thumbnail_url),
          total_enrollments: Number(course.total_enrollments || 0),
          average_rating: Number(course.average_rating || 0),
          completion_rate: Number(course.completion_rate || 0)
        })),
        recent_enrollments: recentEnrollmentsRows.map((row) => ({
          enrollment_id: row.id,
          course_id: row.course_id,
          course_title: row.course_title,
          student: {
            id: row.student_id,
            first_name: row.first_name,
            last_name: row.last_name
          },
          enrolled_at: row.enrolled_at,
          progress_percentage: Number(row.progress_percentage || 0)
        })),
        recent_payments: recentPaymentsRows.map((row) => ({
          payment_id: row.id,
          course_id: row.course_id,
          course_title: row.course_title,
          amount: Number(row.amount || 0),
          currency: row.currency,
          completed_at: row.completed_at
        }))
      }
    });
  } catch (error) {
    console.error('Erreur dashboard instructeur:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer le tableau de bord instructeur'
    });
  }
};

const getCourses = async (req, res) => {
  const instructorId = ensureInstructor(req, res);
  if (!instructorId) {
    return;
  }

  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || DEFAULT_PAGINATION_LIMIT, 1),
      MAX_PAGINATION_LIMIT
    );
    const offset = (page - 1) * limit;
    const status = (req.query.status || '').trim().toLowerCase();

    const validStatuses = ['draft', 'pending_approval', 'published', 'archived', 'approved'];
    const statusFilter = validStatuses.includes(status) ? status : null;

    const statusCondition = statusFilter
      ? 'AND COALESCE(c.status, CASE WHEN c.is_published = 1 THEN \'published\' ELSE \'draft\' END) = ?'
      : '';
    const params = statusFilter ? [instructorId, statusFilter, limit, offset] : [instructorId, limit, offset];

    const [courses] = await pool.execute(
      `
      SELECT
        c.id,
        c.title,
        c.slug,
        c.thumbnail_url,
        c.language,
        c.currency,
        COALESCE(c.status, CASE WHEN c.is_published = 1 THEN 'published' ELSE 'draft' END) AS status,
        c.is_published,
        c.created_at,
        c.updated_at,
        c.price,
        c.duration_minutes,
        COALESCE(ca.total_views, 0) AS total_views,
        COALESCE(ca.total_enrollments, COUNT(DISTINCT e.id)) AS total_enrollments,
        COALESCE(ca.completion_rate, AVG(e.progress_percentage)) AS avg_progress,
        AVG(CASE WHEN cr.is_approved = 1 THEN cr.rating END) AS avg_rating,
        COUNT(DISTINCT CASE WHEN e.completed_at IS NOT NULL THEN e.id END) AS completed_enrollments
      FROM courses c
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      LEFT JOIN enrollments e ON e.course_id = c.id
      LEFT JOIN course_reviews cr ON cr.course_id = c.id
      WHERE c.instructor_id = ?
      ${statusCondition}
      GROUP BY c.id, c.title, c.slug, c.thumbnail_url, c.language, c.currency, status, c.is_published, c.created_at, c.updated_at, c.price, c.duration_minutes, ca.total_views, ca.total_enrollments, ca.completion_rate
      ORDER BY c.updated_at DESC
      LIMIT ?
      OFFSET ?
    `,
      params
    );

    const courseIds = courses.map((course) => course.id);
    let paymentsByCourse = new Map();

    if (courseIds.length > 0) {
      const [paymentRows] = await pool.execute(
        `
        SELECT
          p.course_id,
          p.currency,
          SUM(p.amount) AS total_amount,
          COUNT(*) AS payments
        FROM payments p
        WHERE p.status = 'completed'
          AND p.course_id IN (${courseIds.map(() => '?').join(',')})
        GROUP BY p.course_id, p.currency
      `,
        courseIds
      );

      paymentsByCourse = paymentRows.reduce((acc, row) => {
        if (!acc.has(row.course_id)) {
          acc.set(row.course_id, []);
        }
        acc.get(row.course_id).push({
          currency: row.currency,
          total_amount: Number(row.total_amount || 0),
          payments: Number(row.payments || 0)
        });
        return acc;
      }, new Map());
    }

    const [[{ total_count = 0 } = {}]] = await pool.execute(
      `
      SELECT COUNT(*) AS total_count
      FROM courses c
      WHERE c.instructor_id = ?
      ${statusFilter ? `AND COALESCE(c.status, CASE WHEN c.is_published = 1 THEN 'published' ELSE 'draft' END) = ?` : ''}
    `,
      statusFilter ? [instructorId, statusFilter] : [instructorId]
    );

    res.json({
      success: true,
      data: {
        courses: courses.map((course) => ({
          id: course.id,
          title: course.title,
          slug: course.slug,
          language: course.language,
          status: course.status,
          is_published: Boolean(course.is_published),
          created_at: course.created_at,
          updated_at: course.updated_at,
          price: Number(course.price || 0),
          currency: course.currency,
          duration_minutes: Number(course.duration_minutes || 0),
          thumbnail_url: buildMediaUrl(course.thumbnail_url),
          total_views: Number(course.total_views || 0),
          total_enrollments: Number(course.total_enrollments || 0),
          completed_enrollments: Number(course.completed_enrollments || 0),
          avg_progress: Number(course.avg_progress || 0),
          avg_rating: Number(course.avg_rating || 0),
          revenue: paymentsByCourse.get(course.id) || []
        })),
        pagination: {
          page,
          limit,
          total: Number(total_count || 0),
          pages: Math.ceil((Number(total_count || 0) || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Erreur liste des cours instructeur:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les cours instructeur'
    });
  }
};

const getStudents = async (req, res) => {
  const instructorId = ensureInstructor(req, res);
  if (!instructorId) {
    return;
  }

  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || DEFAULT_PAGINATION_LIMIT, 1),
      MAX_PAGINATION_LIMIT
    );
    const offset = (page - 1) * limit;

    const search = (req.query.search || '').trim();
    const courseId = parseInt(req.query.course_id, 10);
    const status = (req.query.status || '').trim().toLowerCase();
    const sortField = (req.query.sort || 'enrolled_at').trim().toLowerCase();
    const sortOrder = (req.query.order || '').trim().toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const validSorts = {
      enrolled_at: 'e.enrolled_at',
      progress: 'e.progress_percentage',
      last_activity: 'COALESCE(e.last_accessed_at, e.enrolled_at)',
      last_login: 'u.last_login_at'
    };

    const orderBy = validSorts[sortField] || validSorts.enrolled_at;

    const conditions = ['c.instructor_id = ?'];
    const params = [instructorId];

    if (!Number.isNaN(courseId)) {
      conditions.push('c.id = ?');
      params.push(courseId);
    }

    if (status === 'active') {
      conditions.push('e.is_active = TRUE AND e.completed_at IS NULL');
    } else if (status === 'completed') {
      conditions.push('e.completed_at IS NOT NULL');
    } else if (status === 'inactive') {
      conditions.push('e.is_active = FALSE');
    }

    if (search) {
      conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      const likeSearch = `%${search}%`;
      params.push(likeSearch, likeSearch, likeSearch);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const listQuery = `
      SELECT
        e.id AS enrollment_id,
        e.user_id,
        e.course_id,
        e.enrolled_at,
        e.progress_percentage,
        e.completed_at,
        e.last_accessed_at,
        e.is_active,
        u.first_name,
        u.last_name,
        u.email,
        u.profile_picture,
        u.last_login_at,
        c.title AS course_title,
        c.slug AS course_slug,
        c.language AS course_language,
        COALESCE(c.status, CASE WHEN c.is_published = 1 THEN 'published' ELSE 'draft' END) AS course_status
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      JOIN users u ON u.id = e.user_id
      ${whereClause}
      ORDER BY ${orderBy} ${sortOrder}
      LIMIT ?
      OFFSET ?
    `;

    const countQuery = `
      SELECT
        COUNT(*) AS total
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      ${whereClause}
    `;

    const statsQuery = `
      SELECT
        COUNT(*) AS total_students,
        SUM(CASE WHEN e.is_active = TRUE THEN 1 ELSE 0 END) AS active_students,
        SUM(CASE WHEN e.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed_students,
        AVG(e.progress_percentage) AS avg_progress
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      ${whereClause}
    `;

    const coursesQuery = `
      SELECT id, title
      FROM courses
      WHERE instructor_id = ?
      ORDER BY title ASC
    `;

    const [[{ total = 0 } = {}]] = await pool.execute(countQuery, params);
    const [[studentStats = {}]] = await pool.execute(statsQuery, params);
    const [rows] = await pool.execute(listQuery, [...params, limit, offset]);
    const [coursesRows] = await pool.execute(coursesQuery, [instructorId]);

    const students = rows.map((row) => ({
      enrollment_id: row.enrollment_id,
      enrolled_at: row.enrolled_at,
      progress_percentage: Number(row.progress_percentage || 0),
      completed_at: row.completed_at,
      last_accessed_at: row.last_accessed_at,
      is_active: Boolean(row.is_active),
      student: {
        id: row.user_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        last_login_at: row.last_login_at,
        profile_picture: row.profile_picture,
        profile_picture_url: buildMediaUrl(row.profile_picture)
      },
      course: {
        id: row.course_id,
        title: row.course_title,
        slug: row.course_slug,
        language: row.course_language,
        status: row.course_status
      }
    }));

    res.json({
      success: true,
      data: {
        students,
        pagination: {
          page,
          limit,
          total: Number(total || 0),
          pages: limit === 0 ? 0 : Math.ceil(Number(total || 0) / limit)
        },
        stats: {
          total_students: Number(studentStats.total_students || 0),
          active_students: Number(studentStats.active_students || 0),
          completed_students: Number(studentStats.completed_students || 0),
          avg_progress: Number(studentStats.avg_progress || 0)
        },
        filters: {
          courses: coursesRows.map((course) => ({
            id: course.id,
            title: course.title
          }))
        }
      }
    });
  } catch (error) {
    console.error('Erreur liste étudiants instructeur:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les étudiants'
    });
  }
};

const getCoursePerformance = async (req, res) => {
  const instructorId = ensureInstructor(req, res);
  if (!instructorId) {
    return;
  }

  const courseId = parseInt(req.params.courseId, 10);
  if (Number.isNaN(courseId)) {
    res.status(400).json({
      success: false,
      message: 'Identifiant de cours invalide'
    });
    return;
  }

  try {
    const [[course]] = await pool.execute(
      `
      SELECT
        c.id,
        c.title,
        c.slug,
        c.thumbnail_url,
        COALESCE(c.status, CASE WHEN c.is_published = 1 THEN 'published' ELSE 'draft' END) AS status,
        c.created_at,
        c.updated_at,
        c.language,
        c.duration_minutes,
        c.price,
        c.currency
      FROM courses c
      WHERE c.id = ? AND c.instructor_id = ?
    `,
      [courseId, instructorId]
    );

    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Cours introuvable'
      });
      return;
    }

    const rangeDays = parseRangeDays(req.query.range, 30);

    const [
      [courseAnalytics = {}],
      enrollmentTrend,
      [progressDistribution = {}],
      reviewStatsRows,
      recentReviewsRows,
      paymentsRows
    ] = await Promise.all([
      pool
        .execute(
          `
          SELECT
            COALESCE(ca.total_enrollments, COUNT(DISTINCT e.id)) AS total_enrollments,
            COALESCE(ca.total_views, 0) AS total_views,
            COALESCE(ca.completion_rate, AVG(e.progress_percentage)) AS completion_rate,
            AVG(e.progress_percentage) AS avg_progress
          FROM courses c
          LEFT JOIN course_analytics ca ON ca.course_id = c.id
          LEFT JOIN enrollments e ON e.course_id = c.id
          WHERE c.id = ?
          GROUP BY ca.total_enrollments, ca.total_views, ca.completion_rate
        `,
          [courseId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            DATE(e.enrolled_at) AS date,
            COUNT(*) AS new_enrollments
          FROM enrollments e
          WHERE e.course_id = ?
            AND e.enrolled_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
          GROUP BY DATE(e.enrolled_at)
          ORDER BY DATE(e.enrolled_at) ASC
        `,
          [courseId, rangeDays]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN e.progress_percentage < 25 THEN 1 ELSE 0 END) AS bucket_0_25,
            SUM(CASE WHEN e.progress_percentage >= 25 AND e.progress_percentage < 50 THEN 1 ELSE 0 END) AS bucket_25_50,
            SUM(CASE WHEN e.progress_percentage >= 50 AND e.progress_percentage < 75 THEN 1 ELSE 0 END) AS bucket_50_75,
            SUM(CASE WHEN e.progress_percentage >= 75 THEN 1 ELSE 0 END) AS bucket_75_100
          FROM enrollments e
          WHERE e.course_id = ?
        `,
          [courseId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            AVG(CASE WHEN cr.is_approved = 1 THEN cr.rating END) AS avg_rating,
            COUNT(CASE WHEN cr.is_approved = 1 THEN 1 ELSE NULL END) AS total_reviews
          FROM course_reviews cr
          WHERE cr.course_id = ?
        `,
          [courseId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            cr.id,
            cr.rating,
            cr.comment,
            cr.is_approved,
            cr.created_at,
            u.id AS student_id,
            u.first_name,
            u.last_name
          FROM course_reviews cr
          JOIN users u ON u.id = cr.user_id
          WHERE cr.course_id = ?
          ORDER BY cr.created_at DESC
          LIMIT 10
        `,
          [courseId]
        )
        .then(([rows]) => rows),
      pool
        .execute(
          `
          SELECT
            p.currency,
            SUM(p.amount) AS total_amount,
            COUNT(*) AS payments,
            MAX(p.completed_at) AS last_payment_at
          FROM payments p
          WHERE p.course_id = ?
            AND p.status = 'completed'
          GROUP BY p.currency
        `,
          [courseId]
        )
        .then(([rows]) => rows)
    ]);

    const totalEnrollments = Number(courseAnalytics.total_enrollments || 0);
    const progressBuckets = {
      bucket_0_25: Number(progressDistribution.bucket_0_25 || 0),
      bucket_25_50: Number(progressDistribution.bucket_25_50 || 0),
      bucket_50_75: Number(progressDistribution.bucket_50_75 || 0),
      bucket_75_100: Number(progressDistribution.bucket_75_100 || 0)
    };

    res.json({
      success: true,
      data: {
        course: {
          ...course,
          thumbnail_url: buildMediaUrl(course.thumbnail_url)
        },
        metrics: {
          total_enrollments: totalEnrollments,
          total_views: Number(courseAnalytics.total_views || 0),
          completion_rate: Number(courseAnalytics.completion_rate || 0),
          avg_progress: Number(courseAnalytics.avg_progress || 0),
          revenue: paymentsRows.map((row) => ({
            currency: row.currency,
            total_amount: Number(row.total_amount || 0),
            payments: Number(row.payments || 0),
            last_payment_at: row.last_payment_at
          }))
        },
        enrollment_trend: enrollmentTrend.map((row) => ({
          date: row.date,
          new_enrollments: Number(row.new_enrollments || 0)
        })),
        progress_distribution: {
          total: Number(progressDistribution.total || 0),
          ...progressBuckets
        },
        reviews: {
          statistics: {
            average_rating: Number(reviewStatsRows[0]?.avg_rating || 0),
            total_reviews: Number(reviewStatsRows[0]?.total_reviews || 0)
          },
          recent: recentReviewsRows.map((row) => ({
            id: row.id,
            rating: Number(row.rating || 0),
            comment: row.comment,
            is_approved: Boolean(row.is_approved),
            created_at: row.created_at,
            student: {
              id: row.student_id,
              first_name: row.first_name,
              last_name: row.last_name
            }
          }))
        }
      }
    });
  } catch (error) {
    console.error('Erreur performance cours instructeur:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les performances du cours'
    });
  }
};

const getEnrollmentTrend = async (req, res) => {
  const instructorId = ensureInstructor(req, res);
  if (!instructorId) {
    return;
  }

  const rangeDays = parseRangeDays(req.query.range, 30);

  try {
    const [rows] = await pool.execute(
      `
      SELECT
        DATE(e.enrolled_at) AS date,
        COUNT(*) AS new_enrollments
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE c.instructor_id = ?
        AND e.enrolled_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(e.enrolled_at)
      ORDER BY DATE(e.enrolled_at) ASC
    `,
      [instructorId, rangeDays]
    );

    res.json({
      success: true,
      data: rows.map((row) => ({
        date: row.date,
        new_enrollments: Number(row.new_enrollments || 0)
      }))
    });
  } catch (error) {
    console.error('Erreur trend inscriptions instructeur:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer la tendance des inscriptions'
    });
  }
};

const getRecentActivity = async (req, res) => {
  const instructorId = ensureInstructor(req, res);
  if (!instructorId) {
    return;
  }

  const limitParam = parseInt(req.query.limit, 10);
  const limit = Number.isNaN(limitParam)
    ? 20
    : Math.min(Math.max(limitParam, 1), MAX_RECENT_ACTIVITY_LIMIT);

  try {
    const [activityRows] = await pool.execute(
      `
      SELECT
        ua.id,
        ua.activity_type,
        ua.points_earned,
        ua.description,
        ua.metadata,
        ua.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM user_activities ua
      JOIN users u ON u.id = ua.user_id
      WHERE ua.user_id = ?
      ORDER BY ua.created_at DESC
      LIMIT ?
    `,
      [instructorId, limit]
    );

    const [systemRows] = await pool.execute(
      `
      SELECT
        se.id,
        se.event_type,
        se.description,
        se.metadata,
        se.created_at,
        se.course_id,
        c.title AS course_title,
        se.user_id,
        u.first_name,
        u.last_name,
        u.email
      FROM system_events se
      LEFT JOIN courses c ON c.id = se.course_id
      LEFT JOIN users u ON u.id = se.user_id
      WHERE (c.instructor_id = ? OR se.user_id = ?)
      ORDER BY se.created_at DESC
      LIMIT ?
    `,
      [instructorId, instructorId, limit]
    );

    const activities = [
      ...activityRows.map((row) => ({
        id: `activity-${row.id}`,
        type: 'user_activity',
        activity_type: row.activity_type,
        points: Number(row.points_earned || 0),
        description: row.description,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        created_at: row.created_at,
        user: {
          id: instructorId,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email
        },
        course: null
      })),
      ...systemRows.map((row) => ({
        id: `event-${row.id}`,
        type: 'system_event',
        event_type: row.event_type,
        description: row.description,
        metadata: parseJsonSafe(row.metadata),
        created_at: row.created_at,
        user: row.user_id
          ? {
              id: row.user_id,
              first_name: row.first_name,
              last_name: row.last_name,
              email: row.email
            }
          : null,
        course: row.course_id
          ? {
              id: row.course_id,
              title: row.course_title
            }
          : null
      }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Erreur activité récente instructeur:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les activités récentes'
    });
  }
};

const getUnreadMessagesCount = async (req, res) => {
  const instructorId = ensureInstructor(req, res);
  if (!instructorId) {
    return;
  }

  try {
    const [[{ unread_count = 0 } = {}]] = await pool.execute(
      `
      SELECT COUNT(*) AS unread_count
      FROM messages
      WHERE recipient_id = ?
        AND is_read = 0
    `,
      [instructorId]
    );

    res.json({
      success: true,
      data: {
        unread_count: Number(unread_count || 0)
      }
    });
  } catch (error) {
    console.error('Erreur compteur messages instructeur:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer le compteur de messages non lus'
    });
  }
};

const getNotifications = async (req, res) => {
  const instructorId = ensureInstructor(req, res);
  if (!instructorId) {
    return;
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const type = req.query.type;
  const isReadFilter = req.query.is_read;

  try {
    const where = ['user_id = ?'];
    const params = [instructorId];

    if (type) {
      where.push('type = ?');
      params.push(type);
    }

    if (isReadFilter === 'true') {
      where.push('is_read = TRUE');
    } else if (isReadFilter === 'false') {
      where.push('is_read = FALSE');
    }

    where.push('(expires_at IS NULL OR expires_at >= NOW())');

    const whereClause = where.join(' AND ');

    const [notifications] = await pool.execute(
      `
      SELECT *
      FROM notifications
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset]
    );

    const [[{ total = 0 } = {}]] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM notifications
      WHERE ${whereClause}
    `,
      params
    );

    res.json({
      success: true,
      data: {
        notifications: notifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          is_read: Boolean(notification.is_read),
          action_url: notification.action_url,
          metadata: parseJsonSafe(notification.metadata),
          created_at: notification.created_at,
          read_at: notification.read_at,
          expires_at: notification.expires_at
        })),
        pagination: {
          page,
          limit,
          total: Number(total),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Erreur notifications instructeur:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les notifications'
    });
  }
};

const getAnalytics = async (req, res) => {
  const instructorId = ensureInstructor(req, res);
  if (!instructorId) {
    return;
  }

  const rangeDays = parseRangeDays(req.query.range, 30);

  try {
    const [enrollmentTrend] = await pool.execute(
      `
      SELECT
        DATE(e.enrolled_at) AS date,
        COUNT(*) AS enrollments
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE c.instructor_id = ?
        AND e.enrolled_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(e.enrolled_at)
      ORDER BY DATE(e.enrolled_at) ASC
    `,
      [instructorId, rangeDays]
    );

    const [revenueTrend] = await pool.execute(
      `
      SELECT
        DATE(p.completed_at) AS date,
        p.currency,
        SUM(p.amount) AS total_amount,
        COUNT(*) AS payments
      FROM payments p
      JOIN courses c ON c.id = p.course_id
      WHERE c.instructor_id = ?
        AND p.status = 'completed'
        AND p.completed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(p.completed_at), p.currency
      ORDER BY DATE(p.completed_at) ASC
    `,
      [instructorId, rangeDays]
    );

    const [topRatedCourses] = await pool.execute(
      `
      SELECT
        c.id,
        c.title,
        c.thumbnail_url,
        AVG(CASE WHEN cr.is_approved = 1 THEN cr.rating END) AS avg_rating,
        COUNT(CASE WHEN cr.is_approved = 1 THEN 1 ELSE NULL END) AS total_reviews
      FROM courses c
      LEFT JOIN course_reviews cr ON cr.course_id = c.id
      WHERE c.instructor_id = ?
      GROUP BY c.id, c.title, c.thumbnail_url
      HAVING total_reviews > 0
      ORDER BY avg_rating DESC, total_reviews DESC
      LIMIT 5
    `,
      [instructorId]
    );

    const [topEngagementCourses] = await pool.execute(
      `
      SELECT
        c.id,
        c.title,
        c.thumbnail_url,
        COALESCE(ca.total_views, 0) AS total_views,
        COALESCE(ca.total_enrollments, COUNT(DISTINCT e.id)) AS total_enrollments,
        COALESCE(ca.completion_rate, AVG(e.progress_percentage)) AS completion_rate
      FROM courses c
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      LEFT JOIN enrollments e ON e.course_id = c.id
      WHERE c.instructor_id = ?
      GROUP BY c.id, c.title, c.thumbnail_url, ca.total_views, ca.total_enrollments, ca.completion_rate
      ORDER BY total_views DESC, total_enrollments DESC
      LIMIT 5
    `,
      [instructorId]
    );

    res.json({
      success: true,
      data: {
        enrollment_trend: enrollmentTrend.map((row) => ({
          date: row.date,
          enrollments: Number(row.enrollments || 0)
        })),
        revenue_trend: revenueTrend.map((row) => ({
          date: row.date,
          currency: row.currency,
          total_amount: Number(row.total_amount || 0),
          payments: Number(row.payments || 0)
        })),
        top_rated_courses: topRatedCourses.map((row) => ({
          id: row.id,
          title: row.title,
          thumbnail_url: buildMediaUrl(row.thumbnail_url),
          avg_rating: Number(row.avg_rating || 0),
          total_reviews: Number(row.total_reviews || 0)
        })),
        top_engagement_courses: topEngagementCourses.map((row) => ({
          id: row.id,
          title: row.title,
          thumbnail_url: buildMediaUrl(row.thumbnail_url),
          total_views: Number(row.total_views || 0),
          total_enrollments: Number(row.total_enrollments || 0),
          completion_rate: Number(row.completion_rate || 0)
        }))
      }
    });
  } catch (error) {
    console.error('Erreur analytics instructeur:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les analytics instructeur'
    });
  }
};

module.exports = {
  getDashboard,
  getCourses,
  getStudents,
  getCoursePerformance,
  getEnrollmentTrend,
  getRecentActivity,
  getUnreadMessagesCount,
  getNotifications,
  getAnalytics
};

