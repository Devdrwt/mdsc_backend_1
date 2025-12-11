const { pool } = require('../config/database');
const { sanitizeValue, convertToMySQLDateTime } = require('../utils/sanitize');
const { buildMediaUrl, formatInstructorMetadata } = require('../utils/media');
const { v4: uuidv4 } = require('uuid');
const ModuleService = require('../services/moduleService');
const JitsiService = require('../services/jitsiService');

/**
 * Créer automatiquement une session live pour un cours
 * @param {number} courseId - ID du cours
 * @param {number} instructorId - ID de l'instructeur
 * @param {string} courseTitle - Titre du cours
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 * @param {number} maxParticipants - Nombre max de participants
 * @returns {Promise<Object|null>} - Session créée ou null en cas d'erreur
 */
const createAutoLiveSession = async (courseId, instructorId, courseTitle, startDate, endDate, maxParticipants) => {
  try {
    // Vérifier si une session existe déjà pour ce cours
    const [existingSessions] = await pool.execute(
      'SELECT id FROM live_sessions WHERE course_id = ? LIMIT 1',
      [courseId]
    );

    if (existingSessions.length > 0) {
      console.log(`⚠️ Une session live existe déjà pour le cours ${courseId}`);
      return null;
    }

    // Générer le nom de salle Jitsi (temporaire, sera mis à jour avec l'ID de session)
    const tempSessionId = Date.now();
    const jitsiRoomName = JitsiService.generateRoomName(courseId, tempSessionId);
    const jitsiRoomPassword = JitsiService.generateRoomPassword();

    // Créer la session avec le titre par défaut
    const sessionTitle = `Session principale - ${courseTitle}`;
    
    const [result] = await pool.execute(
      `INSERT INTO live_sessions (
        course_id, instructor_id, title, description,
        scheduled_start_at, scheduled_end_at,
        jitsi_room_name, jitsi_server_url, jitsi_room_password,
        max_participants, is_recording_enabled, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
      [
        courseId,
        instructorId,
        sanitizeValue(sessionTitle),
        sanitizeValue(`Session principale pour le cours "${courseTitle}"`),
        convertToMySQLDateTime(startDate),
        convertToMySQLDateTime(endDate),
        jitsiRoomName,
        process.env.JITSI_SERVER_URL || 'https://meet.jit.si',
        jitsiRoomPassword,
        maxParticipants || 50,
        1 // Enregistrement activé par défaut
      ]
    );

    const sessionId = result.insertId;

    // Mettre à jour le nom de salle avec le vrai sessionId
    const finalRoomName = JitsiService.generateRoomName(courseId, sessionId);
    await pool.execute(
      'UPDATE live_sessions SET jitsi_room_name = ? WHERE id = ?',
      [finalRoomName, sessionId]
    );

    // Récupérer la session créée
    const [sessions] = await pool.execute(
      'SELECT * FROM live_sessions WHERE id = ?',
      [sessionId]
    );

    console.log(`✅ Session live créée automatiquement pour le cours ${courseId} (session ID: ${sessionId})`);
    return sessions[0] || null;

  } catch (error) {
    console.error('❌ Erreur lors de la création automatique de la session live:', error);
    // Ne pas faire échouer la création du cours si la session échoue
    return null;
  }
};

const formatCourseRow = (row = {}) => {
  if (!row) {
    return null;
  }

  const categoryId = row.category_id ?? row.categoryId ?? null;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    short_description: row.short_description,
    thumbnail_url: buildMediaUrl(row.thumbnail_url),
    video_url: buildMediaUrl(row.video_url),
    language: row.language,
    duration_minutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    price: row.price != null ? Number(row.price) : null,
    currency: row.currency,
    status: row.status || (row.is_published ? 'published' : 'draft'),
    is_published: Boolean(row.is_published),
    is_featured: Boolean(row.is_featured),
    course_type: row.course_type,
    max_students: row.max_students != null ? Number(row.max_students) : null,
    enrollment_deadline: row.enrollment_deadline,
    course_start_date: row.course_start_date,
    course_end_date: row.course_end_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: categoryId
      ? {
          id: categoryId,
          name: row.category_name || row.categoryName || null,
          color: row.category_color || row.categoryColor || null
        }
      : null,
    instructor: formatInstructorMetadata({
      id: row.instructor_id,
      first_name: row.instructor_first_name,
      last_name: row.instructor_last_name,
      email: row.instructor_email,
      organization: row.instructor_organization,
      profile_picture: row.instructor_profile_picture
    }),
    prerequisite: row.prerequisite_id || row.prerequisite_course_id
      ? {
          id: row.prerequisite_id || row.prerequisite_course_id,
          title: row.prerequisite_title || row.prerequisiteTitle || null
        }
      : null,
    metrics: {
      average_rating: Number(row.average_rating || 0),
      review_count: Number(row.review_count || 0),
      enrollment_count: Number(row.enrollment_count || 0),
      total_lessons: Number(row.total_lessons || 0),
      total_views: Number(row.total_views || 0)
    },
    average_rating: Number(row.average_rating || 0),
    review_count: Number(row.review_count || 0),
    enrollment_count: Number(row.enrollment_count || 0),
    total_lessons: Number(row.total_lessons || 0),
    total_views: Number(row.total_views || 0)
  };
};

// Récupérer tous les cours (avec pagination et filtres)
const getAllCourses = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      language = 'fr',
      search,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = `WHERE c.is_published = TRUE 
      AND (COALESCE(c.status, 'draft') = 'approved' OR COALESCE(c.status, 'draft') = 'published') 
      AND COALESCE(c.status, 'draft') != 'draft'`;
    let params = [];

    // Filtres
    if (category) {
      whereClause += ' AND c.category_id = ?';
      params.push(category);
    }

    if (language) {
      whereClause += ' AND c.language = ?';
      params.push(language);
    }

    if (search) {
      whereClause += ' AND (c.title LIKE ? OR c.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Requête principale
    const query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        u.organization as instructor_organization,
        COALESCE(
          CONCAT('/uploads/profiles/', uf.file_name),
          u.profile_picture
        ) as instructor_profile_picture,
        AVG(cr.rating) as average_rating,
        COUNT(DISTINCT cr.id) as review_count,
        COUNT(DISTINCT e.id) as enrollment_count,
        COALESCE(lesson_counts.total_lessons, 0) as total_lessons,
        COALESCE(ca.total_views, 0) as total_views
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT uf1.user_id, uf1.file_name
        FROM user_files uf1
        INNER JOIN (
          SELECT user_id, MAX(created_at) as max_created_at
          FROM user_files
          WHERE file_type = 'profile_picture'
          GROUP BY user_id
        ) uf2 ON uf1.user_id = uf2.user_id 
          AND uf1.created_at = uf2.max_created_at
          AND uf1.file_type = 'profile_picture'
      ) uf ON uf.user_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_active = TRUE
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      LEFT JOIN (
        SELECT 
          m.course_id,
          COUNT(DISTINCT l.id) as total_lessons
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
        GROUP BY m.course_id
      ) lesson_counts ON lesson_counts.course_id = c.id
      ${whereClause}
      GROUP BY c.id, lesson_counts.total_lessons
      ORDER BY c.${sort} ${order}
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));

    const [courses] = await pool.execute(query, params);

    // Compter le total pour la pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM courses c
      ${whereClause}
    `;
    const [countResult] = await pool.execute(countQuery, params.slice(0, -2));
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        courses: courses.map(formatCourseRow),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des cours:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cours'
    });
  }
};

// Récupérer un cours par ID
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const userRole = req.user?.role;

    // Vérifier d'abord si le cours existe et récupérer ses informations de base
    const [courseExists] = await pool.execute(
      'SELECT id, instructor_id, is_published, status FROM courses WHERE id = ?', 
      [id]
    );
    
    if (courseExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }
    
    const courseInfo = courseExists[0];
    
    // Extraire l'ID utilisateur du token (peut être 'id' ou 'userId')
    const tokenUserId = req.user?.id || req.user?.userId;
    const courseInstructorId = parseInt(courseInfo.instructor_id);
    const isInstructor = tokenUserId && parseInt(tokenUserId) === courseInstructorId;
    const isAdmin = userRole === 'admin';
    
    // Log pour débogage
    console.log('🔍 Course access check:', {
      courseId: id,
      courseInstructorId,
      tokenUserId,
      parsedTokenUserId: tokenUserId ? parseInt(tokenUserId) : null,
      isInstructor,
      isAdmin,
      isPublished: courseInfo.is_published,
      status: courseInfo.status,
      userRole
    });
    
    // Vérifier les permissions : si non publié, en brouillon ou non approuvé, seul l'instructeur ou admin peut le voir
    const courseStatus = courseInfo.status || 'draft'; // Si NULL, considérer comme draft
    const isDraft = courseStatus === 'draft';
    const isApproved = courseStatus === 'approved' || courseStatus === 'published';
    if ((!courseInfo.is_published || isDraft || !isApproved) && !isInstructor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Ce cours n\'est pas disponible'
      });
    }

    // Construire la requête principale
    let query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        u.organization as instructor_organization,
        COALESCE(
          CONCAT('/uploads/profiles/', uf.file_name),
          u.profile_picture
        ) as instructor_profile_picture,
        stats.average_rating,
        stats.review_count,
        stats.enrollment_count,
        COALESCE(lesson_counts.total_lessons, 0) as total_lessons,
        COALESCE(ca.total_views, 0) as total_views
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT uf1.user_id, uf1.file_name
        FROM user_files uf1
        INNER JOIN (
          SELECT user_id, MAX(created_at) as max_created_at
          FROM user_files
          WHERE file_type = 'profile_picture'
          GROUP BY user_id
        ) uf2 ON uf1.user_id = uf2.user_id 
          AND uf1.created_at = uf2.max_created_at
          AND uf1.file_type = 'profile_picture'
      ) uf ON uf.user_id = u.id
      LEFT JOIN (
        SELECT 
          c.id AS course_id,
          AVG(cr.rating) AS average_rating,
          COUNT(DISTINCT cr.id) AS review_count,
          COUNT(DISTINCT e.id) AS enrollment_count
        FROM courses c
        LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_active = TRUE
        WHERE c.id = ?
      ) stats ON stats.course_id = c.id
      LEFT JOIN (
        SELECT 
          m.course_id,
          COUNT(DISTINCT l.id) as total_lessons
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
        WHERE m.course_id = ?
        GROUP BY m.course_id
      ) lesson_counts ON lesson_counts.course_id = c.id
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      WHERE c.id = ?
    `;
    
    // Si l'utilisateur n'est pas l'instructeur/admin, ne montrer que les cours publiés, approuvés et non en brouillon
    if (!isInstructor && !isAdmin) {
      query += ` AND c.is_published = TRUE 
        AND (COALESCE(c.status, 'draft') = 'approved' OR COALESCE(c.status, 'draft') = 'published') 
        AND COALESCE(c.status, 'draft') != 'draft'`;
    }
    
    query += ' GROUP BY c.id, lesson_counts.total_lessons';

    const [courses] = await pool.execute(query, [id, id, id]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = formatCourseRow(courses[0]);

    // Récupérer les modules du cours avec leurs quiz et leçons
    const modulesQuery = `
      SELECT 
        m.*, 
        COUNT(DISTINCT l.id) as lessons_count,
        MAX(mq.id) as quiz_id,
        MAX(mq.title) as quiz_title,
        MAX(mq.description) as quiz_description,
        MAX(mq.passing_score) as quiz_passing_score,
        MAX(mq.time_limit_minutes) as quiz_time_limit_minutes,
        MAX(mq.max_attempts) as quiz_max_attempts,
        MAX(mq.is_published) as quiz_is_published
      FROM modules m
      LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
      LEFT JOIN module_quizzes mq ON m.id = mq.module_id AND mq.is_published = TRUE
      WHERE m.course_id = ?
      GROUP BY m.id
      ORDER BY m.order_index ASC
    `;
    const [modules] = await pool.execute(modulesQuery, [id]);

    // Pour chaque module, récupérer ses leçons avec toutes les informations nécessaires
    // Format exact comme dans moduleService.js pour respecter la logique d'ajout
    const modulesWithLessons = await Promise.all(
      modules.map(async (module) => {
        const lessonsQuery = `
          SELECT 
            l.*,
            mf.url as media_url,
            mf.thumbnail_url,
            mf.file_category,
            mf.filename,
            mf.original_filename,
            mf.file_size,
            mf.file_type,
            mf.id as media_file_id_from_join
          FROM lessons l
          LEFT JOIN media_files mf ON (
            l.media_file_id = mf.id 
            OR (l.id = mf.lesson_id AND l.media_file_id IS NULL)
          )
          WHERE l.module_id = ? AND l.is_published = TRUE
          ORDER BY l.order_index ASC, mf.uploaded_at DESC
        `;
        const [lessons] = await pool.execute(lessonsQuery, [module.id]);
        
        // Formater le module avec ses leçons et le quiz (format exact comme lors de la création)
        return {
          ...module,
          lessons: lessons || [],
          quiz: module.quiz_id ? {
            id: module.quiz_id,
            title: module.quiz_title,
            description: module.quiz_description,
            passing_score: module.quiz_passing_score,
            time_limit_minutes: module.quiz_time_limit_minutes,
            max_attempts: module.quiz_max_attempts,
            is_published: module.quiz_is_published
          } : null
        };
      })
    );

    // Récupérer les quiz du cours (anciens quiz, pas les module_quizzes)
    const quizzesQuery = `
      SELECT * FROM quizzes 
      WHERE course_id = ? AND is_published = TRUE
    `;
    const [quizzes] = await pool.execute(quizzesQuery, [id]);

    res.json({
      success: true,
      data: {
        course,
        modules: modulesWithLessons,
        quizzes
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du cours:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du cours'
    });
  }
};

// Créer un nouveau cours
const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      short_description,
      category_id,
      thumbnail_url,
      video_url,
      duration_minutes,
      language,
      price,
      currency,
      max_students,
      enrollment_deadline,
      course_start_date,
      course_end_date,
      course_type = 'on_demand', // NOUVEAU
      is_sequential = true // NOUVEAU
    } = req.body;

    const instructor_id = req.user?.id ?? req.user?.userId;

    // Vérifier que la catégorie existe si category_id est fourni
    if (category_id !== null && category_id !== undefined && category_id !== '') {
      const [categories] = await pool.execute(
        'SELECT id FROM categories WHERE id = ?',
        [category_id]
      );

      if (categories.length === 0) {
        return res.status(400).json({
          success: false,
          message: `La catégorie avec l'ID ${category_id} n'existe pas. Catégories disponibles: 15, 16, 17, 18, 19`
        });
      }
    }

    // Validation conditionnelle selon le type
    if (course_type === 'live') {
      if (!course_start_date || !course_end_date) {
        return res.status(400).json({
          success: false,
          message: 'Les dates de début et fin sont obligatoires pour un cours Live'
        });
      }

      if (new Date(course_start_date) >= new Date(course_end_date)) {
        return res.status(400).json({
          success: false,
          message: 'La date de fin doit être après la date de début'
        });
      }

      if (!max_students || max_students <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Le nombre maximum d\'étudiants est obligatoire pour un cours Live'
        });
      }
    }

    const query = `
      INSERT INTO courses (
        title, description, short_description, instructor_id, category_id,
        thumbnail_url, video_url, duration_minutes, language,
        price, currency, max_students, enrollment_deadline, course_start_date, course_end_date,
        course_type, is_sequential, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `;

    const [result] = await pool.execute(query, [
      sanitizeValue(title),
      sanitizeValue(description),
      sanitizeValue(short_description),
      sanitizeValue(instructor_id),
      sanitizeValue(category_id),
      sanitizeValue(thumbnail_url),
      sanitizeValue(video_url),
      sanitizeValue(duration_minutes),
      sanitizeValue(language),
      sanitizeValue(price),
      sanitizeValue(currency),
      sanitizeValue(course_type === 'live' ? max_students : null),
      convertToMySQLDateTime(enrollment_deadline),
      convertToMySQLDateTime(course_type === 'live' ? course_start_date : null),
      convertToMySQLDateTime(course_type === 'live' ? course_end_date : null),
      sanitizeValue(course_type),
      sanitizeValue(is_sequential)
    ]);

    const courseId = result.insertId;

    // Si c'est un cours live, créer automatiquement une session Jitsi
    let liveSession = null;
    if (course_type === 'live' && course_start_date && course_end_date) {
      console.log(`🔄 [Course Create] Création automatique de la session Jitsi pour le cours live ${courseId}...`);
      liveSession = await createAutoLiveSession(
        courseId,
        instructor_id,
        title,
        course_start_date,
        course_end_date,
        max_students
      );
      
      if (liveSession) {
        console.log(`✅ [Course Create] Session Jitsi créée automatiquement (ID: ${liveSession.id}) pour le cours ${courseId}`);
      } else {
        console.log(`⚠️ [Course Create] Échec de la création automatique de la session pour le cours ${courseId}`);
      }
    }

    // Préparer la réponse avec toutes les informations de la session
    const responseData = {
      course_id: courseId
    };

    // Si une session a été créée automatiquement, inclure toutes les informations
    if (liveSession) {
      responseData.live_session = {
        id: liveSession.id,
        title: liveSession.title,
        description: liveSession.description,
        scheduled_start_at: liveSession.scheduled_start_at,
        scheduled_end_at: liveSession.scheduled_end_at,
        jitsi_room_name: liveSession.jitsi_room_name,
        jitsi_server_url: liveSession.jitsi_server_url,
        max_participants: liveSession.max_participants,
        is_recording_enabled: liveSession.is_recording_enabled === 1 || liveSession.is_recording_enabled === true,
        status: liveSession.status,
        created_at: liveSession.created_at
      };
      responseData.session_created_automatically = true;
    } else if (course_type === 'live') {
      // Si c'est un cours live mais qu'aucune session n'a été créée
      responseData.live_session = null;
      responseData.session_created_automatically = false;
      responseData.session_creation_message = 'La session n\'a pas pu être créée automatiquement. Veuillez la créer manuellement.';
    }

    res.status(201).json({
      success: true,
      message: liveSession 
        ? 'Cours créé avec succès. Session Jitsi créée automatiquement.' 
        : 'Cours créé avec succès',
      data: responseData
    });

  } catch (error) {
    console.error('Erreur lors de la création du cours:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du cours'
    });
  }
};

// Mettre à jour un cours
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const userRole = req.user?.role;

    // Vérifier que l'utilisateur est l'instructeur ou un admin
    const checkQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(checkQuery, [id]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (parseInt(courses[0].instructor_id) !== parseInt(userId) && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier ce cours'
      });
    }

    const updateFields = [];
    const values = [];

    // Construire dynamiquement la requête de mise à jour
    const allowedFields = [
      'title', 'description', 'short_description', 'category_id',
      'thumbnail_url', 'video_url', 'duration_minutes',
      'language', 'price', 'currency', 'max_students',
      'enrollment_deadline', 'course_start_date', 'course_end_date',
      'is_published', 'is_featured', 'course_type', 'is_sequential' // NOUVEAU
    ];

    // Validation conditionnelle si course_type est modifié
    if (req.body.course_type === 'live') {
      const courseStartDate = req.body.course_start_date || courses[0].course_start_date;
      const courseEndDate = req.body.course_end_date || courses[0].course_end_date;
      const maxStudents = req.body.max_students || courses[0].max_students;

      if (!courseStartDate || !courseEndDate) {
        return res.status(400).json({
          success: false,
          message: 'Les dates de début et fin sont obligatoires pour un cours Live'
        });
      }

      if (new Date(courseStartDate) >= new Date(courseEndDate)) {
        return res.status(400).json({
          success: false,
          message: 'La date de fin doit être après la date de début'
        });
      }

      if (!maxStudents || maxStudents <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Le nombre maximum d\'étudiants est obligatoire pour un cours Live'
        });
      }
    }

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        // Convertir les dates au format MySQL
        if (field === 'enrollment_deadline' || field === 'course_start_date' || field === 'course_end_date') {
          values.push(convertToMySQLDateTime(req.body[field]));
        } else {
          values.push(sanitizeValue(req.body[field]));
        }
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun champ à mettre à jour'
      });
    }

    values.push(id);
    const query = `UPDATE courses SET ${updateFields.join(', ')} WHERE id = ?`;

    await pool.execute(query, values);

    // Récupérer les données du cours mis à jour pour vérifier si on doit créer une session
    const [updatedCourses] = await pool.execute(
      'SELECT id, title, course_type, course_start_date, course_end_date, max_students, instructor_id FROM courses WHERE id = ?',
      [id]
    );

    const updatedCourse = updatedCourses[0];

    // Si le cours est maintenant un cours live, vérifier si une session existe
    let liveSession = null;
    if (updatedCourse && updatedCourse.course_type === 'live' && 
        updatedCourse.course_start_date && updatedCourse.course_end_date) {
      
      // Vérifier si une session existe déjà
      const [existingSessions] = await pool.execute(
        'SELECT * FROM live_sessions WHERE course_id = ? ORDER BY created_at DESC LIMIT 1',
        [id]
      );

      if (existingSessions.length > 0) {
        // Une session existe déjà, la retourner
        liveSession = existingSessions[0];
        console.log(`ℹ️ [Course Update] Session existante trouvée pour le cours ${id} (session ID: ${liveSession.id})`);
      } else {
        // Si aucune session n'existe, créer automatiquement une session
        console.log(`🔄 [Course Update] Création automatique de la session Jitsi pour le cours live ${id}...`);
        liveSession = await createAutoLiveSession(
          id,
          updatedCourse.instructor_id,
          updatedCourse.title,
          updatedCourse.course_start_date,
          updatedCourse.course_end_date,
          updatedCourse.max_students
        );

        if (liveSession) {
          console.log(`✅ [Course Update] Session live créée automatiquement lors de la mise à jour du cours ${id} (session ID: ${liveSession.id})`);
        }
      }
    }

    // Préparer la réponse
    const responseData = {
      course_id: id
    };

    // Si une session existe ou a été créée, inclure ses informations
    if (liveSession) {
      responseData.live_session = {
        id: liveSession.id,
        title: liveSession.title,
        description: liveSession.description,
        scheduled_start_at: liveSession.scheduled_start_at,
        scheduled_end_at: liveSession.scheduled_end_at,
        jitsi_room_name: liveSession.jitsi_room_name,
        jitsi_server_url: liveSession.jitsi_server_url,
        max_participants: liveSession.max_participants,
        is_recording_enabled: liveSession.is_recording_enabled === 1 || liveSession.is_recording_enabled === true,
        status: liveSession.status,
        created_at: liveSession.created_at
      };
    }

    res.json({
      success: true,
      message: liveSession 
        ? 'Cours mis à jour avec succès. Session Jitsi disponible.' 
        : 'Cours mis à jour avec succès',
      data: responseData
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du cours:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du cours'
    });
  }
};

// Supprimer un cours
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const userRole = req.user?.role;

    // Vérifier les permissions
    const checkQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(checkQuery, [id]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (parseInt(courses[0].instructor_id) !== parseInt(userId) && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à supprimer ce cours'
      });
    }

    await pool.execute('DELETE FROM courses WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Cours supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du cours:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du cours'
    });
  }
};

// Ajouter une leçon
const addLesson = async (req, res) => {
  try {
    const courseId = req.params.id || req.params.courseId; // Support both :id and :courseId routes
    const { 
      title, 
      description, 
      content, 
      content_text,
      content_url,
      video_url, 
      duration_minutes, 
      duration,
      module_id,
      content_type = 'text',
      media_file_id,
      order_index,
      order,
      is_required = true,
      is_published
    } = req.body;
    const userId = req.user?.id ?? req.user?.userId;

    // Vérifier que l'utilisateur est l'instructeur du cours
    const checkQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(checkQuery, [sanitizeValue(courseId)]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (parseInt(courses[0].instructor_id) !== parseInt(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à ajouter une leçon à ce cours'
      });
    }

    // Utiliser duration si fourni, sinon duration_minutes
    const finalDuration = duration_minutes || duration || 0;
    // Utiliser order_index si fourni, sinon order, sinon calculer
    let finalOrderIndex = order_index || order;

    // Récupérer le prochain index (par module si module_id fourni, sinon par cours)
    let orderQuery, nextOrder;
    if (!finalOrderIndex) {
      if (module_id) {
        orderQuery = 'SELECT MAX(order_index) as max_order FROM lessons WHERE module_id = ?';
        const [orderResult] = await pool.execute(orderQuery, [sanitizeValue(module_id)]);
        nextOrder = (orderResult[0]?.max_order || 0) + 1;
      } else {
        orderQuery = 'SELECT MAX(order_index) as max_order FROM lessons WHERE course_id = ? AND (module_id IS NULL OR module_id = 0)';
        const [orderResult] = await pool.execute(orderQuery, [sanitizeValue(courseId)]);
        nextOrder = (orderResult[0]?.max_order || 0) + 1;
      }
      finalOrderIndex = nextOrder;
    }

    const published = typeof is_published === 'boolean' ? is_published : true;

    const query = `
      INSERT INTO lessons (
        course_id, module_id, title, description, content, content_text, content_url,
        video_url, duration_minutes, order_index, content_type, media_file_id,
        is_required, is_published
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(query, [
      sanitizeValue(courseId),
      sanitizeValue(module_id) || null,
      sanitizeValue(title),
      sanitizeValue(description) || '',
      sanitizeValue(content) || null,
      sanitizeValue(content_text) || null,
      sanitizeValue(content_url) || null,
      sanitizeValue(video_url) || null,
      sanitizeValue(finalDuration),
      sanitizeValue(finalOrderIndex),
      sanitizeValue(content_type),
      sanitizeValue(media_file_id) || null,
      sanitizeValue(is_required) !== false,
      sanitizeValue(published) === true
    ]);

    const newLessonId = result.insertId;

    // Si un media_file_id a été assigné, mettre à jour automatiquement le lesson_id du fichier média
    if (media_file_id) {
      await pool.execute(
        'UPDATE media_files SET lesson_id = ? WHERE id = ? AND course_id = ?',
        [newLessonId, media_file_id, courseId]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Leçon ajoutée avec succès',
      data: {
        lesson_id: newLessonId
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'ajout de la leçon:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de la leçon'
    });
  }
};

// Récupérer les cours par catégorie
const getCoursesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        u.organization as instructor_organization,
        COALESCE(
          CONCAT('/uploads/profiles/', uf.file_name),
          u.profile_picture
        ) as instructor_profile_picture,
        AVG(cr.rating) as average_rating,
        COUNT(DISTINCT cr.id) as review_count,
        COUNT(DISTINCT e.id) as enrollment_count,
        COALESCE(lesson_counts.total_lessons, 0) as total_lessons,
        COALESCE(ca.total_views, 0) as total_views
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT uf1.user_id, uf1.file_name
        FROM user_files uf1
        INNER JOIN (
          SELECT user_id, MAX(created_at) as max_created_at
          FROM user_files
          WHERE file_type = 'profile_picture'
          GROUP BY user_id
        ) uf2 ON uf1.user_id = uf2.user_id 
          AND uf1.created_at = uf2.max_created_at
          AND uf1.file_type = 'profile_picture'
      ) uf ON uf.user_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_active = TRUE
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      LEFT JOIN (
        SELECT 
          m.course_id,
          COUNT(DISTINCT l.id) as total_lessons
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
        GROUP BY m.course_id
      ) lesson_counts ON lesson_counts.course_id = c.id
      WHERE c.is_published = TRUE 
        AND (COALESCE(c.status, 'draft') = 'approved' OR COALESCE(c.status, 'draft') = 'published') 
        AND COALESCE(c.status, 'draft') != 'draft' 
        AND c.category_id = ?
      GROUP BY c.id, lesson_counts.total_lessons
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [courses] = await pool.execute(query, [categoryId, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: courses.map(formatCourseRow)
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des cours par catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cours par catégorie'
    });
  }
};

// Rechercher des cours
const searchCourses = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Terme de recherche requis'
      });
    }

    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        u.organization as instructor_organization,
        COALESCE(
          CONCAT('/uploads/profiles/', uf.file_name),
          u.profile_picture
        ) as instructor_profile_picture,
        AVG(cr.rating) as average_rating,
        COUNT(DISTINCT cr.id) as review_count,
        COUNT(DISTINCT e.id) as enrollment_count,
        COALESCE(lesson_counts.total_lessons, 0) as total_lessons,
        COALESCE(ca.total_views, 0) as total_views
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT uf1.user_id, uf1.file_name
        FROM user_files uf1
        INNER JOIN (
          SELECT user_id, MAX(created_at) as max_created_at
          FROM user_files
          WHERE file_type = 'profile_picture'
          GROUP BY user_id
        ) uf2 ON uf1.user_id = uf2.user_id 
          AND uf1.created_at = uf2.max_created_at
          AND uf1.file_type = 'profile_picture'
      ) uf ON uf.user_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_active = TRUE
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      LEFT JOIN (
        SELECT 
          m.course_id,
          COUNT(DISTINCT l.id) as total_lessons
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
        GROUP BY m.course_id
      ) lesson_counts ON lesson_counts.course_id = c.id
      WHERE c.is_published = TRUE 
        AND (COALESCE(c.status, 'draft') = 'approved' OR COALESCE(c.status, 'draft') = 'published') 
        AND COALESCE(c.status, 'draft') != 'draft'
        AND (c.title LIKE ? OR c.description LIKE ? OR c.short_description LIKE ?)
      GROUP BY c.id, lesson_counts.total_lessons
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const searchTerm = `%${q}%`;
    const [courses] = await pool.execute(query, [searchTerm, searchTerm, searchTerm, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: courses.map(formatCourseRow)
    });

  } catch (error) {
    console.error('Erreur lors de la recherche de cours:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de cours'
    });
  }
};

// Récupérer les cours mis en avant
const getFeaturedCourses = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        u.organization as instructor_organization,
        COALESCE(
          CONCAT('/uploads/profiles/', uf.file_name),
          u.profile_picture
        ) as instructor_profile_picture,
        AVG(cr.rating) as average_rating,
        COUNT(DISTINCT cr.id) as review_count,
        COUNT(DISTINCT e.id) as enrollment_count,
        COALESCE(lesson_counts.total_lessons, 0) as total_lessons,
        COALESCE(ca.total_views, 0) as total_views
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT uf1.user_id, uf1.file_name
        FROM user_files uf1
        INNER JOIN (
          SELECT user_id, MAX(created_at) as max_created_at
          FROM user_files
          WHERE file_type = 'profile_picture'
          GROUP BY user_id
        ) uf2 ON uf1.user_id = uf2.user_id 
          AND uf1.created_at = uf2.max_created_at
          AND uf1.file_type = 'profile_picture'
      ) uf ON uf.user_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_active = TRUE
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      LEFT JOIN (
        SELECT 
          m.course_id,
          COUNT(DISTINCT l.id) as total_lessons
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
        GROUP BY m.course_id
      ) lesson_counts ON lesson_counts.course_id = c.id
      WHERE c.is_published = TRUE 
        AND (COALESCE(c.status, 'draft') = 'approved' OR COALESCE(c.status, 'draft') = 'published') 
        AND COALESCE(c.status, 'draft') != 'draft' 
        AND c.is_featured = TRUE
      GROUP BY c.id, lesson_counts.total_lessons
      ORDER BY c.created_at DESC
      LIMIT ?
    `;

    const [courses] = await pool.execute(query, [parseInt(limit)]);

    res.json({
      success: true,
      data: courses.map(formatCourseRow)
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des cours mis en avant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cours mis en avant'
    });
  }
};

// Mettre à jour une leçon
const updateLesson = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.params.id; // Support both :id and :courseId routes
    const { lessonId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { title, description, content, video_url, duration_minutes, order_index, module_id } = req.body;

    // Vérifier que l'utilisateur est l'instructeur du cours
    const checkQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(checkQuery, [sanitizeValue(courseId)]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (parseInt(courses[0].instructor_id) !== parseInt(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à modifier cette leçon'
      });
    }

    // Vérifier que la leçon appartient au cours
    const lessonQuery = 'SELECT id FROM lessons WHERE id = ? AND course_id = ?';
    const [lessons] = await pool.execute(lessonQuery, [lessonId, courseId]);

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leçon non trouvée dans ce cours'
      });
    }

    // Mettre à jour la leçon
    const updateFields = [];
    const values = [];

    if (module_id !== undefined) {
      updateFields.push('module_id = ?');
      values.push(module_id);
    }
    if (title !== undefined) {
      updateFields.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      values.push(description);
    }
    if (content !== undefined) {
      updateFields.push('content = ?');
      values.push(content);
    }
    if (video_url !== undefined) {
      updateFields.push('video_url = ?');
      values.push(video_url);
    }
    if (duration_minutes !== undefined) {
      updateFields.push('duration_minutes = ?');
      values.push(duration_minutes);
    }
    if (order_index !== undefined) {
      updateFields.push('order_index = ?');
      values.push(order_index);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun champ à mettre à jour'
      });
    }

    values.push(lessonId);
    const query = `UPDATE lessons SET ${updateFields.join(', ')} WHERE id = ?`;

    await pool.execute(query, values);

    res.json({
      success: true,
      message: 'Leçon mise à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la leçon:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la leçon'
    });
  }
};

// Supprimer une leçon
const deleteLesson = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.params.id; // Support both :id and :courseId routes
    const { lessonId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    // Vérifier que l'utilisateur est l'instructeur du cours
    const checkQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(checkQuery, [sanitizeValue(courseId)]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (parseInt(courses[0].instructor_id) !== parseInt(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à supprimer cette leçon'
      });
    }

    // Vérifier que la leçon appartient au cours
    const lessonQuery = 'SELECT id FROM lessons WHERE id = ? AND course_id = ?';
    const [lessons] = await pool.execute(lessonQuery, [lessonId, courseId]);

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leçon non trouvée dans ce cours'
      });
    }

    await pool.execute('DELETE FROM lessons WHERE id = ?', [lessonId]);

    res.json({
      success: true,
      message: 'Leçon supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de la leçon:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la leçon'
    });
  }
};

const addToFavorites = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Vérifier que le cours existe
    const [courses] = await pool.execute(
      'SELECT id, title FROM courses WHERE id = ?',
      [courseId]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    // Vérifier si le favori existe déjà
    const [existing] = await pool.execute(
      'SELECT id FROM course_favorites WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ce cours est déjà dans vos favoris'
      });
    }

    // Ajouter aux favoris
    await pool.execute(
      'INSERT INTO course_favorites (user_id, course_id) VALUES (?, ?)',
      [userId, courseId]
    );

    res.json({
      success: true,
      message: 'Cours ajouté aux favoris avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de l\'ajout aux favoris:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout aux favoris'
    });
  }
};

const removeFromFavorites = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Vérifier si le favori existe
    const [existing] = await pool.execute(
      'SELECT id FROM course_favorites WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ce cours n\'est pas dans vos favoris'
      });
    }

    // Retirer des favoris
    await pool.execute(
      'DELETE FROM course_favorites WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    res.json({
      success: true,
      message: 'Cours retiré des favoris avec succès'
    });

  } catch (error) {
    console.error('Erreur lors du retrait des favoris:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du retrait des favoris'
    });
  }
};

const getFavoriteCourses = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    const {
      page = 1,
      limit = 10,
      search = '',
      category,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const offset = (pageNum - 1) * perPage;

    // Construire la requête avec filtres
    let whereClause = `
      WHERE c.is_published = TRUE 
        AND (COALESCE(c.status, 'draft') = 'approved' OR COALESCE(c.status, 'draft') = 'published') 
        AND COALESCE(c.status, 'draft') != 'draft'
        AND cf.user_id = ?
    `;
    let params = [userId];

    // Filtre de recherche
    if (search) {
      whereClause += ' AND (c.title LIKE ? OR c.description LIKE ? OR c.short_description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Filtre par catégorie
    if (category) {
      whereClause += ' AND c.category_id = ?';
      params.push(category);
    }

    // Validation du tri
    const validSorts = ['created_at', 'title', 'average_rating', 'enrollment_count', 'price'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Requête principale
    const query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        u.organization as instructor_organization,
        COALESCE(
          CONCAT('/uploads/profiles/', uf.file_name),
          u.profile_picture
        ) as instructor_profile_picture,
        stats.average_rating,
        stats.review_count,
        stats.enrollment_count,
        COALESCE(lesson_counts.total_lessons, 0) as total_lessons,
        COALESCE(ca.total_views, 0) as total_views,
        cp.title as prerequisite_title,
        cp.id as prerequisite_id,
        cf.created_at as favorited_at
      FROM course_favorites cf
      INNER JOIN courses c ON cf.course_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT uf1.user_id, uf1.file_name
        FROM user_files uf1
        INNER JOIN (
          SELECT user_id, MAX(created_at) as max_created_at
          FROM user_files
          WHERE file_type = 'profile_picture'
          GROUP BY user_id
        ) uf2 ON uf1.user_id = uf2.user_id 
          AND uf1.created_at = uf2.max_created_at
          AND uf1.file_type = 'profile_picture'
      ) uf ON uf.user_id = u.id
      LEFT JOIN (
        SELECT 
          c.id AS course_id,
          AVG(cr.rating) AS average_rating,
          COUNT(DISTINCT cr.id) AS review_count,
          COUNT(DISTINCT e.id) AS enrollment_count
        FROM courses c
        LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_active = TRUE
        GROUP BY c.id
      ) stats ON stats.course_id = c.id
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      LEFT JOIN courses cp ON c.prerequisite_course_id = cp.id
      LEFT JOIN (
        SELECT 
          m.course_id,
          COUNT(DISTINCT l.id) as total_lessons
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
        GROUP BY m.course_id
      ) lesson_counts ON lesson_counts.course_id = c.id
      ${whereClause}
      ORDER BY ${sortField === 'created_at' ? 'cf.created_at' : `c.${sortField}`} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    params.push(perPage, offset);

    const [courses] = await pool.execute(query, params);

    // Compter le total pour la pagination
    const countQuery = `
      SELECT COUNT(DISTINCT cf.id) as total
      FROM course_favorites cf
      INNER JOIN courses c ON cf.course_id = c.id
      ${whereClause}
    `;
    const countParams = params.slice(0, -2); // Retirer limit et offset
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    const formattedCourses = courses.map(row => formatCourseRow(row));

    // Format de réponse compatible avec le frontend
    res.json({
      success: true,
      count: total,
      courses: formattedCourses,
      data: {
        courses: formattedCourses,
        pagination: {
          page: pageNum,
          limit: perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des favoris:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des favoris'
    });
  }
};

const addReview = async (req, res) => {
  // Ajouter un avis
};

const getCourseReviews = async (req, res) => {
  // Récupérer les avis d'un cours
};

const updateReview = async (req, res) => {
  // Mettre à jour un avis
};

const deleteReview = async (req, res) => {
  // Supprimer un avis
};

// Récupérer les inscrits d'un cours avec infos étudiant et progression (pagination + filtres)
const getCourseEnrollments = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.params.id; // Support both :id and :courseId routes
    const requesterId = req.user?.id ?? req.user?.userId ?? null;
    const requesterRole = req.user?.role;
    const {
      page = 1,
      limit = 10,
      search = '', // first/last/email
      status,      // enrolled/completed/cancelled etc.
      sort = 'enrolled_at', // enrolled_at | progress | last_accessed_at | completed_at
      order = 'DESC'        // ASC | DESC
    } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const offset = (pageNum - 1) * perPage;

    // Vérifier que l'utilisateur est authentifié
    if (!requesterId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    // Vérifier permissions: propriétaire du cours ou admin
    const [courseRows] = await pool.execute('SELECT instructor_id FROM courses WHERE id = ?', [courseId]);
    if (courseRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cours non trouvé' });
    }
    const instructorId = parseInt(courseRows[0].instructor_id);
    const requesterIdNum = parseInt(requesterId);
    if (requesterRole !== 'admin' && instructorId !== requesterIdNum) {
      return res.status(403).json({ success: false, message: 'Non autorisé à consulter les inscrits de ce cours' });
    }

    // Construire filtres
    const whereClauses = ['e.course_id = ?'];
    const params = [courseId];
    if (status) {
      whereClauses.push('e.status = ?');
      params.push(status);
    }
    if (search) {
      whereClauses.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    // Tri autorisé
    const sortMap = {
      enrolled_at: 'e.enrolled_at',
      progress: 'e.progress_percentage',
      last_accessed_at: 'e.last_accessed_at',
      completed_at: 'e.completed_at',
      first_name: 'u.first_name',
      last_name: 'u.last_name'
    };
    const sortColumn = sortMap[sort] || 'e.enrolled_at';
    const sortOrder = (String(order).toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

    const baseSelect = `
      SELECT 
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        NULL AS avatar_url,
        e.id as enrollment_id,
        e.status,
        e.enrolled_at,
        e.progress_percentage,
        e.completed_at,
        e.last_accessed_at,
        COALESCE(lp_completed.completed_lessons, 0) as lessons_completed,
        COALESCE(l_counts.total_lessons, 0) as total_lessons,
        COALESCE(qa_stats.quiz_attempts, 0) as quiz_attempts,
        qa_stats.avg_quiz_score
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN (
        SELECT lp.user_id, lp.course_id, COUNT(DISTINCT lp.lesson_id) as completed_lessons
        FROM lesson_progress lp
        WHERE lp.is_completed = TRUE
        GROUP BY lp.user_id, lp.course_id
      ) lp_completed ON lp_completed.user_id = e.user_id AND lp_completed.course_id = e.course_id
      LEFT JOIN (
        SELECT l.course_id, COUNT(*) as total_lessons
        FROM lessons l
        GROUP BY l.course_id
      ) l_counts ON l_counts.course_id = e.course_id
      LEFT JOIN (
        SELECT qa.user_id, qa.course_id, COUNT(qa.id) as quiz_attempts, AVG(qa.percentage) as avg_quiz_score
        FROM quiz_attempts qa
        GROUP BY qa.user_id, qa.course_id
      ) qa_stats ON qa_stats.user_id = e.user_id AND qa_stats.course_id = e.course_id
      WHERE ${whereClauses.join(' AND ')}
    `;
    const dataQuery = `${baseSelect} ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`;
    const dataParams = params.concat([perPage, offset]);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE ${whereClauses.join(' AND ')}
    `;
    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0]?.total || 0;

    const [rows] = await pool.execute(dataQuery, dataParams);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: perPage,
        total,
        pages: Math.ceil(total / perPage)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des inscrits du cours:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des inscrits du cours'
    });
  }
};

// Récupérer les cours de l'utilisateur connecté
const getMyCourses = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;
    
    const [courses] = await pool.execute(`
      SELECT 
        c.*,
        e.enrolled_at,
        e.progress_percentage,
        e.completed_at,
        e.is_active,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        u.organization as instructor_organization,
        COALESCE(
          CONCAT('/uploads/profiles/', uf.file_name),
          u.profile_picture
        ) as instructor_profile_picture,
        stats.average_rating,
        stats.review_count,
        enroll_stats.enrollment_count,
        COALESCE(ca.total_views, 0) as total_views,
        COALESCE(progress_counts.completed_lessons, 0) as completed_lessons,
        COALESCE(total_lessons_counts.total_lessons, 0) as total_lessons
      FROM enrollments e
      INNER JOIN courses c ON c.id = e.course_id
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT uf1.user_id, uf1.file_name
        FROM user_files uf1
        INNER JOIN (
          SELECT user_id, MAX(created_at) as max_created_at
          FROM user_files
          WHERE file_type = 'profile_picture'
          GROUP BY user_id
        ) uf2 ON uf1.user_id = uf2.user_id 
          AND uf1.created_at = uf2.max_created_at
          AND uf1.file_type = 'profile_picture'
      ) uf ON uf.user_id = u.id
      LEFT JOIN (
        SELECT 
          course_id,
          AVG(rating) AS average_rating,
          COUNT(*) AS review_count
        FROM course_reviews
        WHERE is_approved = TRUE
        GROUP BY course_id
      ) stats ON stats.course_id = c.id
      LEFT JOIN (
        SELECT 
          course_id,
          COUNT(*) AS enrollment_count
        FROM enrollments
        GROUP BY course_id
      ) enroll_stats ON enroll_stats.course_id = c.id
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      LEFT JOIN (
        SELECT 
          enrollment_id,
          COUNT(*) AS completed_lessons
        FROM progress
        WHERE status = 'completed'
        GROUP BY enrollment_id
      ) progress_counts ON progress_counts.enrollment_id = e.id
      LEFT JOIN (
        SELECT 
          course_id,
          COUNT(*) AS total_lessons
        FROM lessons
        WHERE is_published = TRUE
        GROUP BY course_id
      ) total_lessons_counts ON total_lessons_counts.course_id = c.id
      WHERE e.user_id = ? AND e.is_active = TRUE
      ORDER BY e.enrolled_at DESC
    `, [userId]);

    const formattedCourses = (courses || []).map((course) => {
      const progressPercentage = Number(course.progress_percentage || 0);
      const completedLessons = Number(course.completed_lessons || 0);
      const totalLessons = Number(course.total_lessons || 0);

      return {
        ...formatCourseRow(course),
        progress: progressPercentage,
        progress_percentage: progressPercentage,
        completed_lessons: completedLessons,
        total_lessons: totalLessons,
        enrollment: {
          enrolled_at: course.enrolled_at,
          progress_percentage: progressPercentage,
          completed_at: course.completed_at,
          is_active: Boolean(course.is_active)
        }
      };
    });

    res.json({
      success: true,
      data: formattedCourses
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des cours:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cours',
      error: error.message
    });
  }
};

// Récupérer les leçons d'un cours
const getCourseLessons = async (req, res) => {
  try {
    const courseId = req.params.courseId || req.params.id; // Support both :id and :courseId routes
    const userId = req.user?.id ?? req.user?.userId;
    const userRole = req.user?.role;

    // Vérifier que le cours existe et récupérer l'instructeur
    const [courses] = await pool.execute(
      'SELECT id, instructor_id FROM courses WHERE id = ?',
      [sanitizeValue(courseId)]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];
    const isInstructor = course.instructor_id && parseInt(course.instructor_id) === parseInt(userId);
    const isAdmin = userRole === 'admin';

    // Autoriser l'accès si l'utilisateur est l'instructeur du cours ou un admin
    // Sinon, vérifier l'inscription
    if (!isInstructor && !isAdmin) {
      const [enrollment] = await pool.execute(
        'SELECT * FROM enrollments WHERE course_id = ? AND user_id = ?',
        [courseId, userId]
      );

      if (enrollment.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas inscrit à ce cours'
        });
      }
    }

    // Récupérer les leçons du cours
    // Pour les instructeurs/admins, on ne récupère pas la progression (car ils ne sont pas inscrits)
    const query = isInstructor || isAdmin ? `
      SELECT 
        l.*,
        NULL as is_completed,
        NULL as completed_at
      FROM lessons l
      WHERE l.course_id = ?
      ORDER BY l.order_index ASC
    ` : `
      SELECT 
        l.*,
        lp.is_completed,
        lp.completed_at
      FROM lessons l
      LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = ?
      WHERE l.course_id = ?
      ORDER BY l.order_index ASC
    `;

    const [lessons] = isInstructor || isAdmin 
      ? await pool.execute(query, [courseId])
      : await pool.execute(query, [userId, courseId]);

    res.json({
      success: true,
      data: lessons
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des leçons:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des leçons'
    });
  }
};


// Récupérer la progression d'un cours
const getCourseProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    
    // Données simulées pour la progression
    const mockProgress = {
      courseId: id,
      progress: 75,
      completedLessons: ['lesson1', 'lesson2', 'lesson3'],
      lastAccessedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: mockProgress
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération de la progression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la progression'
    });
  }
};

// Récupérer les cours d'un instructeur spécifique
const getInstructorCourses = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const { page = 1, limit = 10, status = 'all' } = req.query;
    
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE c.instructor_id = ?';
    let params = [instructorId];

    // Filtre par statut
    if (status === 'published') {
      whereClause += ' AND c.is_published = TRUE';
    } else if (status === 'draft') {
      whereClause += ' AND c.is_published = FALSE';
    }

    // Requête principale
    const query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        COUNT(DISTINCT e.id) as enrollment_count,
        COUNT(DISTINCT l.id) as lesson_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_active = TRUE
      LEFT JOIN lessons l ON c.id = l.course_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), offset);

    const [courses] = await pool.execute(query, params);

    // Compter le total pour la pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM courses c
      ${whereClause}
    `;
    
    const [countResult] = await pool.execute(countQuery, [instructorId]);
    const total = countResult[0].total;

    // Formater les données
    const formattedCourses = courses.map(course => ({
      id: course.id,
      title: course.title,
      description: course.description,
      thumbnail_url: buildMediaUrl(course.thumbnail_url),
      price: course.price,
      language: course.language,
      duration_minutes: course.duration_minutes,
      is_published: course.is_published,
      created_at: course.created_at,
      updated_at: course.updated_at,
      category: course.category_id ? {
        id: course.category_id,
        name: course.category_name || null,
        color: course.category_color || null
      } : null,
      instructor: {
        id: course.instructor_id,
        first_name: course.instructor_first_name,
        last_name: course.instructor_last_name,
        email: course.instructor_email
      },
      stats: {
        enrollment_count: course.enrollment_count || 0,
        lesson_count: course.lesson_count || 0
      }
    }));

    res.json({
      success: true,
      data: {
        courses: formattedCourses,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des cours de l\'instructeur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cours de l\'instructeur',
      error: error.message
    });
  }
};

// Récupérer les cours populaires
const getPopularCourses = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        u.organization as instructor_organization,
        COALESCE(
          CONCAT('/uploads/profiles/', uf.file_name),
          u.profile_picture
        ) as instructor_profile_picture,
        AVG(cr.rating) as average_rating,
        COUNT(DISTINCT cr.id) as review_count,
        COUNT(DISTINCT e.id) as enrollment_count,
        COALESCE(lesson_counts.total_lessons, 0) as total_lessons,
        COALESCE(ca.total_views, 0) as total_views
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT uf1.user_id, uf1.file_name
        FROM user_files uf1
        INNER JOIN (
          SELECT user_id, MAX(created_at) as max_created_at
          FROM user_files
          WHERE file_type = 'profile_picture'
          GROUP BY user_id
        ) uf2 ON uf1.user_id = uf2.user_id 
          AND uf1.created_at = uf2.max_created_at
          AND uf1.file_type = 'profile_picture'
      ) uf ON uf.user_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_active = TRUE
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      LEFT JOIN (
        SELECT 
          m.course_id,
          COUNT(DISTINCT l.id) as total_lessons
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
        GROUP BY m.course_id
      ) lesson_counts ON lesson_counts.course_id = c.id
      WHERE c.is_published = TRUE 
        AND (COALESCE(c.status, 'draft') = 'approved' OR COALESCE(c.status, 'draft') = 'published') 
        AND COALESCE(c.status, 'draft') != 'draft'
      GROUP BY c.id, lesson_counts.total_lessons
      HAVING COUNT(DISTINCT e.id) >= 1
      ORDER BY COUNT(DISTINCT e.id) DESC, average_rating DESC
      LIMIT ?
    `;

    const [courses] = await pool.execute(query, [parseInt(limit)]);

    res.json({
      success: true,
      data: courses.map(formatCourseRow)
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des cours populaires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cours populaires'
    });
  }
};

// Récupérer les cours recommandés pour un utilisateur
const getRecommendedCourses = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { limit = 10 } = req.query;

    let query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        u.organization as instructor_organization,
        COALESCE(
          CONCAT('/uploads/profiles/', uf.file_name),
          u.profile_picture
        ) as instructor_profile_picture,
        AVG(cr.rating) as average_rating,
        COUNT(cr.id) as review_count,
        COUNT(e.id) as enrollment_count,
        COALESCE(ca.total_views, 0) as total_views
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT uf1.user_id, uf1.file_name
        FROM user_files uf1
        INNER JOIN (
          SELECT user_id, MAX(created_at) as max_created_at
          FROM user_files
          WHERE file_type = 'profile_picture'
          GROUP BY user_id
        ) uf2 ON uf1.user_id = uf2.user_id 
          AND uf1.created_at = uf2.max_created_at
          AND uf1.file_type = 'profile_picture'
      ) uf ON uf.user_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_active = TRUE
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      WHERE c.is_published = TRUE
    `;

    // Exclure les cours déjà suivis par l'utilisateur
    if (userId) {
      query += ` AND c.id NOT IN (SELECT course_id FROM enrollments WHERE user_id = ?)`;
    }

    query += `
      GROUP BY c.id
      ORDER BY average_rating DESC, enrollment_count DESC
      LIMIT ?
    `;

    const params = userId ? [userId, parseInt(limit)] : [parseInt(limit)];
    const [courses] = await pool.execute(query, params);

    res.json({
      success: true,
      data: courses.map(formatCourseRow)
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des cours recommandés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cours recommandés'
    });
  }
};

// Récupérer le planning d'un cours (sessions live + événements)
const getCourseSchedule = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    // Vérifier que le cours existe
    const [courses] = await pool.execute(
      'SELECT id, title FROM courses WHERE id = ?',
      [courseId]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    // Récupérer les sessions live du cours
    const [liveSessions] = await pool.execute(
      `
      SELECT
        ls.id,
        ls.title,
        ls.description,
        ls.scheduled_start_at AS start_date,
        ls.scheduled_end_at AS end_date,
        ls.status,
        ls.max_participants,
        ls.is_recording_enabled,
        u.first_name AS instructor_first_name,
        u.last_name AS instructor_last_name,
        u.email AS instructor_email
      FROM live_sessions ls
      JOIN users u ON ls.instructor_id = u.id
      WHERE ls.course_id = ?
        AND ls.status IN ('scheduled', 'live')
      ORDER BY ls.scheduled_start_at ASC
      `,
      [courseId]
    );

    // Récupérer les événements du calendrier liés au cours
    const [events] = await pool.execute(
      `
      SELECT
        e.id,
        e.title,
        e.description,
        e.event_type,
        e.start_date,
        e.end_date,
        e.is_all_day,
        e.location,
        e.is_public,
        creator.first_name AS creator_first_name,
        creator.last_name AS creator_last_name
      FROM events e
      LEFT JOIN users creator ON creator.id = e.created_by
      WHERE e.course_id = ?
        AND (e.is_public = TRUE OR e.created_by = ? OR ? IS NULL)
      ORDER BY e.start_date ASC
      `,
      [courseId, userId, userId]
    );

    // Formater les sessions live (filtrer celles sans date valide)
    const formattedSessions = liveSessions
      .filter(session => session.start_date != null)
      .map((session) => ({
        id: session.id,
        title: session.title,
        description: session.description,
        type: 'live_session',
        start_date: session.start_date ? new Date(session.start_date).toISOString() : null,
        end_date: session.end_date ? new Date(session.end_date).toISOString() : null,
        status: session.status,
        max_participants: session.max_participants,
        is_recording_enabled: Boolean(session.is_recording_enabled),
        instructor: {
          first_name: session.instructor_first_name,
          last_name: session.instructor_last_name,
          email: session.instructor_email
        }
      }));

    // Formater les événements (filtrer ceux sans date valide)
    const formattedEvents = events
      .filter(event => event.start_date != null)
      .map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        type: 'event',
        event_type: event.event_type,
        start_date: event.start_date ? new Date(event.start_date).toISOString() : null,
        end_date: event.end_date ? new Date(event.end_date).toISOString() : null,
        is_all_day: Boolean(event.is_all_day),
        location: event.location,
        is_public: Boolean(event.is_public),
        created_by: event.creator_first_name ? {
          first_name: event.creator_first_name,
          last_name: event.creator_last_name
        } : null
      }));

    // Fusionner et trier par date (filtrer ceux sans start_date valide)
    const schedule = [...formattedSessions, ...formattedEvents]
      .filter(item => item.start_date != null)
      .sort((a, b) => {
        return new Date(a.start_date) - new Date(b.start_date);
      });

    res.json({
      success: true,
      data: {
        course_id: parseInt(courseId),
        course_title: courses[0].title,
        schedule: schedule,
        live_sessions: formattedSessions,
        events: formattedEvents
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du planning:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du planning'
    });
  }
};

// Récupérer un cours par slug
const getCourseBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        u.organization as instructor_organization,
        COALESCE(
          CONCAT('/uploads/profiles/', uf.file_name),
          u.profile_picture
        ) as instructor_profile_picture,
        stats.average_rating,
        stats.review_count,
        stats.enrollment_count,
        COALESCE(lesson_counts.total_lessons, 0) as total_lessons,
        COALESCE(ca.total_views, 0) as total_views,
        cp.title as prerequisite_title,
        cp.id as prerequisite_id
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT uf1.user_id, uf1.file_name
        FROM user_files uf1
        INNER JOIN (
          SELECT user_id, MAX(created_at) as max_created_at
          FROM user_files
          WHERE file_type = 'profile_picture'
          GROUP BY user_id
        ) uf2 ON uf1.user_id = uf2.user_id 
          AND uf1.created_at = uf2.max_created_at
          AND uf1.file_type = 'profile_picture'
      ) uf ON uf.user_id = u.id
      LEFT JOIN (
        SELECT 
          c.id AS course_id,
          AVG(cr.rating) AS average_rating,
          COUNT(DISTINCT cr.id) AS review_count,
          COUNT(DISTINCT e.id) AS enrollment_count
        FROM courses c
        LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.is_active = TRUE
        GROUP BY c.id
      ) stats ON stats.course_id = c.id
      LEFT JOIN course_analytics ca ON ca.course_id = c.id
      LEFT JOIN courses cp ON c.prerequisite_course_id = cp.id
      LEFT JOIN (
        SELECT 
          m.course_id,
          COUNT(DISTINCT l.id) as total_lessons
        FROM modules m
        LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
        GROUP BY m.course_id
      ) lesson_counts ON lesson_counts.course_id = c.id
      WHERE c.slug = ? 
        AND c.is_published = TRUE 
        AND (COALESCE(c.status, 'draft') = 'approved' OR COALESCE(c.status, 'draft') = 'published') 
        AND COALESCE(c.status, 'draft') != 'draft'
    `;

    const [courses] = await pool.execute(query, [slug]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = formatCourseRow(courses[0]);

    // Vérifier si l'utilisateur connecté est inscrit à ce cours
    let isEnrolled = false;
    let enrollment = null;
    let isFavorite = false;
    const userId = req.user?.id ?? req.user?.userId;
    
    if (userId) {
      // Vérifier l'inscription
      const [enrollments] = await pool.execute(
        `SELECT 
          e.*,
          c.title as course_title
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.user_id = ? AND e.course_id = ? AND e.is_active = TRUE
        LIMIT 1`,
        [userId, course.id]
      );
      
      if (enrollments.length > 0) {
        isEnrolled = true;
        enrollment = {
          id: enrollments[0].id,
          status: enrollments[0].status,
          enrolled_at: enrollments[0].enrolled_at,
          progress_percentage: enrollments[0].progress_percentage,
          completed_at: enrollments[0].completed_at
        };
      }

      // Vérifier si le cours est en favoris
      const [favorites] = await pool.execute(
        'SELECT id FROM course_favorites WHERE user_id = ? AND course_id = ? LIMIT 1',
        [userId, course.id]
      );
      
      if (favorites.length > 0) {
        isFavorite = true;
      }
    }

    // Récupérer les modules du cours avec leurs quiz
    const modulesQuery = `
      SELECT 
        m.*,
        MAX(mq.id) as quiz_id,
        MAX(mq.title) as quiz_title,
        MAX(mq.description) as quiz_description,
        MAX(mq.passing_score) as quiz_passing_score,
        MAX(mq.time_limit_minutes) as quiz_time_limit_minutes,
        MAX(mq.max_attempts) as quiz_max_attempts,
        MAX(mq.is_published) as quiz_is_published
      FROM modules m
      LEFT JOIN module_quizzes mq ON m.id = mq.module_id AND mq.is_published = TRUE
      WHERE m.course_id = ?
      GROUP BY m.id
      ORDER BY m.order_index ASC
    `;
    const [modules] = await pool.execute(modulesQuery, [course.id]);

    // Pour chaque module, récupérer ses leçons avec toutes les informations nécessaires
    const modulesWithLessons = await Promise.all(
      modules.map(async (module) => {
        const lessonsQuery = `
          SELECT 
            l.*,
            mf.url as media_url,
            mf.thumbnail_url,
            mf.file_category,
            mf.filename,
            mf.original_filename,
            mf.file_size,
            mf.file_type,
            mf.id as media_file_id_from_join
          FROM lessons l
          LEFT JOIN media_files mf ON (
            l.media_file_id = mf.id 
            OR (l.id = mf.lesson_id AND l.media_file_id IS NULL)
          )
          WHERE l.module_id = ? AND l.is_published = TRUE
          ORDER BY l.order_index ASC, mf.uploaded_at DESC
        `;
        const [lessons] = await pool.execute(lessonsQuery, [module.id]);
        
        // Formater le module avec ses leçons et le quiz (format exact comme lors de la création)
        return {
          ...module,
          lessons: lessons || [],
          quiz: module.quiz_id ? {
            id: module.quiz_id,
            title: module.quiz_title,
            description: module.quiz_description,
            passing_score: module.quiz_passing_score,
            time_limit_minutes: module.quiz_time_limit_minutes,
            max_attempts: module.quiz_max_attempts,
            is_published: module.quiz_is_published
          } : null
        };
      })
    );

    res.json({
      success: true,
      data: {
        course: {
          ...course,
          is_enrolled: isEnrolled,
          enrollment: enrollment,
          is_favorite: isFavorite
        },
        modules: modulesWithLessons
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du cours:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du cours'
    });
  }
};

// Vérifier si l'utilisateur est inscrit à un cours
const checkEnrollment = async (req, res) => {
  try {
    const { id: courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    const query = `
      SELECT 
        e.*,
        c.title as course_title
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ? AND e.course_id = ? AND e.is_active = TRUE
    `;

    const [enrollments] = await pool.execute(query, [userId, courseId]);

    res.json({
      success: true,
      data: {
        is_enrolled: enrollments.length > 0,
        enrollment: enrollments.length > 0 ? enrollments[0] : null
      }
    });

  } catch (error) {
    console.error('Erreur lors de la vérification de l\'inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de l\'inscription'
    });
  }
};

module.exports = {
  getAllCourses,
  getCourseById,
  getCourseBySlug,
  createCourse,
  updateCourse,
  deleteCourse,
  addLesson,
  updateLesson,
  deleteLesson,
  getCoursesByCategory,
  searchCourses,
  getFeaturedCourses,
  getPopularCourses,
  getRecommendedCourses,
  getMyCourses,
  getCourseLessons,
  getCourseProgress,
  checkEnrollment,
  addToFavorites,
  removeFromFavorites,
  getFavoriteCourses,
  getCourseSchedule,
  addReview,
  getCourseReviews,
  updateReview,
  deleteReview,
  getInstructorCourses,
  getCourseEnrollments
};
