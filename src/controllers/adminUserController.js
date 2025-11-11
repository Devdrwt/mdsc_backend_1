const { pool } = require('../config/database');
const { buildMediaUrl } = require('../utils/media');

const ROLE_HIERARCHY = ['student', 'instructor', 'admin'];

const ensureAdmin = (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Accès réservé aux administrateurs'
    });
    return false;
  }
  return true;
};

const ensureAdminOrInstructor = (req, res) => {
  const role = req.user?.role;
  if (!role || (role !== 'admin' && role !== 'instructor')) {
    res.status(403).json({
      success: false,
      message: 'Accès réservé aux administrateurs ou instructeurs'
    });
    return false;
  }
  return true;
};

const parseLimit = (value, fallback = 20, min = 1, max = 100) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const parseOffset = (value) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

const USER_SELECT = `
SELECT
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.role,
  u.is_active,
  u.profile_picture,
  u.created_at,
  u.updated_at,
  u.last_login_at,
  COALESCE(stats.courses_enrolled, 0) AS courses_enrolled,
  COALESCE(stats.courses_completed, 0) AS courses_completed
FROM users u
LEFT JOIN (
  SELECT
    user_id,
    COUNT(*) AS courses_enrolled,
    SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS courses_completed
  FROM enrollments
  GROUP BY user_id
) stats ON stats.user_id = u.id
`;

const formatUser = (row) => ({
  id: row.id,
  first_name: row.first_name,
  last_name: row.last_name,
  email: row.email,
  role: row.role,
  is_active: Boolean(row.is_active),
  created_at: row.created_at,
  updated_at: row.updated_at,
  last_login_at: row.last_login_at,
  lastLogin: row.last_login_at,
  coursesEnrolled: Number(row.courses_enrolled || 0),
  coursesCompleted: Number(row.courses_completed || 0),
  courses: Number(row.courses_enrolled || 0),
  profile_picture: row.profile_picture,
  profile_picture_url: buildMediaUrl(row.profile_picture)
});

const getUsers = async (req, res) => {
  if (!ensureAdminOrInstructor(req, res)) {
    return;
  }

  try {
    const limit = parseLimit(req.query.limit, 20, 1, 100);
    const offset = parseOffset(req.query.offset);
    const search = (req.query.search || '').trim();
    const roleFilter = (req.query.role || '').trim().toLowerCase();
    const statusFilter = (req.query.status || '').trim().toLowerCase();

    const whereClauses = [];
    const params = [];

    if (roleFilter && ROLE_HIERARCHY.includes(roleFilter)) {
      whereClauses.push('u.role = ?');
      params.push(roleFilter);
    }

    if (statusFilter === 'active') {
      whereClauses.push('u.is_active = TRUE');
    } else if (statusFilter === 'inactive') {
      whereClauses.push('u.is_active = FALSE');
    }

    if (search) {
      whereClauses.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      const likeSearch = `%${search}%`;
      params.push(likeSearch, likeSearch, likeSearch);
    }

    const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `${USER_SELECT}
${whereClause}
ORDER BY u.created_at DESC
LIMIT ?
OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total = 0 } = {}]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        users: rows.map(formatUser),
        pagination: {
          limit,
          offset,
          total: Number(total || 0),
          pages: limit === 0 ? 0 : Math.ceil(Number(total || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Erreur liste utilisateurs admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer la liste des utilisateurs'
    });
  }
};

const fetchUserWithStats = async (userId) => {
  const [rows] = await pool.execute(
    `${USER_SELECT}
WHERE u.id = ?
LIMIT 1`,
    [userId]
  );

  if (!rows.length) {
    return null;
  }

  return formatUser(rows[0]);
};

const promoteUser = async (req, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({
      success: false,
      message: 'Identifiant utilisateur invalide'
    });
    return;
  }

  try {
    const [[user]] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
      return;
    }

    const currentRole = user.role || 'student';
    const currentIndex = ROLE_HIERARCHY.indexOf(currentRole);
    if (currentIndex === -1) {
      res.status(400).json({
        success: false,
        message: 'Rôle actuel invalide'
      });
      return;
    }

    const requestedRole = (req.body?.role || req.query?.role || '').trim().toLowerCase();

    let targetRole;
    if (requestedRole) {
      if (!ROLE_HIERARCHY.includes(requestedRole)) {
        res.status(400).json({
          success: false,
          message: 'Rôle cible invalide'
        });
        return;
      }
      if (ROLE_HIERARCHY.indexOf(requestedRole) <= currentIndex) {
        res.status(400).json({
          success: false,
          message: 'Le rôle demandé n\'est pas supérieur au rôle actuel'
        });
        return;
      }
      targetRole = requestedRole;
    } else {
      if (currentIndex === ROLE_HIERARCHY.length - 1) {
        res.status(400).json({
          success: false,
          message: 'L\'utilisateur possède déjà le rôle le plus élevé'
        });
        return;
      }
      targetRole = ROLE_HIERARCHY[currentIndex + 1];
    }

    await pool.execute(
      'UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?',
      [targetRole, userId]
    );

    const updatedUser = await fetchUserWithStats(userId);

    res.json({
      success: true,
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('Erreur promotion utilisateur admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de promouvoir l\'utilisateur'
    });
  }
};

const demoteUser = async (req, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({
      success: false,
      message: 'Identifiant utilisateur invalide'
    });
    return;
  }

  try {
    const [[user]] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
      return;
    }

    const currentRole = user.role || 'student';
    const currentIndex = ROLE_HIERARCHY.indexOf(currentRole);
    if (currentIndex === -1) {
      res.status(400).json({
        success: false,
        message: 'Rôle actuel invalide'
      });
      return;
    }

    const requestedRole = (req.body?.role || req.query?.role || '').trim().toLowerCase();

    let targetRole;
    if (requestedRole) {
      if (!ROLE_HIERARCHY.includes(requestedRole)) {
        res.status(400).json({
          success: false,
          message: 'Rôle cible invalide'
        });
        return;
      }
      if (ROLE_HIERARCHY.indexOf(requestedRole) >= currentIndex) {
        res.status(400).json({
          success: false,
          message: 'Le rôle demandé n\'est pas inférieur au rôle actuel'
        });
        return;
      }
      targetRole = requestedRole;
    } else {
      if (currentIndex === 0) {
        res.status(400).json({
          success: false,
          message: 'L\'utilisateur possède déjà le rôle le plus bas'
        });
        return;
      }
      targetRole = ROLE_HIERARCHY[currentIndex - 1];
    }

    await pool.execute(
      'UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?',
      [targetRole, userId]
    );

    const updatedUser = await fetchUserWithStats(userId);

    res.json({
      success: true,
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('Erreur déclassement utilisateur admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de déclasser l\'utilisateur'
    });
  }
};

const updateUserRole = async (req, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({
      success: false,
      message: 'Identifiant utilisateur invalide'
    });
    return;
  }

  const requestedRole = (req.body?.role || '').trim().toLowerCase();
  if (!ROLE_HIERARCHY.includes(requestedRole)) {
    res.status(400).json({
      success: false,
      message: 'Rôle cible invalide'
    });
    return;
  }

  try {
    const [[user]] = await pool.execute(
      'SELECT id, role FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
      return;
    }

    if (user.role === requestedRole) {
      const current = await fetchUserWithStats(userId);
      res.json({
        success: true,
        data: { user: current }
      });
      return;
    }

    await pool.execute(
      'UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?',
      [requestedRole, userId]
    );

    const updated = await fetchUserWithStats(userId);

    res.json({
      success: true,
      data: {
        user: updated
      }
    });
  } catch (error) {
    console.error('Erreur mise à jour rôle utilisateur admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de mettre à jour le rôle de l\'utilisateur'
    });
  }
};

const deleteUser = async (req, res) => {
  if (!ensureAdmin(req, res)) {
    return;
  }

  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({
      success: false,
      message: 'Identifiant utilisateur invalide'
    });
    return;
  }

  try {
    const [[user]] = await pool.execute(
      'SELECT id FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur introuvable'
      });
      return;
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      data: {
        user_id: userId
      }
    });
  } catch (error) {
    console.error('Erreur suppression utilisateur admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de supprimer l\'utilisateur'
    });
  }
};

module.exports = {
  getUsers,
  promoteUser,
  demoteUser,
  updateUserRole,
  deleteUser
};

