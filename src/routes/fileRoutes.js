const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes pour les fichiers (profil et cours)
// Utiliser uploadCourse qui accepte images et vidéos, le contrôleur routera selon la catégorie
router.post('/upload', 
  authenticateToken,
  fileController.uploadCourse.single('file'),
  (req, res, next) => {
    // Vérifier si c'est une catégorie de cours
    let options = {};
    try {
      options = req.body.options ? JSON.parse(req.body.options) : {};
    } catch (e) {
      // Ignorer
    }
    
    const category = options.category || req.body.category;
    
    if (category === 'course_thumbnail' || category === 'course_intro_video') {
      return fileController.uploadCourseFile(req, res);
    }
    
    // Si ce n'est pas une catégorie de cours, utiliser uploadProfileFile
    // Le fichier est déjà dans le bon dossier grâce à courseStorage
    return fileController.uploadProfileFile(req, res);
  }
);

router.get('/my-files', 
  authenticateToken, 
  fileController.getUserFiles
);

// Alias attendu par le front
router.get('/my', 
  authenticateToken, 
  fileController.getUserFiles
);

router.delete('/:fileId', 
  authenticateToken, 
  fileController.deleteProfileFile
);

// Routes admin pour la vérification des fichiers
router.get('/pending', 
  authenticateToken, 
  authorize(['admin']), 
  fileController.getPendingFiles
);

router.put('/:fileId/verify', 
  authenticateToken, 
  authorize(['admin']), 
  fileController.verifyFile
);

module.exports = router;
