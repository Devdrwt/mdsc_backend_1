const { pool } = require('../config/database');

// Créer une leçon
const createLesson = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, content, video_url, duration_minutes, order_index, is_published } = req.body;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire du cours
    const courseQuery = 'SELECT id FROM courses WHERE id = ? AND instructor_id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId, instructorId]);

    if (courses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier ce cours'
      });
    }

    // Insérer la leçon
    const insertQuery = `
      INSERT INTO lessons (
        course_id, title, description, content, video_url, 
        duration_minutes, order_index, is_published, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      courseId, title, description, content, video_url,
      duration_minutes, order_index, is_published || false
    ]);

    res.status(201).json({
      success: true,
      message: 'Leçon créée avec succès',
      data: {
        id: result.insertId,
        course_id: courseId,
        title,
        order_index
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création de la leçon:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la leçon'
    });
  }
};

// Récupérer les leçons d'un cours
const getCourseLessons = async (req, res) => {
  try {
    const { courseId } = req.params;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire du cours
    const courseQuery = 'SELECT id FROM courses WHERE id = ? AND instructor_id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId, instructorId]);

    if (courses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à voir ce cours'
      });
    }

    // Récupérer les leçons
    const lessonsQuery = `
      SELECT 
        id, title, description, content, video_url, 
        duration_minutes, order_index, is_published, 
        created_at, updated_at
      FROM lessons 
      WHERE course_id = ?
      ORDER BY order_index ASC, created_at ASC
    `;

    const [lessons] = await pool.execute(lessonsQuery, [courseId]);

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

// Récupérer une leçon spécifique
const getLesson = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire du cours
    const courseQuery = 'SELECT id FROM courses WHERE id = ? AND instructor_id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId, instructorId]);

    if (courses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à voir ce cours'
      });
    }

    // Récupérer la leçon
    const lessonQuery = `
      SELECT 
        id, title, description, content, video_url, 
        duration_minutes, order_index, is_published, 
        created_at, updated_at
      FROM lessons 
      WHERE id = ? AND course_id = ?
    `;

    const [lessons] = await pool.execute(lessonQuery, [lessonId, courseId]);

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leçon non trouvée'
      });
    }

    res.json({
      success: true,
      data: lessons[0]
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la leçon:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la leçon'
    });
  }
};

// Modifier une leçon
const updateLesson = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const { title, description, content, video_url, duration_minutes, order_index, is_published } = req.body;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire du cours
    const courseQuery = 'SELECT id FROM courses WHERE id = ? AND instructor_id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId, instructorId]);

    if (courses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier ce cours'
      });
    }

    // Vérifier que la leçon existe
    const lessonQuery = 'SELECT id FROM lessons WHERE id = ? AND course_id = ?';
    const [lessons] = await pool.execute(lessonQuery, [lessonId, courseId]);

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leçon non trouvée'
      });
    }

    // Mettre à jour la leçon
    const updateQuery = `
      UPDATE lessons SET
        title = ?, description = ?, content = ?, video_url = ?,
        duration_minutes = ?, order_index = ?, is_published = ?,
        updated_at = NOW()
      WHERE id = ? AND course_id = ?
    `;

    await pool.execute(updateQuery, [
      title, description, content, video_url,
      duration_minutes, order_index, is_published,
      lessonId, courseId
    ]);

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
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire du cours
    const courseQuery = 'SELECT id FROM courses WHERE id = ? AND instructor_id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId, instructorId]);

    if (courses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier ce cours'
      });
    }

    // Vérifier que la leçon existe
    const lessonQuery = 'SELECT id FROM lessons WHERE id = ? AND course_id = ?';
    const [lessons] = await pool.execute(lessonQuery, [lessonId, courseId]);

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leçon non trouvée'
      });
    }

    // Supprimer la leçon
    await pool.execute('DELETE FROM lessons WHERE id = ? AND course_id = ?', [lessonId, courseId]);

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

// Réorganiser les leçons
const reorderLessons = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { lessons } = req.body; // Array of {id, order_index}
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire du cours
    const courseQuery = 'SELECT id FROM courses WHERE id = ? AND instructor_id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId, instructorId]);

    if (courses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier ce cours'
      });
    }

    // Mettre à jour l'ordre des leçons
    const updatePromises = lessons.map(lesson => 
      pool.execute(
        'UPDATE lessons SET order_index = ? WHERE id = ? AND course_id = ?',
        [lesson.order_index, lesson.id, courseId]
      )
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: 'Ordre des leçons mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la réorganisation des leçons:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réorganisation des leçons'
    });
  }
};

module.exports = {
  createLesson,
  getCourseLessons,
  getLesson,
  updateLesson,
  deleteLesson,
  reorderLessons
};
