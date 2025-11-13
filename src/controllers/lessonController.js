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

    // Insérer la leçon avec support modules et content_type
    const { module_id, content_type = 'text', media_file_id, content_url, content_text, is_required = true } = req.body;

    const insertQuery = `
      INSERT INTO lessons (
        course_id, module_id, title, content_type, media_file_id, content_url, 
        description, content, content_text, video_url, 
        duration_minutes, order_index, is_required, is_published, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      courseId, module_id || null, title, content_type, media_file_id || null, content_url || null,
      description, content || null, content_text || null, video_url || null,
      duration_minutes || 0, order_index || 0, is_required, is_published || false
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

    // Récupérer les leçons avec modules et médias
    const lessonsQuery = `
      SELECT 
        l.id, l.module_id, l.title, l.content_type, l.media_file_id, 
        l.content_url, l.description, l.content, l.content_text, l.video_url, 
        l.duration_minutes, l.order_index, l.is_required, l.is_published, 
        l.created_at, l.updated_at,
        m.title as module_title, m.order_index as module_order,
        mf.url as media_url, mf.thumbnail_url, mf.file_category
      FROM lessons l
      LEFT JOIN modules m ON l.module_id = m.id
      LEFT JOIN media_files mf ON l.media_file_id = mf.id
      WHERE l.course_id = ?
      ORDER BY COALESCE(m.order_index, 0), l.order_index ASC, l.created_at ASC
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

    // Récupérer la leçon avec détails
    // Récupérer aussi les fichiers via lesson_id si media_file_id est NULL
    const lessonQuery = `
      SELECT 
        l.*,
        m.title as module_title, m.order_index as module_order,
        mf.url as media_url, 
        mf.thumbnail_url, 
        mf.file_category, 
        mf.file_type,
        mf.filename,
        mf.original_filename,
        mf.file_size,
        mf.id as media_file_id_from_join,
        q.id as quiz_id, q.title as quiz_title
      FROM lessons l
      LEFT JOIN modules m ON l.module_id = m.id
      LEFT JOIN media_files mf ON (
        l.media_file_id = mf.id 
        OR (l.id = mf.lesson_id AND l.media_file_id IS NULL)
      )
      LEFT JOIN quizzes q ON l.id = q.lesson_id
      WHERE l.id = ? AND l.course_id = ?
      ORDER BY mf.uploaded_at DESC
      LIMIT 1
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

    // Mettre à jour la leçon avec support modules
    const { module_id, content_type, media_file_id, content_url, content_text, is_required } = req.body;

    const updateFields = [];
    const params = [];

    if (title !== undefined) { updateFields.push('title = ?'); params.push(title); }
    if (module_id !== undefined) { updateFields.push('module_id = ?'); params.push(module_id || null); }
    if (content_type !== undefined) { updateFields.push('content_type = ?'); params.push(content_type); }
    if (media_file_id !== undefined) { updateFields.push('media_file_id = ?'); params.push(media_file_id || null); }
    if (content_url !== undefined) { updateFields.push('content_url = ?'); params.push(content_url || null); }
    if (description !== undefined) { updateFields.push('description = ?'); params.push(description); }
    if (content !== undefined) { updateFields.push('content = ?'); params.push(content); }
    if (content_text !== undefined) { updateFields.push('content_text = ?'); params.push(content_text); }
    if (video_url !== undefined) { updateFields.push('video_url = ?'); params.push(video_url); }
    if (duration_minutes !== undefined) { updateFields.push('duration_minutes = ?'); params.push(duration_minutes); }
    if (order_index !== undefined) { updateFields.push('order_index = ?'); params.push(order_index); }
    if (is_required !== undefined) { updateFields.push('is_required = ?'); params.push(is_required); }
    if (is_published !== undefined) { updateFields.push('is_published = ?'); params.push(is_published); }

    updateFields.push('updated_at = NOW()');
    params.push(lessonId, courseId);

    const updateQuery = `
      UPDATE lessons SET ${updateFields.join(', ')}
      WHERE id = ? AND course_id = ?
    `;

    await pool.execute(updateQuery, params);

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
