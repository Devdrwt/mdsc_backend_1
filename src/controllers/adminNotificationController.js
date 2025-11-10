const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');

const parseJsonSafe = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const stringifyMetadata = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return null;
  }
};

const listNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      user_id,
      type,
      is_read
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const offset = (pageNum - 1) * pageSize;

    const where = [];
    const params = [];

    if (user_id) {
      where.push('n.user_id = ?');
      params.push(user_id);
    }

    if (type) {
      where.push('n.type = ?');
      params.push(type);
    }

    if (is_read === 'true') {
      where.push('n.is_read = TRUE');
    } else if (is_read === 'false') {
      where.push('n.is_read = FALSE');
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `
      SELECT
        n.*,
        u.first_name,
        u.last_name,
        u.email,
        u.role
      FROM notifications n
      JOIN users u ON u.id = n.user_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, pageSize, offset]
    );

    const [[{ total = 0 } = {}]] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM notifications n
      ${whereClause}
    `,
      params
    );

    res.json({
      success: true,
      data: {
        notifications: rows.map((notification) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          is_read: Boolean(notification.is_read),
          action_url: notification.action_url,
          metadata: parseJsonSafe(notification.metadata),
          created_at: notification.created_at,
          read_at: notification.read_at,
          expires_at: notification.expires_at,
          user: {
            id: notification.user_id,
            first_name: notification.first_name,
            last_name: notification.last_name,
            email: notification.email,
            role: notification.role
          }
        })),
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: Number(total),
          pages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    console.error('Erreur liste notifications admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les notifications'
    });
  }
};

const createNotification = async (req, res) => {
  try {
    const {
      user_id,
      title,
      message,
      type = 'info',
      action_url,
      metadata,
      expires_at
    } = req.body;

    if (!user_id || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'user_id, title et message sont requis'
      });
    }

    const [users] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [user_id]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur cible introuvable'
      });
    }

    const [result] = await pool.execute(
      `
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        is_read,
        action_url,
        metadata,
        expires_at
      ) VALUES (?, ?, ?, ?, FALSE, ?, ?, ?)
    `,
      [
        sanitizeValue(user_id),
        sanitizeValue(title),
        sanitizeValue(message),
        sanitizeValue(type),
        sanitizeValue(action_url),
        sanitizeValue(stringifyMetadata(metadata)),
        sanitizeValue(expires_at)
      ]
    );

    const [rows] = await pool.execute(
      `
      SELECT
        n.*,
        u.first_name,
        u.last_name,
        u.email,
        u.role
      FROM notifications n
      JOIN users u ON u.id = n.user_id
      WHERE n.id = ?
    `,
      [result.insertId]
    );

    const created = rows[0];

    res.status(201).json({
      success: true,
      message: 'Notification créée',
      data: {
        id: created.id,
        title: created.title,
        message: created.message,
        type: created.type,
        is_read: Boolean(created.is_read),
        action_url: created.action_url,
        metadata: parseJsonSafe(created.metadata),
        created_at: created.created_at,
        read_at: created.read_at,
        expires_at: created.expires_at,
        user: {
          id: created.user_id,
          first_name: created.first_name,
          last_name: created.last_name,
          email: created.email,
          role: created.role
        }
      }
    });
  } catch (error) {
    console.error('Erreur création notification admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de créer la notification'
    });
  }
};

const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      message,
      type,
      action_url,
      metadata,
      expires_at,
      is_read
    } = req.body;

    const [existingRows] = await pool.execute(
      'SELECT * FROM notifications WHERE id = ?',
      [id]
    );

    if (!existingRows.length) {
      return res.status(404).json({
        success: false,
        message: 'Notification introuvable'
      });
    }

    const fields = [];
    const values = [];

    const pushField = (field, value) => {
      if (value !== undefined) {
        fields.push(`${field} = ?`);
        values.push(sanitizeValue(value));
      }
    };

    pushField('title', title);
    pushField('message', message);
    pushField('type', type);
    pushField('action_url', action_url);
    if (metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(sanitizeValue(stringifyMetadata(metadata)));
    }
    pushField('expires_at', expires_at);
    if (is_read !== undefined) {
      fields.push('is_read = ?');
      values.push(Boolean(is_read));
      if (is_read) {
        fields.push('read_at = COALESCE(read_at, NOW())');
      } else {
        fields.push('read_at = NULL');
      }
    }

    if (!fields.length) {
      return res.json({
        success: true,
        message: 'Aucune modification apportée'
      });
    }

    values.push(id);

    await pool.execute(
      `
      UPDATE notifications
      SET ${fields.join(', ')}
      WHERE id = ?
    `,
      values
    );

    res.json({
      success: true,
      message: 'Notification mise à jour'
    });
  } catch (error) {
    console.error('Erreur update notification admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de mettre à jour la notification'
    });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      'DELETE FROM notifications WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Notification supprimée'
    });
  } catch (error) {
    console.error('Erreur suppression notification admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de supprimer la notification'
    });
  }
};

module.exports = {
  listNotifications,
  createNotification,
  updateNotification,
  deleteNotification
};

