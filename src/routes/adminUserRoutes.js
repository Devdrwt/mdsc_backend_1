const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/adminUserController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.get(
  '/users',
  authenticateToken,
  authorize(['admin']),
  adminUserController.getUsers
);

router.post(
  '/users/:userId/promote',
  authenticateToken,
  authorize(['admin']),
  adminUserController.promoteUser
);

router.post(
  '/users/:userId/demote',
  authenticateToken,
  authorize(['admin']),
  adminUserController.demoteUser
);

router.patch(
  '/users/:userId/role',
  authenticateToken,
  authorize(['admin']),
  adminUserController.updateUserRole
);

router.delete(
  '/users/:userId',
  authenticateToken,
  authorize(['admin']),
  adminUserController.deleteUser
);

module.exports = router;

