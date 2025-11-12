const { pool } = require('../config/database');
const { buildMediaUrl } = require('../utils/media');

/**
 * Service de gestion des modules
 */
class ModuleService {
  /**
   * Récupérer tous les modules d'un cours
   */
  static async getModulesByCourse(courseId, includeLessons = false) {
    const query = `
      SELECT 
        m.*,
        COUNT(l.id) as lessons_count,
        COUNT(CASE WHEN l.is_published = TRUE THEN 1 END) as published_lessons_count
      FROM modules m
      LEFT JOIN lessons l ON m.id = l.module_id
      WHERE m.course_id = ?
      GROUP BY m.id
      ORDER BY m.order_index ASC
    `;

    const [modules] = await pool.execute(query, [courseId]);

    // Formater les URLs des images
    modules.forEach(module => {
      if (module.image_url) {
        module.image_url = buildMediaUrl(module.image_url);
      }
    });

    if (includeLessons) {
      for (const module of modules) {
        const lessonsQuery = `
          SELECT 
            l.*,
            mf.url as media_url,
            mf.thumbnail_url,
            mf.file_category
          FROM lessons l
          LEFT JOIN media_files mf ON l.media_file_id = mf.id
          WHERE l.module_id = ?
          ORDER BY l.order_index ASC
        `;
        const [lessons] = await pool.execute(lessonsQuery, [module.id]);
        module.lessons = lessons;
      }
    }

    return modules;
  }

  /**
   * Récupérer un module par ID
   */
  static async getModuleById(moduleId, includeLessons = false) {
    const query = `
      SELECT 
        m.*,
        c.title as course_title,
        c.instructor_id
      FROM modules m
      JOIN courses c ON m.course_id = c.id
      WHERE m.id = ?
    `;

    const [modules] = await pool.execute(query, [moduleId]);
    if (modules.length === 0) {
      throw new Error('Module non trouvé');
    }

    const module = modules[0];

    // Formater l'URL de l'image
    if (module.image_url) {
      module.image_url = buildMediaUrl(module.image_url);
    }

    if (includeLessons) {
      const lessonsQuery = `
        SELECT 
          l.*,
          mf.url as media_url,
          mf.thumbnail_url,
          mf.file_category
        FROM lessons l
        LEFT JOIN media_files mf ON l.media_file_id = mf.id
        WHERE l.module_id = ?
        ORDER BY l.order_index ASC
      `;
      const [lessons] = await pool.execute(lessonsQuery, [moduleId]);
      module.lessons = lessons;
    }

    return module;
  }

  /**
   * Créer un module
   */
  static async createModule(courseId, moduleData) {
    const { title, description, order_index, image_url } = moduleData;

    const query = `
      INSERT INTO modules (course_id, title, description, image_url, order_index, is_unlocked)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    // Si c'est le premier module, le déverrouiller
    const isFirst = order_index === 1 || order_index === 0;
    
    const [result] = await pool.execute(query, [
      courseId,
      title,
      description || null,
      image_url || null,
      order_index || 0,
      isFirst // Premier module toujours déverrouillé
    ]);

    // Récupérer le module créé avec l'image_url formatée
    const createdModule = await this.getModuleById(result.insertId);

    return createdModule;
  }

  /**
   * Mettre à jour un module
   */
  static async updateModule(moduleId, moduleData) {
    const { title, description, order_index, is_unlocked, image_url } = moduleData;

    const updateFields = [];
    const params = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      params.push(description);
    }
    if (image_url !== undefined) {
      updateFields.push('image_url = ?');
      params.push(image_url || null);
    }
    if (order_index !== undefined) {
      updateFields.push('order_index = ?');
      params.push(order_index);
    }
    if (is_unlocked !== undefined) {
      updateFields.push('is_unlocked = ?');
      params.push(is_unlocked);
    }

    if (updateFields.length === 0) {
      throw new Error('Aucune donnée à mettre à jour');
    }

    updateFields.push('updated_at = NOW()');
    params.push(moduleId);

    const query = `
      UPDATE modules
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await pool.execute(query, params);

    return this.getModuleById(moduleId);
  }

  /**
   * Supprimer un module
   */
  static async deleteModule(moduleId) {
    // Vérifier que le module existe
    const module = await this.getModuleById(moduleId);
    
    const query = 'DELETE FROM modules WHERE id = ?';
    await pool.execute(query, [moduleId]);

    return { success: true };
  }

  /**
   * Déverrouiller un module pour un utilisateur
   * Vérifie si toutes les leçons du module précédent sont complétées
   */
  static async unlockModuleForUser(moduleId, userId) {
    const module = await this.getModuleById(moduleId);
    
    // Si déjà déverrouillé globalement
    if (module.is_unlocked) {
      return { unlocked: true, reason: 'Module déverrouillé globalement' };
    }

    // Trouver le module précédent
    const previousModuleQuery = `
      SELECT id FROM modules
      WHERE course_id = ? AND order_index < ?
      ORDER BY order_index DESC
      LIMIT 1
    `;
    const [previousModules] = await pool.execute(previousModuleQuery, [
      module.course_id,
      module.order_index
    ]);

    if (previousModules.length === 0) {
      // C'est le premier module, le déverrouiller
      await this.updateModule(moduleId, { is_unlocked: true });
      return { unlocked: true, reason: 'Premier module du cours' };
    }

    const previousModuleId = previousModules[0].id;

    // Vérifier que toutes les leçons du module précédent sont complétées
    const checkQuery = `
      SELECT 
        COUNT(*) as total_lessons,
        COUNT(CASE WHEN lp.is_completed = TRUE THEN 1 END) as completed_lessons
      FROM lessons l
      LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = ?
      WHERE l.module_id = ? AND l.is_published = TRUE
    `;

    const [checkResult] = await pool.execute(checkQuery, [userId, previousModuleId]);
    const { total_lessons, completed_lessons } = checkResult[0];

    if (completed_lessons === total_lessons && total_lessons > 0) {
      // Toutes les leçons sont complétées, déverrouiller
      return { unlocked: true, reason: 'Module précédent complété' };
    }

    return {
      unlocked: false,
      reason: 'Module précédent non complété',
      progress: {
        completed: completed_lessons,
        total: total_lessons
      }
    };
  }

  /**
   * Vérifier l'état de déverrouillage de tous les modules d'un cours pour un utilisateur
   */
  static async getModulesUnlockStatus(courseId, userId) {
    const modules = await this.getModulesByCourse(courseId);
    const status = [];

    for (const module of modules) {
      const unlockStatus = await this.unlockModuleForUser(module.id, userId);
      status.push({
        module_id: module.id,
        title: module.title,
        order_index: module.order_index,
        ...unlockStatus
      });
    }

    return status;
  }
}

module.exports = ModuleService;

