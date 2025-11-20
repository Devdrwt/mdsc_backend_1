const { pool } = require('../config/database');
const { buildMediaUrl, formatInstructorMetadata } = require('../utils/media');

const MAX_RECENT_ACTIVITY_LIMIT = 50;

const ensureStudent = (req, res) => {
  const user = req.user || {};
  const userId = user.userId || user.id;
  const role = user.role;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Utilisateur non authentifié'
    });
    return null;
  }

  if (role !== 'student' && role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Accès réservé aux étudiants'
    });
    return null;
  }

  return userId;
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

const differenceInDays = (dateA, dateB) => {
  const dA = new Date(dateA.getFullYear(), dateA.getMonth(), dateA.getDate());
  const dB = new Date(dateB.getFullYear(), dateB.getMonth(), dateB.getDate());
  const diffMs = dA.getTime() - dB.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
};

const computeActivityStreak = (activityDates) => {
  if (!activityDates.length) {
    return 0;
  }

  let streak = 0;
  let referenceDate = new Date();

  for (const { activity_date: activityDate } of activityDates) {
    const currentDate = new Date(activityDate);
    const diff = differenceInDays(referenceDate, currentDate);

    if (diff === 0 || (streak === 0 && diff === 1)) {
      streak += 1;
      referenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1);
      continue;
    }

    if (diff === 1) {
      streak += 1;
      referenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1);
      continue;
    }

    break;
  }

  return streak;
};

const getCourses = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
    return;
  }

  try {
    const [courses] = await pool.execute(
      `
      SELECT
        e.id AS enrollment_id,
        e.course_id,
        e.enrolled_at,
        e.progress_percentage,
        e.completed_at,
        e.last_accessed_at,
        c.title,
        c.slug,
        c.thumbnail_url,
        c.language,
        c.duration_minutes,
        c.difficulty,
        c.price,
        c.currency,
        cat.name AS category_name,
        cat.color AS category_color,
        inst.id AS instructor_id,
        inst.first_name AS instructor_first_name,
        inst.last_name AS instructor_last_name,
        inst.email AS instructor_email,
        inst.organization AS instructor_organization,
        inst.profile_picture AS instructor_profile_picture,
        cert.id AS certificate_id,
        cert.issued_at AS certificate_issued_at,
        last_lp.lesson_id AS last_lesson_id,
        last_lesson.title AS last_lesson_title,
        last_lesson.order_index AS last_lesson_order,
        COUNT(DISTINCT e2.id) AS enrollment_count
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      LEFT JOIN categories cat ON cat.id = c.category_id
      LEFT JOIN users inst ON inst.id = c.instructor_id
      LEFT JOIN certificates cert ON cert.course_id = c.id AND cert.user_id = e.user_id
      LEFT JOIN enrollments e2 ON e2.course_id = c.id AND e2.is_active = TRUE
      LEFT JOIN (
        SELECT
          latest.user_id,
          latest.course_id,
          lp.lesson_id,
          lp.updated_at
        FROM lesson_progress lp
        INNER JOIN (
          SELECT
            user_id,
            course_id,
            MAX(updated_at) AS max_updated
          FROM lesson_progress
          GROUP BY user_id, course_id
        ) latest
          ON latest.user_id = lp.user_id
          AND latest.course_id = lp.course_id
          AND latest.max_updated = lp.updated_at
      ) AS last_lp
        ON last_lp.user_id = e.user_id
        AND last_lp.course_id = e.course_id
      LEFT JOIN lessons last_lesson ON last_lesson.id = last_lp.lesson_id
      WHERE e.user_id = ? AND e.is_active = TRUE
      GROUP BY e.id, e.course_id, e.enrolled_at, e.progress_percentage, e.completed_at, e.last_accessed_at,
               c.title, c.slug, c.thumbnail_url, c.language, c.duration_minutes, c.difficulty, c.price, c.currency,
               cat.name, cat.color, inst.id, inst.first_name, inst.last_name, inst.email, inst.organization, inst.profile_picture,
               cert.id, cert.issued_at, last_lp.lesson_id, last_lesson.title, last_lesson.order_index
      ORDER BY e.enrolled_at DESC
    `,
      [studentId]
    );

    const formatted = courses.map((course) => ({
      enrollment_id: course.enrollment_id,
      course_id: course.course_id,
      title: course.title,
      slug: course.slug,
      thumbnail_url: buildMediaUrl(course.thumbnail_url),
      category: course.category_name
        ? {
            name: course.category_name,
            color: course.category_color
          }
        : null,
      instructor: course.instructor_id
        ? formatInstructorMetadata({
            id: course.instructor_id,
            first_name: course.instructor_first_name,
            last_name: course.instructor_last_name,
            profile_picture: course.instructor_profile_picture
          })
        : null,
      instructor_first_name: course.instructor_first_name,
      instructor_last_name: course.instructor_last_name,
      progress_percentage: Number(course.progress_percentage || 0),
      completed_at: course.completed_at,
      enrolled_at: course.enrolled_at,
      last_accessed_at: course.last_accessed_at,
      last_lesson: course.last_lesson_id
        ? {
            id: course.last_lesson_id,
            title: course.last_lesson_title,
            order: course.last_lesson_order
          }
        : null,
      certificate: course.certificate_id
        ? {
            id: course.certificate_id,
            issued_at: course.certificate_issued_at
          }
        : null,
      language: course.language,
      difficulty: course.difficulty,
      duration_minutes: Number(course.duration_minutes || 0),
      price: Number(course.price || 0),
      currency: course.currency,
      enrollment_count: Number(course.enrollment_count || 0),
      metrics: {
        enrollment_count: Number(course.enrollment_count || 0)
      }
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Erreur cours étudiant:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les cours'
    });
  }
};

const getCourseProgress = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
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
    const [[enrollment]] = await pool.execute(
      `
      SELECT *
      FROM enrollments
      WHERE user_id = ? AND course_id = ? AND is_active = TRUE
    `,
      [studentId, courseId]
    );

    if (!enrollment) {
      res.status(404).json({
        success: false,
        message: 'Vous n\'êtes pas inscrit à ce cours'
      });
      return;
    }

    // Récupérer les leçons avec progression (vérifier les deux tables progress et lesson_progress)
    const [lessons] = await pool.execute(
      `
      SELECT
        l.id,
        l.title,
        l.order_index,
        l.duration_minutes,
        l.content_type,
        l.is_required,
        COALESCE(
          lp.is_completed,
          CASE WHEN p.status = 'completed' THEN TRUE ELSE FALSE END,
          FALSE
        ) as is_completed,
        COALESCE(lp.completed_at, p.completed_at) as completed_at,
        COALESCE(lp.time_spent_minutes, FLOOR(p.time_spent / 60), 0) as time_spent_minutes,
        lp.last_position_seconds
      FROM lessons l
      LEFT JOIN lesson_progress lp
        ON lp.lesson_id = l.id
       AND lp.user_id = ?
       AND lp.course_id = ?
      LEFT JOIN enrollments e ON e.user_id = ? AND e.course_id = ? AND e.is_active = TRUE
      LEFT JOIN progress p
        ON p.lesson_id = l.id
       AND p.enrollment_id = e.id
      WHERE l.course_id = ?
        AND l.is_published = TRUE
      ORDER BY l.order_index ASC
    `,
      [studentId, courseId, studentId, courseId, courseId]
    );

    const [quizzes] = await pool.execute(
      `
      SELECT
        q.id,
        q.title,
        q.total_points,
        q.pass_percentage,
        qa.score,
        qa.percentage,
        qa.is_passed,
        qa.completed_at
      FROM quizzes q
      LEFT JOIN quiz_attempts qa
        ON qa.quiz_id = q.id
       AND qa.user_id = ?
      WHERE q.course_id = ?
        AND q.is_published = TRUE
    `,
      [studentId, courseId]
    );

    const totalLessons = lessons.length;
    const completedLessons = lessons.filter((lesson) => lesson.is_completed).length;

    res.json({
      success: true,
      data: {
        enrollment,
        lessons,
        quizzes,
        statistics: {
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          total_quizzes: quizzes.length,
          passed_quizzes: quizzes.filter((quiz) => quiz.is_passed).length,
          progress_percentage: Number(enrollment.progress_percentage || 0)
        }
      }
    });
  } catch (error) {
    console.error('Erreur progression étudiant:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer la progression'
    });
  }
};

const getStats = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
    return;
  }

  try {
    const [
      [[enrollmentStats = {}] = []],
      [[pointsStats = {}] = []],
      [[badgesStats = {}] = []],
      [[certificateStats = {}] = []],
      [activityDates],
      [[weeklyPoints = {}] = []],
      [[notificationsStats = {}] = []],
      [[eventsStats = {}] = []]
    ] = await Promise.all([
      pool.execute(
        `
        SELECT
          COUNT(*) AS total_courses,
          SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed_courses,
          SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) AS active_courses,
          AVG(progress_percentage) AS avg_progress
        FROM enrollments
        WHERE user_id = ? AND is_active = TRUE
        `,
        [studentId]
      ),
      pool.execute(
        `
        SELECT
          points,
          level,
          total_points_earned,
          last_activity_at
        FROM user_points
        WHERE user_id = ?
      `,
        [studentId]
      ),
      pool.execute(
        `
        SELECT COUNT(*) AS badges_count
        FROM user_badges
        WHERE user_id = ?
      `,
        [studentId]
      ),
      pool.execute(
        `
        SELECT COUNT(*) AS certificates_count
        FROM certificates
        WHERE user_id = ?
      `,
        [studentId]
      ),
      pool.execute(
        `
        SELECT DATE(created_at) AS activity_date
        FROM user_activities
        WHERE user_id = ?
          AND created_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
        GROUP BY DATE(created_at)
        ORDER BY activity_date DESC
      `,
        [studentId]
      ),
      pool.execute(
        `
        SELECT SUM(points_earned) AS points
        FROM user_activities
        WHERE user_id = ?
          AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      `,
        [studentId]
      ),
      pool.execute(
        `
        SELECT
          SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) AS unread_notifications,
          COUNT(*) AS total_notifications
        FROM notifications
        WHERE user_id = ?
      `,
        [studentId]
      ),
      pool.execute(
        `
        SELECT COUNT(*) AS upcoming_events
        FROM events
        WHERE (course_id IN (
          SELECT course_id FROM enrollments WHERE user_id = ? AND is_active = TRUE
        ) OR created_by = ?)
          AND start_date >= NOW()
        `,
        [studentId, studentId]
      )
    ]);

    const streak = computeActivityStreak(activityDates);

    res.json({
      success: true,
      data: {
        courses: {
          total: Number(enrollmentStats.total_courses || 0),
          completed: Number(enrollmentStats.completed_courses || 0),
          active: Number(enrollmentStats.active_courses || 0),
          average_progress: Number(enrollmentStats.avg_progress || 0)
        },
        gamification: {
          points: Number(pointsStats.points || 0),
          level: Number(pointsStats.level || 1),
          total_points_earned: Number(pointsStats.total_points_earned || 0),
          last_activity_at: pointsStats.last_activity_at,
          badges_count: Number(badgesStats.badges_count || 0),
          weekly_points: Number(weeklyPoints.points || 0)
        },
        certificates: {
          total: Number(certificateStats.certificates_count || 0)
        },
        notifications: {
          unread: Number(notificationsStats.unread_notifications || 0),
          total: Number(notificationsStats.total_notifications || 0)
        },
        calendar: {
          upcoming_events: Number(eventsStats.upcoming_events || 0)
        },
        streak: {
          current: streak,
          last_activity_dates: activityDates.map((row) => row.activity_date)
        }
      }
    });
  } catch (error) {
    console.error('Erreur stats étudiant:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les statistiques'
    });
  }
};

const getRecentActivity = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
    return;
  }

  const limitParam = parseInt(req.query.limit, 10);
  const limit = Number.isNaN(limitParam)
    ? 20
    : Math.min(Math.max(limitParam, 1), MAX_RECENT_ACTIVITY_LIMIT);

  try {
    const [activities] = await pool.execute(
      `
      SELECT
        id,
        activity_type,
        points_earned,
        description,
        metadata,
        created_at
      FROM user_activities
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
      [studentId, limit]
    );

    res.json({
      success: true,
      data: activities.map((activity) => ({
        id: activity.id,
        type: activity.activity_type,
        points: Number(activity.points_earned || 0),
        description: activity.description,
        metadata: parseJsonSafe(activity.metadata),
        created_at: activity.created_at
      }))
    });
  } catch (error) {
    console.error('Erreur activités étudiant:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les activités récentes'
    });
  }
};

const getBadges = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
    return;
  }

  try {
    const [badges] = await pool.execute(
      `
      SELECT
        b.id,
        b.name,
        b.description,
        b.icon,
        b.color,
        b.points_required,
        b.criteria,
        ub.earned_at
      FROM user_badges ub
      JOIN badges b ON b.id = ub.badge_id
      WHERE ub.user_id = ?
      ORDER BY ub.earned_at DESC
    `,
      [studentId]
    );

    res.json({
      success: true,
      data: badges.map((badge) => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        color: badge.color,
        points_required: Number(badge.points_required || 0),
        criteria: parseJsonSafe(badge.criteria),
        earned_at: badge.earned_at
      }))
    });
  } catch (error) {
    console.error('Erreur badges étudiant:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les badges'
    });
  }
};

const getCertificates = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
    return;
  }

  try {
    const [certificates] = await pool.execute(
      `
      SELECT
        c.id,
        c.course_id,
        c.certificate_code,
        c.issued_at,
        c.pdf_url,
        c.verified,
        co.title AS course_title,
        co.description AS course_description
      FROM certificates c
      JOIN courses co ON co.id = c.course_id
      WHERE c.user_id = ?
      ORDER BY c.issued_at DESC
    `,
      [studentId]
    );

    res.json({
      success: true,
      data: certificates.map((certificate) => ({
        id: certificate.id,
        course_id: certificate.course_id,
        course_title: certificate.course_title,
        course_description: certificate.course_description,
        certificate_code: certificate.certificate_code,
        issued_at: certificate.issued_at,
        verified: Boolean(certificate.verified),
        pdf_url: buildMediaUrl(certificate.pdf_url)
      }))
    });
  } catch (error) {
    console.error('Erreur certificats étudiant:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les certificats'
    });
  }
};

const getActivities = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
    return;
  }

  const limitParam = parseInt(req.query.limit, 10);
  const limit = Number.isNaN(limitParam)
    ? 20
    : Math.min(Math.max(limitParam, 1), 100);
  const type = req.query.type;

  try {
    const where = ['user_id = ?'];
    const params = [studentId];

    if (type) {
      where.push('activity_type = ?');
      params.push(type);
    }

    const [rows] = await pool.execute(
      `
      SELECT
        id,
        activity_type,
        points_earned,
        description,
        metadata,
        created_at
      FROM user_activities
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ?
    `,
      [...params, limit]
    );

    res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        type: row.activity_type, // Alias pour compatibilité frontend
        activity_type: row.activity_type,
        points: Number(row.points_earned || 0),
        description: row.description,
        metadata: parseJsonSafe(row.metadata),
        created_at: row.created_at
      }))
    });
  } catch (error) {
    console.error('Erreur activité étudiant:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les activités'
    });
  }
};

const getCatalogCategories = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
    return;
  }

  try {
    const {
      search = '',
      status = 'all',
      onlyEnrolled = 'false',
      level
    } = req.query;
    const normalizedLevel = typeof level === 'string' ? level.toLowerCase() : null;

    const whereClauses = [];
    const params = [studentId];

    if (search) {
      whereClauses.push('(cat.name LIKE ? OR cat.description LIKE ?)');
      const likeSearch = `%${search}%`;
      params.push(likeSearch, likeSearch);
    }

    if (status === 'active') {
      whereClauses.push('cat.is_active = TRUE');
    } else if (status === 'inactive') {
      whereClauses.push('cat.is_active = FALSE');
    }

    const query = `
      SELECT
        cat.id,
        cat.name,
        cat.description,
        cat.color,
        cat.icon,
        cat.is_active,
        COUNT(DISTINCT c.id) AS total_courses,
        COUNT(DISTINCT CASE WHEN c.is_published = TRUE THEN c.id END) AS published_courses,
        COUNT(DISTINCT CASE WHEN c.is_published = FALSE THEN c.id END) AS draft_courses,
        COUNT(DISTINCT CASE WHEN e.user_id IS NOT NULL THEN c.id END) AS enrolled_courses,
        GROUP_CONCAT(DISTINCT c.difficulty) AS difficulty_levels,
        MAX(c.updated_at) AS last_course_update,
        MAX(c.thumbnail_url) AS sample_thumbnail
      FROM categories cat
      LEFT JOIN courses c ON c.category_id = cat.id
      LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = ?
      ${whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      GROUP BY cat.id
      ORDER BY cat.name ASC
    `;

    const [rows] = await pool.execute(query, params);

    const formattedCategories = rows.map((row) => {
      const rawLevels = row.difficulty_levels
        ? row.difficulty_levels
            .split(',')
            .map((item) => (item || '').trim())
            .filter((value) => value)
        : [];

      const uniqueLevels = Array.from(new Set(rawLevels));

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        icon: row.icon,
        isActive: Boolean(row.is_active),
        metrics: {
          totalCourses: Number(row.total_courses || 0),
          publishedCourses: Number(row.published_courses || 0),
          draftCourses: Number(row.draft_courses || 0),
          enrolledCourses: Number(row.enrolled_courses || 0)
        },
        levels: uniqueLevels,
        lastCourseUpdate: row.last_course_update,
        sampleThumbnail: row.sample_thumbnail ? buildMediaUrl(row.sample_thumbnail) : null
      };
    });

    const availableLevels = Array.from(
      new Set(
        formattedCategories.flatMap((category) => category.levels)
      )
    );
    const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
    availableLevels.sort((a, b) => {
      const indexA = levelOrder.indexOf(a);
      const indexB = levelOrder.indexOf(b);

      if (indexA === -1 && indexB === -1) {
        return a.localeCompare(b);
      }

      if (indexA === -1) {
        return 1;
      }

      if (indexB === -1) {
        return -1;
      }

      return indexA - indexB;
    });

    let filteredCategories = formattedCategories;

    if (onlyEnrolled === 'true') {
      filteredCategories = filteredCategories.filter(
        (category) => category.metrics.enrolledCourses > 0
      );
    }

    if (normalizedLevel) {
      filteredCategories = filteredCategories.filter((category) =>
        category.levels.includes(normalizedLevel)
      );
    }

    res.json({
      success: true,
      data: {
        categories: filteredCategories,
        meta: {
          total: filteredCategories.length,
          activeCount: filteredCategories.filter((category) => category.isActive).length,
          enrolledCount: filteredCategories.filter(
            (category) => category.metrics.enrolledCourses > 0
          ).length,
          availableLevels,
          appliedFilters: {
            search,
            status,
            onlyEnrolled: onlyEnrolled === 'true',
            level: normalizedLevel || null
          }
        }
      }
    });
  } catch (error) {
    console.error('Erreur catalogue étudiant:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer le catalogue des catégories'
    });
  }
};

const DEFAULT_PREFERENCES = {
  language: 'fr',
  theme: 'light',
  policies: {
    accepted: false,
    accepted_at: null,
    version: '1.0',
  },
};

const ensurePreferencesTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS student_preferences (
      user_id INT NOT NULL PRIMARY KEY,
      preferences JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

const loadPreferencesForUser = async (userId) => {
  await ensurePreferencesTable();
  const [rows] = await pool.execute(
    'SELECT preferences FROM student_preferences WHERE user_id = ? LIMIT 1',
    [userId]
  );

  if (!rows.length) {
    return { ...DEFAULT_PREFERENCES };
  }

  try {
    const parsed = JSON.parse(rows[0].preferences);
    return {
      ...DEFAULT_PREFERENCES,
      ...(parsed || {}),
      policies: {
        ...DEFAULT_PREFERENCES.policies,
        ...(parsed?.policies || {}),
      },
    };
  } catch (error) {
    return { ...DEFAULT_PREFERENCES };
  }
};

const savePreferencesForUser = async (userId, preferences) => {
  await ensurePreferencesTable();
  await pool.execute(
    `INSERT INTO student_preferences (user_id, preferences)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE preferences = VALUES(preferences)`,
    [userId, JSON.stringify(preferences)]
  );
};

const getSettings = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
    return;
  }

  const preferences = await loadPreferencesForUser(studentId);

  res.json({
    success: true,
    data: {
      sections: [
        {
          key: 'profile',
          title: 'Profil étudiant',
          description: 'Gérez vos informations personnelles et votre photo de profil.',
          action_url: '/dashboard/student/profile',
          is_available: true,
        },
        {
          key: 'notifications',
          title: 'Notifications',
          description: 'Fonctionnalité en développement.',
          is_available: false,
        },
        {
          key: 'privacy',
          title: 'Confidentialité',
          description: 'Fonctionnalité en développement.',
          is_available: false,
        },
        {
          key: 'appearance',
          title: 'Apparence',
          description: 'Fonctionnalité en développement.',
          is_available: false,
        },
      ],
      preferences,
    },
  });
};

const updateSettings = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
    return;
  }

  const currentPreferences = await loadPreferencesForUser(studentId);
  const incoming = req.body?.preferences ?? {};
  const preferences = {
    ...currentPreferences,
    ...incoming,
    policies: {
      ...currentPreferences.policies,
      ...(incoming?.policies ?? {}),
    },
  };

  await savePreferencesForUser(studentId, preferences);

  res.json({
    success: true,
    message: 'Vos préférences ont bien été enregistrées.',
    data: {
      preferences,
    },
  });
};

const updateSettingsPolicies = async (req, res) => {
  const studentId = ensureStudent(req, res);
  if (!studentId) {
    return;
  }

  const currentPreferences = await loadPreferencesForUser(studentId);
  const version = req.body?.version || currentPreferences.policies.version || DEFAULT_PREFERENCES.policies.version;
  const preferences = {
    ...currentPreferences,
    policies: {
      ...currentPreferences.policies,
      accepted: true,
      accepted_at: new Date().toISOString(),
      version,
    },
  };

  await savePreferencesForUser(studentId, preferences);

  res.json({
    success: true,
    message: 'Merci, vos préférences de confidentialité ont été mises à jour.',
    data: {
      preferences,
    },
  });
};

module.exports = {
  getCourses,
  getCourseProgress,
  getStats,
  getRecentActivity,
  getBadges,
  getCertificates,
  getActivities,
  getCatalogCategories,
  getSettings,
  updateSettings,
  updateSettingsPolicies
};

                                                                                                                                                                                      