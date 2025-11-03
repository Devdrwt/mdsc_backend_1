const { pool } = require('../config/database');

// Fonction utilitaire pour convertir undefined en null (requis pour MySQL2)
const sanitizeValue = (value) => value === undefined ? null : value;
const { v4: uuidv4 } = require('uuid');

// Récupérer tous les cours (avec pagination et filtres)
const getAllCourses = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      difficulty, 
      language = 'fr',
      search,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE c.is_published = TRUE';
    let params = [];

    // Filtres
    if (category) {
      whereClause += ' AND c.category_id = ?';
      params.push(category);
    }

    if (difficulty) {
      whereClause += ' AND c.difficulty = ?';
      params.push(difficulty);
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
        AVG(cr.rating) as average_rating,
        COUNT(cr.id) as review_count,
        COUNT(e.id) as enrollment_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id
      ${whereClause}
      GROUP BY c.id
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
        courses,
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
      'SELECT id, instructor_id, is_published FROM courses WHERE id = ?', 
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
      userRole
    });
    
    // Vérifier les permissions : si non publié, seul l'instructeur ou admin peut le voir
    if (!courseInfo.is_published && !isInstructor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Ce cours n\'est pas encore publié'
      });
    }

    // Construire la requête principale
    let query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.color as category_color,
        cat.id as category_id,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        AVG(cr.rating) as average_rating,
        COUNT(cr.id) as review_count,
        COUNT(e.id) as enrollment_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.id = ?
    `;
    
    // Si l'utilisateur n'est pas l'instructeur/admin, ne montrer que les cours publiés
    if (!isInstructor && !isAdmin) {
      query += ' AND c.is_published = TRUE';
    }
    
    query += ' GROUP BY c.id';

    const [courses] = await pool.execute(query, [id]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];

    // Récupérer les modules du cours
    const modulesQuery = `
      SELECT m.*, COUNT(l.id) as lessons_count
      FROM modules m
      LEFT JOIN lessons l ON m.id = l.module_id
      WHERE m.course_id = ?
      GROUP BY m.id
      ORDER BY m.order_index ASC
    `;
    const [modules] = await pool.execute(modulesQuery, [id]);

    // Récupérer les leçons (si pas de modules) ou toutes les leçons du cours
    const lessonsQuery = `
      SELECT l.*, m.title as module_title, m.id as module_id
      FROM lessons l
      LEFT JOIN modules m ON l.module_id = m.id
      WHERE l.course_id = ?
      ORDER BY m.order_index ASC, l.order_index ASC
    `;
    const [lessons] = await pool.execute(lessonsQuery, [id]);

    // Récupérer les quiz du cours
    const quizzesQuery = `
      SELECT * FROM quizzes 
      WHERE course_id = ?
    `;
    const [quizzes] = await pool.execute(quizzesQuery, [id]);

    res.json({
      success: true,
      data: {
        course: {
          ...course,
          category: course.category_id ? {
            id: course.category_id,
            name: course.category_name,
            color: course.category_color
          } : null
        },
        modules,
        lessons,
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
      difficulty,
      language,
      price,
      currency,
      max_students,
      enrollment_deadline,
      course_start_date,
      course_end_date
    } = req.body;

    const instructor_id = req.user?.id ?? req.user?.userId;

    const query = `
      INSERT INTO courses (
        title, description, short_description, instructor_id, category_id,
        thumbnail_url, video_url, duration_minutes, difficulty, language,
        price, currency, max_students, enrollment_deadline, course_start_date, course_end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      sanitizeValue(difficulty),
      sanitizeValue(language),
      sanitizeValue(price),
      sanitizeValue(currency),
      sanitizeValue(max_students),
      sanitizeValue(enrollment_deadline),
      sanitizeValue(course_start_date),
      sanitizeValue(course_end_date)
    ]);

    res.status(201).json({
      success: true,
      message: 'Cours créé avec succès',
      data: {
        course_id: result.insertId
      }
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
      'thumbnail_url', 'video_url', 'duration_minutes', 'difficulty',
      'language', 'price', 'currency', 'max_students',
      'enrollment_deadline', 'course_start_date', 'course_end_date',
      'is_published', 'is_featured'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        values.push(sanitizeValue(req.body[field]));
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

    res.json({
      success: true,
      message: 'Cours mis à jour avec succès'
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
    const { title, description, content, video_url, duration_minutes, module_id } = req.body;
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

    // Récupérer le prochain index (par module si module_id fourni, sinon par cours)
    let orderQuery, nextOrder;
    if (module_id) {
      orderQuery = 'SELECT MAX(order_index) as max_order FROM lessons WHERE module_id = ?';
      const [orderResult] = await pool.execute(orderQuery, [sanitizeValue(module_id)]);
      nextOrder = (orderResult[0]?.max_order || 0) + 1;
      const query = `
        INSERT INTO lessons (course_id, module_id, title, description, content, video_url, duration_minutes, order_index, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
      `;
      const [result] = await pool.execute(query, [
        sanitizeValue(courseId),
        sanitizeValue(module_id),
        sanitizeValue(title),
        sanitizeValue(description),
        sanitizeValue(content),
        sanitizeValue(video_url),
        sanitizeValue(duration_minutes),
        sanitizeValue(nextOrder)
      ]);
      return res.status(201).json({
        success: true,
        message: 'Leçon ajoutée avec succès',
        data: {
          lesson_id: result.insertId
        }
      });
    } else {
      orderQuery = 'SELECT MAX(order_index) as max_order FROM lessons WHERE course_id = ? AND (module_id IS NULL OR module_id = 0)';
      const [orderResult] = await pool.execute(orderQuery, [sanitizeValue(courseId)]);
      nextOrder = (orderResult[0]?.max_order || 0) + 1;
      const query = `
        INSERT INTO lessons (course_id, title, description, content, video_url, duration_minutes, order_index, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
      `;
      const [result] = await pool.execute(query, [
        sanitizeValue(courseId),
        sanitizeValue(title),
        sanitizeValue(description),
        sanitizeValue(content),
        sanitizeValue(video_url),
        sanitizeValue(duration_minutes),
        sanitizeValue(nextOrder)
      ]);
      return res.status(201).json({
        success: true,
        message: 'Leçon ajoutée avec succès',
        data: {
          lesson_id: result.insertId
        }
      });
    }

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
        AVG(cr.rating) as average_rating,
        COUNT(cr.id) as review_count,
        COUNT(e.id) as enrollment_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.is_published = TRUE AND c.category_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [courses] = await pool.execute(query, [categoryId, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: courses
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
        AVG(cr.rating) as average_rating,
        COUNT(cr.id) as review_count,
        COUNT(e.id) as enrollment_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.is_published = TRUE 
        AND (c.title LIKE ? OR c.description LIKE ? OR c.short_description LIKE ?)
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const searchTerm = `%${q}%`;
    const [courses] = await pool.execute(query, [searchTerm, searchTerm, searchTerm, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: courses
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
        AVG(cr.rating) as average_rating,
        COUNT(cr.id) as review_count,
        COUNT(e.id) as enrollment_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.is_published = TRUE AND c.is_featured = TRUE
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ?
    `;

    const [courses] = await pool.execute(query, [parseInt(limit)]);

    res.json({
      success: true,
      data: courses
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
  // Ajouter aux favoris
};

const removeFromFavorites = async (req, res) => {
  // Retirer des favoris
};

const getFavoriteCourses = async (req, res) => {
  // Récupérer les cours favoris
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
        e.progress_percentage as progress,
        e.completed_at,
        e.is_active,
        cat.name as category_name
      FROM courses c
      INNER JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE e.user_id = ? AND e.is_active = TRUE
      ORDER BY e.enrolled_at DESC
    `, [userId]);

    // Retourner un tableau vide si aucun cours n'est trouvé
    res.json({
      success: true,
      data: courses || []
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
      LEFT JOIN enrollments e ON c.id = e.course_id
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
      thumbnail: course.thumbnail,
      price: course.price,
      difficulty: course.difficulty,
      language: course.language,
      duration: course.duration,
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
        AVG(cr.rating) as average_rating,
        COUNT(cr.id) as review_count,
        COUNT(e.id) as enrollment_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id
      WHERE c.is_published = TRUE
      GROUP BY c.id
      ORDER BY enrollment_count DESC, average_rating DESC
      LIMIT ?
    `;

    const [courses] = await pool.execute(query, [parseInt(limit)]);

    res.json({
      success: true,
      data: courses
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
        AVG(cr.rating) as average_rating,
        COUNT(cr.id) as review_count,
        COUNT(e.id) as enrollment_count
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id
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
      data: courses
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des cours recommandés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cours recommandés'
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
        AVG(cr.rating) as average_rating,
        COUNT(cr.id) as review_count,
        COUNT(e.id) as enrollment_count,
        cp.title as prerequisite_title,
        cp.id as prerequisite_id
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id AND cr.is_approved = TRUE
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN courses cp ON c.prerequisite_course_id = cp.id
      WHERE c.slug = ? AND c.is_published = TRUE
      GROUP BY c.id
    `;

    const [courses] = await pool.execute(query, [slug]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];

    // Récupérer les modules du cours
    const modulesQuery = `
      SELECT 
        m.*,
        COUNT(l.id) as lessons_count
      FROM modules m
      LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
      WHERE m.course_id = ?
      GROUP BY m.id
      ORDER BY m.order_index ASC
    `;
    const [modules] = await pool.execute(modulesQuery, [course.id]);

    res.json({
      success: true,
      data: {
        course,
        modules
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
      WHERE e.user_id = ? AND e.course_id = ?
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
  addReview,
  getCourseReviews,
  updateReview,
  deleteReview,
  getInstructorCourses,
  getCourseEnrollments
};
