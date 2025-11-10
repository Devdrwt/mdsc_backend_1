const { pool } = require('../config/database');

const parseJsonSafe = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const ensureAuthenticated = (req, res) => {
  const userId = req.user?.id ?? req.user?.userId ?? null;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Non authentifié'
    });
    return null;
  }

  return userId;
};

const getNotifications = async (req, res) => {
  const userId = ensureAuthenticated(req, res);
  if (!userId) return;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const type = req.query.type;
  const isReadFilter = req.query.is_read;

  try {
    const where = ['user_id = ?'];
    const params = [userId];

    if (type) {
      where.push('type = ?');
      params.push(type);
    }

    if (isReadFilter === 'true') {
      where.push('is_read = TRUE');
    } else if (isReadFilter === 'false') {
      where.push('is_read = FALSE');
    }

    where.push('(expires_at IS NULL OR expires_at >= NOW())');

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [notifications] = await pool.execute(
      `
      SELECT *
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset]
    );

    const [[{ total = 0 } = {}]] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM notifications
      ${whereClause}
    `,
      params
    );

    res.json({
      success: true,
      data: {
        notifications: notifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          is_read: Boolean(notification.is_read),
          action_url: notification.action_url,
          metadata: parseJsonSafe(notification.metadata),
          created_at: notification.created_at,
          read_at: notification.read_at,
          expires_at: notification.expires_at
        })),
        pagination: {
          page,
          limit,
          total: Number(total),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Erreur notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les notifications'
    });
  }
};

const markNotificationAsRead = async (req, res) => {
  const userId = ensureAuthenticated(req, res);
  if (!userId) return;

  const { id } = req.params;

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: 'Notification introuvable'
      });
    }

    await pool.execute(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Notification marquée comme lue'
    });
  } catch (error) {
    console.error('Erreur mark read:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de marquer la notification'
    });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  const userId = ensureAuthenticated(req, res);
  if (!userId) return;

  try {
    await pool.execute(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({
      success: true,
      message: 'Toutes les notifications ont été marquées comme lues'
    });
  } catch (error) {
    console.error('Erreur mark all read:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de marquer les notifications'
    });
  }
};

const deleteNotification = async (req, res) => {
  const userId = ensureAuthenticated(req, res);
  if (!userId) return;

  const { id } = req.params;

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: 'Notification introuvable'
      });
    }

    await pool.execute('DELETE FROM notifications WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Notification supprimée'
    });
  } catch (error) {
    console.error('Erreur suppression notification:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de supprimer la notification'
    });
  }
};

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
};

