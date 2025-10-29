const { pool } = require('../config/database');
const ModuleService = require('../services/moduleService');

/**
 * Contrôleur pour la gestion des modules
 */

// Récupérer tous les modules d'un cours
const getCourseModules = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { include_lessons } = req.query;

    // Vérifier que le cours existe
    const courseQuery = 'SELECT id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const modules = await ModuleService.getModulesByCourse(
      courseId,
      include_lessons === 'true'
    );

    res.json({
      success: true,
      data: modules
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des modules:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des modules'
    });
  }
};

// Récupérer un module par ID
const getModuleById = async (req, res) => {
  try {
    const { id } = req.params;
    const { include_lessons } = req.query;

    const module = await ModuleService.getModuleById(
      id,
      include_lessons === 'true'
    );

    res.json({
      success: true,
      data: module
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du module:', error);
    
    if (error.message === 'Module non trouvé') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du module'
    });
  }
};

// Créer un module (Instructeur/Admin)
const createModule = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, order_index } = req.body;
    const userId = req.user.id;

    // Vérifier que l'utilisateur est propriétaire du cours
    const courseQuery = 'SELECT id, instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (courses[0].instructor_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier ce cours'
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Le titre est requis'
      });
    }

    const module = await ModuleService.createModule(courseId, {
      title,
      description,
      order_index: order_index || 0
    });

    res.status(201).json({
      success: true,
      message: 'Module créé avec succès',
      data: module
    });

  } catch (error) {
    console.error('Erreur lors de la création du module:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du module'
    });
  }
};

// Mettre à jour un module
const updateModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, order_index, is_unlocked } = req.body;
    const userId = req.user.id;

    // Vérifier les permissions
    const module = await ModuleService.getModuleById(id);
    const courseQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(courseQuery, [module.course_id]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    if (courses[0].instructor_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier ce module'
      });
    }

    const updatedModule = await ModuleService.updateModule(id, {
      title,
      description,
      order_index,
      is_unlocked
    });

    res.json({
      success: true,
      message: 'Module mis à jour avec succès',
      data: updatedModule
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du module:', error);
    
    if (error.message === 'Module non trouvé') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du module'
    });
  }
};

// Supprimer un module
const deleteModule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Vérifier les permissions
    const module = await ModuleService.getModuleById(id);
    const courseQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
    const [courses] = await pool.execute(courseQuery, [module.course_id]);

    if (courses[0].instructor_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à supprimer ce module'
      });
    }

    await ModuleService.deleteModule(id);

    res.json({
      success: true,
      message: 'Module supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du module:', error);
    
    if (error.message === 'Module non trouvé') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du module'
    });
  }
};

// Déverrouiller un module pour un utilisateur
const unlockModule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const unlockStatus = await ModuleService.unlockModuleForUser(id, userId);

    res.json({
      success: true,
      data: unlockStatus
    });

  } catch (error) {
    console.error('Erreur lors du déverrouillage du module:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du déverrouillage du module'
    });
  }
};

// Obtenir le statut de déverrouillage de tous les modules d'un cours
const getModulesUnlockStatus = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const status = await ModuleService.getModulesUnlockStatus(courseId, userId);

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut'
    });
  }
};

module.exports = {
  getCourseModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule,
  unlockModule,
  getModulesUnlockStatus
};

