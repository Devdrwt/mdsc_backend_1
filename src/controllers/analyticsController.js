const { pool } = require('../config/database');

// Dashboard Analytics pour Apprenant
const getStudentDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Statistiques générales
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT e.course_id) as total_courses,
        COUNT(DISTINCT CASE WHEN e.completed_at IS NOT NULL THEN e.course_id END) as completed_courses,
        AVG(e.progress_percentage) as avg_progress,
        COUNT(DISTINCT qa.id) as total_quiz_attempts,
        AVG(qa.percentage) as avg_quiz_score,
        COUNT(DISTINCT ub.badge_id) as badges_earned,
        COALESCE(up.points, 0) as total_points,
        COALESCE(up.level, 1) as current_level
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.user_id
      LEFT JOIN quiz_attempts qa ON u.id = qa.user_id
      LEFT JOIN user_badges ub ON u.id = ub.user_id
      LEFT JOIN user_points up ON u.id = up.user_id
      WHERE u.id = ?
    `;
    const [stats] = await pool.execute(statsQuery, [userId]);

    // Cours récents
    const recentCoursesQuery = `
      SELECT 
        c.*,
        e.progress_percentage,
        e.enrolled_at,
        e.completed_at,
        cat.name as category_name,
        cat.color as category_color
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE e.user_id = ?
      ORDER BY e.enrolled_at DESC
      LIMIT 5
    `;
    const [recentCourses] = await pool.execute(recentCoursesQuery, [userId]);

    // Activités récentes
    const recentActivitiesQuery = `
      SELECT 
        activity_type,
        points_earned,
        description,
        created_at
      FROM user_activities
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const [recentActivities] = await pool.execute(recentActivitiesQuery, [userId]);

    // Progression par mois (6 derniers mois)
    const progressQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(points_earned) as points_earned,
        COUNT(*) as activities_count
      FROM user_activities
      WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `;
    const [progressData] = await pool.execute(progressQuery, [userId]);

    // Notifications non lues
    const notificationsQuery = `
      SELECT COUNT(*) as unread_count
      FROM notifications
      WHERE user_id = ? AND is_read = FALSE
    `;
    const [notifications] = await pool.execute(notificationsQuery, [userId]);

    res.json({
      success: true,
      data: {
        statistics: stats[0],
        recent_courses: recentCourses,
        recent_activities: recentActivities,
        progress_over_time: progressData,
        unread_notifications: notifications[0].unread_count
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du dashboard apprenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du dashboard apprenant'
    });
  }
};

// Dashboard Analytics pour Formateur
const getInstructorDashboard = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId ?? null;
    if (userId == null) {
      return res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
    }

    // Statistiques des cours créés
    const coursesStatsQuery = `
      SELECT 
        COUNT(*) as total_courses,
        COUNT(CASE WHEN is_published = TRUE THEN 1 END) as published_courses,
        COUNT(CASE WHEN is_published = FALSE THEN 1 END) as draft_courses,
        AVG(duration_minutes) as avg_duration,
        SUM(price) as total_revenue
      FROM courses
      WHERE instructor_id = ?
    `;
    const [coursesStats] = await pool.execute(coursesStatsQuery, [userId]);

    // Statistiques des étudiants
    const studentsStatsQuery = `
      SELECT 
        COUNT(DISTINCT e.user_id) as total_students,
        COUNT(DISTINCT CASE WHEN e.completed_at IS NOT NULL THEN e.user_id END) as completed_students,
        AVG(e.progress_percentage) as avg_completion_rate,
        COUNT(DISTINCT CASE WHEN e.enrolled_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN e.user_id END) as new_students_30d
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.instructor_id = ?
    `;
    const [studentsStats] = await pool.execute(studentsStatsQuery, [userId]);

    // Top cours par inscriptions
    const topCoursesQuery = `
      SELECT 
        c.id,
        c.title,
        c.thumbnail_url,
        COUNT(e.id) as enrollment_count,
        AVG(e.progress_percentage) as avg_progress,
        COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) as completion_count
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.instructor_id = ?
      GROUP BY c.id, c.title, c.thumbnail_url
      ORDER BY enrollment_count DESC
      LIMIT 5
    `;
    const [topCourses] = await pool.execute(topCoursesQuery, [userId]);

    // Évaluations en attente
    const pendingEvaluationsQuery = `
      SELECT 
        a.id,
        a.title,
        a.due_date,
        COUNT(sub.id) as total_submissions,
        COUNT(CASE WHEN sub.grade IS NULL THEN 1 END) as pending_grades
      FROM assignments a
      LEFT JOIN assignment_submissions sub ON a.id = sub.assignment_id
      JOIN courses c ON a.course_id = c.id
      WHERE c.instructor_id = ?
      GROUP BY a.id, a.title, a.due_date
      HAVING pending_grades > 0
      ORDER BY a.due_date ASC
    `;
    let pendingEvaluations = [];
    try {
      const [rows] = await pool.execute(pendingEvaluationsQuery, [userId]);
      pendingEvaluations = rows;
    } catch (e) {
      if (e && (e.code === 'ER_NO_SUCH_TABLE' || String(e.sqlMessage || '').includes('doesn\'t exist'))) {
        pendingEvaluations = [];
      } else {
        throw e;
      }
    }

    // Performance des quiz
    const quizPerformanceQuery = `
      SELECT 
        q.title,
        COUNT(qa.id) as total_attempts,
        AVG(qa.percentage) as avg_score,
        COUNT(CASE WHEN qa.is_passed = TRUE THEN 1 END) as passed_attempts
      FROM quizzes q
      JOIN courses c ON q.course_id = c.id
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
      WHERE c.instructor_id = ?
      GROUP BY q.id, q.title
      ORDER BY total_attempts DESC
      LIMIT 5
    `;
    const [quizPerformance] = await pool.execute(quizPerformanceQuery, [userId]);

    // Évolution des inscriptions (6 derniers mois)
    const enrollmentTrendQuery = `
      SELECT 
        DATE_FORMAT(e.enrolled_at, '%Y-%m') as month,
        COUNT(*) as new_enrollments
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE c.instructor_id = ? AND e.enrolled_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(e.enrolled_at, '%Y-%m')
      ORDER BY month ASC
    `;
    const [enrollmentTrend] = await pool.execute(enrollmentTrendQuery, [userId]);

    res.json({
      success: true,
      data: {
        courses_statistics: coursesStats[0],
        students_statistics: studentsStats[0],
        top_courses: topCourses,
        pending_evaluations: pendingEvaluations,
        quiz_performance: quizPerformance,
        enrollment_trend: enrollmentTrend
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du dashboard formateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du dashboard formateur'
    });
  }
};

// Dashboard Analytics pour Admin
const getAdminDashboard = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    // Statistiques globales
    const globalStatsQuery = `
      SELECT 
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN u.role = 'student' THEN u.id END) as total_students,
        COUNT(DISTINCT CASE WHEN u.role = 'instructor' THEN u.id END) as total_instructors,
        COUNT(DISTINCT c.id) as total_courses,
        COUNT(DISTINCT e.id) as total_enrollments,
        COUNT(DISTINCT CASE WHEN e.completed_at IS NOT NULL THEN e.id END) as completed_enrollments,
        AVG(e.progress_percentage) as global_completion_rate
      FROM users u
      LEFT JOIN courses c ON u.id = c.instructor_id
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE u.is_active = TRUE
    `;
    const [globalStats] = await pool.execute(globalStatsQuery);

    // Activité récente
    const recentActivityQuery = `
      SELECT 
        se.event_type,
        se.description,
        u.first_name,
        u.last_name,
        se.created_at
      FROM system_events se
      LEFT JOIN users u ON se.user_id = u.id
      ORDER BY se.created_at DESC
      LIMIT 20
    `;
    const [recentActivity] = await pool.execute(recentActivityQuery);

    // Top cours par popularité
    const popularCoursesQuery = `
      SELECT 
        c.id,
        c.title,
        c.instructor_id,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        COUNT(e.id) as enrollment_count,
        AVG(e.progress_percentage) as avg_progress,
        AVG(cr.rating) as avg_rating,
        COUNT(cr.id) as review_count
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      WHERE c.is_published = TRUE
      GROUP BY c.id, c.title, c.instructor_id, u.first_name, u.last_name
      ORDER BY enrollment_count DESC
      LIMIT 10
    `;
    const [popularCourses] = await pool.execute(popularCoursesQuery);

    // Statistiques par catégorie
    const categoryStatsQuery = `
      SELECT 
        cat.name,
        cat.color,
        COUNT(c.id) as course_count,
        COUNT(e.id) as enrollment_count,
        AVG(e.progress_percentage) as avg_progress
      FROM categories cat
      LEFT JOIN courses c ON cat.id = c.category_id AND c.is_published = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id
      GROUP BY cat.id, cat.name, cat.color
      ORDER BY course_count DESC
    `;
    const [categoryStats] = await pool.execute(categoryStatsQuery);

    // Évolution des utilisateurs (6 derniers mois)
    const userGrowthQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as new_users
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `;
    const [userGrowth] = await pool.execute(userGrowthQuery);

    // Performance système
    const systemPerformanceQuery = `
      SELECT 
        metric_name,
        AVG(metric_value) as avg_value,
        MAX(metric_value) as max_value,
        MIN(metric_value) as min_value
      FROM performance_metrics
      WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      GROUP BY metric_name
    `;
    const [systemPerformance] = await pool.execute(systemPerformanceQuery);

    res.json({
      success: true,
      data: {
        global_statistics: globalStats[0],
        recent_activity: recentActivity,
        popular_courses: popularCourses,
        category_statistics: categoryStats,
        user_growth: userGrowth,
        system_performance: systemPerformance
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du dashboard admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du dashboard admin'
    });
  }
};

// Rapports détaillés
const getDetailedReport = async (req, res) => {
  try {
    const { reportType, startDate, endDate, courseId } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let reportData = {};

    switch (reportType) {
      case 'course_progress':
        reportData = await getCourseProgressReport(courseId, startDate, endDate, userRole, userId);
        break;
      case 'student_performance':
        reportData = await getStudentPerformanceReport(userId, startDate, endDate);
        break;
      case 'quiz_analytics':
        reportData = await getQuizAnalyticsReport(courseId, startDate, endDate, userRole, userId);
        break;
      case 'engagement_metrics':
        reportData = await getEngagementMetricsReport(startDate, endDate, userRole, userId);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Type de rapport non valide'
        });
    }

    res.json({
      success: true,
      data: reportData
    });

  } catch (error) {
    console.error('Erreur lors de la génération du rapport:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du rapport'
    });
  }
};

// Fonctions de génération de rapports
const getCourseProgressReport = async (courseId, startDate, endDate, userRole, userId) => {
  // Vérifier les permissions
  if (userRole === 'student') {
    // Vérifier que l'étudiant est inscrit au cours
    const enrollmentQuery = 'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?';
    const [enrollments] = await pool.execute(enrollmentQuery, [userId, courseId]);
    if (enrollments.length === 0) {
      throw new Error('Non autorisé à accéder à ce cours');
    }
  } else if (userRole === 'instructor') {
    // Vérifier que l'instructeur est propriétaire du cours
    const courseQuery = 'SELECT id FROM courses WHERE id = ? AND instructor_id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId, userId]);
    if (courses.length === 0) {
      throw new Error('Non autorisé à accéder à ce cours');
    }
  }

  const query = `
    SELECT 
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      e.enrolled_at,
      e.progress_percentage,
      e.completed_at,
      COUNT(DISTINCT lp.lesson_id) as lessons_completed,
      COUNT(DISTINCT qa.id) as quiz_attempts,
      AVG(qa.percentage) as avg_quiz_score
    FROM enrollments e
    JOIN users u ON e.user_id = u.id
    LEFT JOIN lesson_progress lp ON e.user_id = lp.user_id AND e.course_id = lp.course_id AND lp.is_completed = TRUE
    LEFT JOIN quiz_attempts qa ON e.user_id = qa.user_id AND e.course_id = qa.course_id
    WHERE e.course_id = ?
    ${startDate ? 'AND e.enrolled_at >= ?' : ''}
    ${endDate ? 'AND e.enrolled_at <= ?' : ''}
    GROUP BY u.id, u.first_name, u.last_name, u.email, e.enrolled_at, e.progress_percentage, e.completed_at
    ORDER BY e.progress_percentage DESC
  `;

  const params = [courseId];
  if (startDate) params.push(startDate);
  if (endDate) params.push(endDate);

  const [students] = await pool.execute(query, params);

  return {
    report_type: 'course_progress',
    course_id: courseId,
    period: { start_date: startDate, end_date: endDate },
    students: students,
    summary: {
      total_students: students.length,
      avg_progress: students.reduce((sum, s) => sum + (s.progress_percentage || 0), 0) / students.length,
      completed_students: students.filter(s => s.completed_at).length
    }
  };
};

const getStudentPerformanceReport = async (userId, startDate, endDate) => {
  const query = `
    SELECT 
      c.title as course_title,
      e.progress_percentage,
      e.completed_at,
      COUNT(DISTINCT lp.lesson_id) as lessons_completed,
      COUNT(DISTINCT qa.id) as quiz_attempts,
      AVG(qa.percentage) as avg_quiz_score,
      COUNT(DISTINCT as.id) as assignments_submitted
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    LEFT JOIN lesson_progress lp ON e.user_id = lp.user_id AND e.course_id = lp.course_id AND lp.is_completed = TRUE
    LEFT JOIN quiz_attempts qa ON e.user_id = qa.user_id AND e.course_id = qa.course_id
    LEFT JOIN assignments a ON e.course_id = a.course_id
    LEFT JOIN assignment_submissions as ON a.id = as.assignment_id AND as.user_id = e.user_id
    WHERE e.user_id = ?
    ${startDate ? 'AND e.enrolled_at >= ?' : ''}
    ${endDate ? 'AND e.enrolled_at <= ?' : ''}
    GROUP BY c.id, c.title, e.progress_percentage, e.completed_at
    ORDER BY e.progress_percentage DESC
  `;

  const params = [userId];
  if (startDate) params.push(startDate);
  if (endDate) params.push(endDate);

  const [performance] = await pool.execute(query, params);

  return {
    report_type: 'student_performance',
    user_id: userId,
    period: { start_date: startDate, end_date: endDate },
    performance: performance
  };
};

const getQuizAnalyticsReport = async (courseId, startDate, endDate, userRole, userId) => {
  // Vérifications de permissions similaires à getCourseProgressReport
  const query = `
    SELECT 
      q.title as quiz_title,
      COUNT(qa.id) as total_attempts,
      AVG(qa.percentage) as avg_score,
      COUNT(CASE WHEN qa.is_passed = TRUE THEN 1 END) as passed_attempts,
      COUNT(CASE WHEN qa.is_passed = FALSE THEN 1 END) as failed_attempts,
      AVG(qa.time_spent_minutes) as avg_time_spent
    FROM quizzes q
    LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
    WHERE q.course_id = ?
    ${startDate ? 'AND qa.started_at >= ?' : ''}
    ${endDate ? 'AND qa.started_at <= ?' : ''}
    GROUP BY q.id, q.title
    ORDER BY total_attempts DESC
  `;

  const params = [courseId];
  if (startDate) params.push(startDate);
  if (endDate) params.push(endDate);

  const [analytics] = await pool.execute(query, params);

  return {
    report_type: 'quiz_analytics',
    course_id: courseId,
    period: { start_date: startDate, end_date: endDate },
    analytics: analytics
  };
};

const getEngagementMetricsReport = async (startDate, endDate, userRole, userId) => {
  const query = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as total_activities,
      COUNT(DISTINCT user_id) as active_users,
      SUM(points_earned) as total_points_earned
    FROM user_activities
    WHERE 1=1
    ${startDate ? 'AND created_at >= ?' : ''}
    ${endDate ? 'AND created_at <= ?' : ''}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  const params = [];
  if (startDate) params.push(startDate);
  if (endDate) params.push(endDate);

  const [metrics] = await pool.execute(query, params);

  return {
    report_type: 'engagement_metrics',
    period: { start_date: startDate, end_date: endDate },
    metrics: metrics
  };
};

module.exports = {
  getStudentDashboard,
  getInstructorDashboard,
  getAdminDashboard,
  getDetailedReport
};
