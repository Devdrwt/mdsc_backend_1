const { pool } = require('../config/database');
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
      WHERE c.id = ? AND c.is_published = TRUE
      GROUP BY c.id
    `;

    const [courses] = await pool.execute(query, [id]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    // Récupérer les leçons du cours
    const lessonsQuery = `
      SELECT * FROM lessons 
      WHERE course_id = ? AND is_published = TRUE 
      ORDER BY order_index ASC
    `;
    const [lessons] = await pool.execute(lessonsQuery, [id]);

    // Récupérer les quiz du cours
    const quizzesQuery = `
      SELECT * FROM quizzes 
      WHERE course_id = ? AND is_published = TRUE
    `;
    const [quizzes] = await pool.execute(quizzesQuery, [id]);

    res.json({
      success: true,
      data: {
        course: courses[0],
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

    const instructor_id = req.user.id;

    const query = `
      INSERT INTO courses (
        title, description, short_description, instructor_id, category_id,
        thumbnail_url, video_url, duration_minutes, difficulty, language,
        price, currency, max_students, enrollment_deadline, course_start_date, course_end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      title, description, short_description, instructor_id, category_id,
      thumbnail_url, video_url, duration_minutes, difficulty, language,
      price, currency, max_students, enrollment_deadline, course_start_date, course_end_date
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
    const userId = req.user.id;
    const userRole = req.user.role;

    // Vérifier que l'utilisateur est l'instructeur ou un admin
    const checkQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(checkQuery, [id]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (courses[0].instructor_id !== userId && userRole !== 'admin') {
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
        values.push(req.body[field]);
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
    const userId = req.user.id;
    const userRole = req.user.role;

    // Vérifier les permissions
    const checkQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(checkQuery, [id]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (courses[0].instructor_id !== userId && userRole !== 'admin') {
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
    const { courseId } = req.params;
    const { title, description, content, video_url, duration_minutes } = req.body;
    const userId = req.user.id;

    // Vérifier que l'utilisateur est l'instructeur du cours
    const checkQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(checkQuery, [courseId]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (courses[0].instructor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à ajouter une leçon à ce cours'
      });
    }

    // Récupérer le prochain index
    const orderQuery = 'SELECT MAX(order_index) as max_order FROM lessons WHERE course_id = ?';
    const [orderResult] = await pool.execute(orderQuery, [courseId]);
    const nextOrder = (orderResult[0].max_order || 0) + 1;

    const query = `
      INSERT INTO lessons (course_id, title, description, content, video_url, duration_minutes, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      courseId, title, description, content, video_url, duration_minutes, nextOrder
    ]);

    res.status(201).json({
      success: true,
      message: 'Leçon ajoutée avec succès',
      data: {
        lesson_id: result.insertId
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
    const { courseId, lessonId } = req.params;
    const userId = req.user.id;
    const { title, description, content, video_url, duration_minutes, order_index } = req.body;

    // Vérifier que l'utilisateur est l'instructeur du cours
    const checkQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(checkQuery, [courseId]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (courses[0].instructor_id !== userId) {
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
    const { courseId, lessonId } = req.params;
    const userId = req.user.id;

    // Vérifier que l'utilisateur est l'instructeur du cours
    const checkQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(checkQuery, [courseId]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (courses[0].instructor_id !== userId) {
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

// Récupérer les cours de l'utilisateur connecté
const getMyCourses = async (req, res) => {
  try {
    const userId = req.user.userId;
    
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
    const { courseId } = req.params;
    const userId = req.user.id;

    // Vérifier que l'utilisateur est inscrit au cours
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

    // Récupérer les leçons du cours
    const [lessons] = await pool.execute(`
      SELECT 
        l.*,
        lp.is_completed,
        lp.completed_at
      FROM lessons l
      LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = ?
      WHERE l.course_id = ?
      ORDER BY l.order_index ASC
    `, [userId, courseId]);

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
    const userId = req.user.id;
    
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
      category: {
        id: course.category_id,
        name: course.category_name,
        color: course.category_color
      },
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
    const userId = req.user.id;

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