const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');

const parseEvents = (rows = []) => {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    event_type: row.event_type,
    course_id: row.course_id,
    start_date: row.start_date,
    end_date: row.end_date,
    is_all_day: Boolean(row.is_all_day),
    location: row.location,
    is_public: Boolean(row.is_public),
    created_by: row.created_by
      ? {
          id: row.created_by,
          first_name: row.creator_first_name,
          last_name: row.creator_last_name,
          email: row.creator_email,
          role: row.creator_role
        }
      : null,
    course: row.course_id
      ? {
          id: row.course_id,
          title: row.course_title,
          slug: row.course_slug
        }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
};

const listEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      course_id,
      event_type,
      start,
      end
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const offset = (pageNum - 1) * pageSize;

    const where = [];
    const params = [];

    if (course_id) {
      where.push('e.course_id = ?');
      params.push(course_id);
    }

    if (event_type) {
      where.push('e.event_type = ?');
      params.push(event_type);
    }

    if (start) {
      where.push('e.start_date >= ?');
      params.push(new Date(start));
    }

    if (end) {
      where.push('e.start_date <= ?');
      params.push(new Date(end));
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `
      SELECT
        e.*,
        c.title AS course_title,
        c.slug AS course_slug,
        creator.first_name AS creator_first_name,
        creator.last_name AS creator_last_name,
        creator.email AS creator_email,
        creator.role AS creator_role
      FROM events e
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN users creator ON creator.id = e.created_by
      ${whereClause}
      ORDER BY e.start_date DESC
      LIMIT ? OFFSET ?
    `,
      [...params, pageSize, offset]
    );

    const [[{ total = 0 } = {}]] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM events e
      ${whereClause}
    `,
      params
    );

    res.json({
      success: true,
      data: {
        events: parseEvents(rows),
        pagination: {
          page: pageNum,
          limit: pageSize,
          total: Number(total),
          pages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    console.error('Erreur liste événements admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les événements'
    });
  }
};

const createEvent = async (req, res) => {
  try {
    const adminId = req.user?.id ?? req.user?.userId;
    const {
      title,
      description,
      event_type,
      course_id,
      start_date,
      end_date,
      is_all_day = false,
      location,
      is_public = true
    } = req.body;

    if (!title || !event_type || !start_date) {
      return res.status(400).json({
        success: false,
        message: 'title, event_type et start_date sont requis'
      });
    }

    if (course_id) {
      const [courses] = await pool.execute(
        'SELECT id FROM courses WHERE id = ?',
        [course_id]
      );
      if (!courses.length) {
        return res.status(404).json({
          success: false,
          message: 'Cours associé introuvable'
        });
      }
    }

    const [result] = await pool.execute(
      `
      INSERT INTO events (
        course_id,
        title,
        description,
        event_type,
        start_date,
        end_date,
        is_all_day,
        location,
        is_public,
        created_by,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
      [
        sanitizeValue(course_id),
        sanitizeValue(title),
        sanitizeValue(description),
        sanitizeValue(event_type),
        sanitizeValue(start_date),
        sanitizeValue(end_date),
        Boolean(is_all_day),
        sanitizeValue(location),
        Boolean(is_public),
        adminId
      ]
    );

    const [rows] = await pool.execute(
      `
      SELECT
        e.*,
        c.title AS course_title,
        c.slug AS course_slug,
        creator.first_name AS creator_first_name,
        creator.last_name AS creator_last_name,
        creator.email AS creator_email,
        creator.role AS creator_role
      FROM events e
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN users creator ON creator.id = e.created_by
      WHERE e.id = ?
    `,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Événement créé',
      data: parseEvents(rows)[0]
    });
  } catch (error) {
    console.error('Erreur création événement admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de créer l\'événement'
    });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      event_type,
      course_id,
      start_date,
      end_date,
      is_all_day,
      location,
      is_public
    } = req.body;

    const [events] = await pool.execute(
      'SELECT * FROM events WHERE id = ?',
      [id]
    );

    if (!events.length) {
      return res.status(404).json({
        success: false,
        message: 'Événement introuvable'
      });
    }

    if (course_id) {
      const [courses] = await pool.execute(
        'SELECT id FROM courses WHERE id = ?',
        [course_id]
      );
      if (!courses.length) {
        return res.status(404).json({
          success: false,
          message: 'Cours associé introuvable'
        });
      }
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
    pushField('description', description);
    pushField('event_type', event_type);
    pushField('course_id', course_id);
    pushField('start_date', start_date);
    pushField('end_date', end_date);
    if (is_all_day !== undefined) {
      fields.push('is_all_day = ?');
      values.push(Boolean(is_all_day));
    }
    pushField('location', location);
    if (is_public !== undefined) {
      fields.push('is_public = ?');
      values.push(Boolean(is_public));
    }

    if (!fields.length) {
      return res.json({
        success: true,
        message: 'Aucune modification apportée'
      });
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.execute(
      `
      UPDATE events
      SET ${fields.join(', ')}
      WHERE id = ?
    `,
      values
    );

    res.json({
      success: true,
      message: 'Événement mis à jour'
    });
  } catch (error) {
    console.error('Erreur update événement admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de mettre à jour l\'événement'
    });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      'DELETE FROM events WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Événement supprimé'
    });
  } catch (error) {
    console.error('Erreur suppression événement admin:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de supprimer l\'événement'
    });
  }
};

module.exports = {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent
};

