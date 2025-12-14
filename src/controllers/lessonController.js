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
    const published = typeof is_published === 'boolean' ? is_published : true;

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
      duration_minutes || 0, order_index || 0, is_required, published
    ]);

    const newLessonId = result.insertId;

    // Si un media_file_id a été assigné, mettre à jour automatiquement le lesson_id du fichier média
    if (media_file_id) {
      await pool.execute(
        'UPDATE media_files SET lesson_id = ? WHERE id = ? AND course_id = ?',
        [newLessonId, media_file_id, courseId]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Leçon créée avec succès',
      data: {
        id: newLessonId,
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
        mf.url as media_url, mf.thumbnail_url, mf.file_category,
        mf.file_type, mf.file_size,
        COALESCE(l.content_url, mf.url) as final_content_url
      FROM lessons l
      LEFT JOIN modules m ON l.module_id = m.id
      LEFT JOIN media_files mf ON l.media_file_id = mf.id
      WHERE l.course_id = ?
      ORDER BY COALESCE(m.order_index, 0), l.order_index ASC, l.created_at ASC
    `;

    const [lessons] = await pool.execute(lessonsQuery, [courseId]);

    // Enrichir les leçons avec l'URL finale
    const enrichedLessons = lessons.map(lesson => ({
      ...lesson,
      content_url: lesson.final_content_url || lesson.content_url
    }));

    res.json({
      success: true,
      data: enrichedLessons
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

    // Si un media_file_id a été assigné, mettre à jour automatiquement le lesson_id du fichier média
    if (media_file_id) {
      await pool.execute(
        'UPDATE media_files SET lesson_id = ? WHERE id = ? AND course_id = ?',
        [lessonId, media_file_id, courseId]
      );
    }

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

// Récupérer une leçon pour un étudiant (avec vérification d'inscription)
const getLessonForStudent = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Vérifier que l'étudiant est inscrit au cours
    const [enrollments] = await pool.execute(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND is_active = TRUE',
      [userId, courseId]
    );

    if (enrollments.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas inscrit à ce cours'
      });
    }

    // Récupérer la leçon avec tous les détails et médias
    const lessonQuery = `
      SELECT 
        l.*,
        m.title as module_title, 
        m.order_index as module_order,
        mf.id as media_file_id_from_join,
        mf.url as media_url, 
        mf.thumbnail_url, 
        mf.file_category, 
        mf.file_type,
        mf.filename,
        mf.original_filename,
        mf.file_size,
        mf.duration as media_duration
      FROM lessons l
      LEFT JOIN modules m ON l.module_id = m.id
      LEFT JOIN media_files mf ON (
        l.media_file_id = mf.id 
        OR (l.id = mf.lesson_id AND l.media_file_id IS NULL)
      )
      WHERE l.id = ? AND l.course_id = ? AND l.is_published = TRUE
      ORDER BY mf.uploaded_at DESC
    `;

    const [lessons] = await pool.execute(lessonQuery, [lessonId, courseId]);

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leçon non trouvée'
      });
    }

    // Formater la réponse
    const lesson = lessons[0];

    // Récupérer tous les médias directement associés à la leçon
    const [directMedia] = await pool.execute(
      `SELECT 
        id, url, thumbnail_url, file_category, file_type,
        filename, original_filename, file_size, duration, lesson_id
      FROM media_files
      WHERE lesson_id = ? OR id = ?
      ORDER BY uploaded_at DESC`,
      [lessonId, lesson.media_file_id || 0]
    );

    // Récupérer tous les médias du cours qui pourraient être associés (y compris ceux sans lesson_id)
    const [allCourseMedia] = await pool.execute(
      `SELECT 
        id, url, thumbnail_url, file_category, file_type,
        filename, original_filename, file_size, duration, lesson_id, uploaded_at
      FROM media_files
      WHERE course_id = ?
      ORDER BY lesson_id, uploaded_at DESC`,
      [courseId]
    );

    const { buildMediaUrl } = require('../utils/media');

    // Si la leçon n'a pas de média direct, chercher dans les médias du cours non assignés
    let mediaFiles = directMedia.map(mf => ({
      id: mf.id,
      url: buildMediaUrl(mf.url),
      thumbnail_url: buildMediaUrl(mf.thumbnail_url),
      file_category: mf.file_category,
      file_type: mf.file_type,
      filename: mf.filename,
      original_filename: mf.original_filename,
      file_size: mf.file_size,
      duration: mf.duration
    }));

    // Si aucun média direct, chercher les médias non assignés du cours
    if (mediaFiles.length === 0) {
      const unassignedMedia = allCourseMedia
        .filter(m => !m.lesson_id)
        .sort((a, b) => new Date(a.uploaded_at || 0) - new Date(b.uploaded_at || 0));

      // Trouver l'index de la leçon dans le cours pour distribuer les médias
      const [allLessons] = await pool.execute(
        `SELECT id, order_index FROM lessons 
         WHERE course_id = ? AND is_published = TRUE 
         ORDER BY order_index ASC`,
        [courseId]
      );
      
      const lessonIndex = allLessons.findIndex(l => l.id === parseInt(lessonId));
      
      // Si on trouve un média non assigné correspondant à l'index de la leçon
      if (lessonIndex >= 0 && lessonIndex < unassignedMedia.length) {
        const assignedMedia = unassignedMedia[lessonIndex];
        mediaFiles = [{
          id: assignedMedia.id,
          url: buildMediaUrl(assignedMedia.url),
          thumbnail_url: buildMediaUrl(assignedMedia.thumbnail_url),
          file_category: assignedMedia.file_category,
          file_type: assignedMedia.file_type,
          filename: assignedMedia.filename,
          original_filename: assignedMedia.original_filename,
          file_size: assignedMedia.file_size,
          duration: assignedMedia.duration
        }];
      }
    }

    res.json({
      success: true,
      data: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        content_type: lesson.content_type,
        content: lesson.content,
        content_text: lesson.content_text,
        content_url: lesson.content_url ? buildMediaUrl(lesson.content_url) : null,
        video_url: lesson.video_url ? buildMediaUrl(lesson.video_url) : null,
        duration_minutes: lesson.duration_minutes,
        order_index: lesson.order_index,
        is_required: Boolean(lesson.is_required),
        module: lesson.module_title ? {
          id: lesson.module_id,
          title: lesson.module_title,
          order_index: lesson.module_order
        } : null,
        media_file: (lesson.media_file_id_from_join && lesson.media_url) ? {
          id: lesson.media_file_id_from_join,
          url: buildMediaUrl(lesson.media_url),
          thumbnail_url: buildMediaUrl(lesson.thumbnail_url),
          file_category: lesson.file_category,
          file_type: lesson.file_type,
          filename: lesson.filename,
          original_filename: lesson.original_filename,
          file_size: lesson.file_size,
          duration: lesson.media_duration
        } : (mediaFiles.length > 0 ? mediaFiles[0] : null),
        media_files: mediaFiles.length > 0 ? mediaFiles : null
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la leçon:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la leçon'
    });
  }
};

module.exports = {
  createLesson,
  getCourseLessons,
  getLesson,
  getLessonForStudent,
  updateLesson,
  deleteLesson,
  reorderLessons
};
