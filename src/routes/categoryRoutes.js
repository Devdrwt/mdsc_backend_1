const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes publiques
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategory);

// Routes admin seulement
router.post('/', 
  authenticateToken, 
  authorize(['admin']), 
  categoryController.createCategory
);

router.put('/:id', 
  authenticateToken, 
  authorize(['admin']), 
  categoryController.updateCategory
);

router.delete('/:id', 
  authenticateToken, 
  authorize(['admin']), 
  categoryController.deleteCategory
);

router.put('/:id/toggle-status', 
  authenticateToken, 
  authorize(['admin']), 
  categoryController.toggleCategoryStatus
);

module.exports = router;