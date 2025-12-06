const { pool } = require('../config/database');

const ensureAuthenticated = (req, res) => {
  const user = req.user || {};
  const userId = user.id ?? user.userId ?? null;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Non authentifié'
    });
    return null;
  }

  return {
    id: userId,
    role: user.role || 'student'
  };
};

const parseBoolean = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
};

const getEvents = async (req, res) => {
  const user = ensureAuthenticated(req, res);
  if (!user) return;

  const rangeStart = req.query.start ? new Date(req.query.start) : null;
  const rangeEnd = req.query.end ? new Date(req.query.end) : null;
  const eventType = req.query.type;
  const onlyUpcoming = parseBoolean(req.query.upcoming);

  try {
    const where = [];
    const params = [];

    // Accès : événements publics, événements créés par l'utilisateur, ou événements
    // liés aux cours auxquels l'utilisateur participe.
    where.push(`(
      e.is_public = TRUE
      OR e.created_by = ?
      OR (
        e.course_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM enrollments en
          WHERE en.course_id = e.course_id
            AND en.user_id = ?
        )
      )
    )`);
    params.push(user.id, user.id);

    if (eventType) {
      where.push('e.event_type = ?');
      params.push(eventType);
    }

    if (rangeStart) {
      where.push('e.start_date >= ?');
      params.push(rangeStart);
    }

    if (rangeEnd) {
      where.push('e.start_date <= ?');
      params.push(rangeEnd);
    }

    if (onlyUpcoming !== undefined) {
      if (onlyUpcoming) {
        where.push('e.start_date >= NOW()');
      } else {
        where.push('e.start_date < NOW()');
      }
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [events] = await pool.execute(
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
      ORDER BY e.start_date ASC
    `,
      params
    );

    // Récupérer les sessions live pour le calendrier
    const liveSessionWhere = [];
    const liveSessionParams = [user.id, user.id];

    liveSessionWhere.push(`EXISTS (
      SELECT 1 FROM enrollments en 
      WHERE en.course_id = ls.course_id AND en.user_id = ?
    )`);

    if (rangeStart) {
      liveSessionWhere.push('ls.scheduled_start_at >= ?');
      liveSessionParams.push(rangeStart);
    }

    if (rangeEnd) {
      liveSessionWhere.push('ls.scheduled_end_at <= ?');
      liveSessionParams.push(rangeEnd);
    }

    if (onlyUpcoming !== undefined) {
      if (onlyUpcoming) {
        liveSessionWhere.push('ls.scheduled_start_at >= NOW()');
      } else {
        liveSessionWhere.push('ls.scheduled_end_at < NOW()');
      }
    }

    const liveSessionWhereClause = liveSessionWhere.length ? `WHERE ${liveSessionWhere.join(' AND ')}` : '';

    const [liveSessions] = await pool.execute(
      `
      SELECT
        ls.id,
        ls.title,
        ls.description,
        ls.scheduled_start_at AS start_date,
        ls.scheduled_end_at AS end_date,
        ls.status,
        ls.course_id,
        c.title AS course_title,
        c.slug AS course_slug,
        u.first_name AS instructor_first_name,
        u.last_name AS instructor_last_name,
        u.email AS instructor_email
      FROM live_sessions ls
      JOIN courses c ON ls.course_id = c.id
      JOIN users u ON ls.instructor_id = u.id
      ${liveSessionWhereClause}
      ORDER BY ls.scheduled_start_at ASC
    `,
      liveSessionParams
    );

    // Formater les événements (filtrer ceux sans date valide)
    const formattedEvents = events
      .filter(event => event.start_date != null) // Filtrer les événements sans date
      .map((event) => ({
        id: `event-${event.id}`,
        title: event.title,
        description: event.description,
        event_type: event.event_type,
        start_date: event.start_date ? new Date(event.start_date).toISOString() : null,
        end_date: event.end_date ? new Date(event.end_date).toISOString() : null,
        is_all_day: Boolean(event.is_all_day),
        location: event.location,
        is_public: Boolean(event.is_public),
        type: 'event',
        course: event.course_id
          ? {
              id: event.course_id,
              title: event.course_title,
              slug: event.course_slug
            }
          : null,
        created_by: event.created_by
          ? {
              id: event.created_by,
              first_name: event.creator_first_name,
              last_name: event.creator_last_name,
              email: event.creator_email,
              role: event.creator_role
            }
          : null,
        created_at: event.created_at,
        updated_at: event.updated_at
      }));

    // Formater les sessions live (filtrer celles sans date valide)
    const formattedLiveSessions = liveSessions
      .filter(session => session.start_date != null) // Filtrer les sessions sans date
      .map((session) => ({
        id: `live-session-${session.id}`,
        title: session.title,
        description: session.description,
        event_type: 'live_session',
        start_date: session.start_date ? new Date(session.start_date).toISOString() : null,
        end_date: session.end_date ? new Date(session.end_date).toISOString() : null,
        is_all_day: false,
        location: null,
        is_public: false,
        type: 'live_session',
        status: session.status,
        course: {
          id: session.course_id,
          title: session.course_title,
          slug: session.course_slug
        },
        instructor: {
          first_name: session.instructor_first_name,
          last_name: session.instructor_last_name,
          email: session.instructor_email
        },
        url: `/courses/${session.course_id}/live-sessions/${session.id}`
      }));

    // Fusionner et trier par date (filtrer ceux sans start_date valide)
    const allEvents = [...formattedEvents, ...formattedLiveSessions]
      .filter(event => event.start_date != null)
      .sort((a, b) => {
        return new Date(a.start_date) - new Date(b.start_date);
      });

    res.json({
      success: true,
      data: allEvents
    });
  } catch (error) {
    console.error('Erreur événements:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les événements'
    });
  }
};

const getEventById = async (req, res) => {
  const user = ensureAuthenticated(req, res);
  if (!user) return;

  const { id } = req.params;

  try {
    const [events] = await pool.execute(
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
      [id]
    );

    if (!events.length) {
      return res.status(404).json({
        success: false,
        message: 'Événement introuvable'
      });
    }

    const event = events[0];

    // Vérifier permission
    const hasCourseAccess =
      event.course_id === null ||
      event.is_public === 1 ||
      event.created_by === user.id;

    let isEnrolled = false;
    if (!hasCourseAccess && event.course_id) {
      const [rows] = await pool.execute(
        'SELECT 1 FROM enrollments WHERE course_id = ? AND user_id = ? LIMIT 1',
        [event.course_id, user.id]
      );
      isEnrolled = rows.length > 0;
    }

    if (!hasCourseAccess && !isEnrolled) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à cet événement'
      });
    }

    res.json({
      success: true,
      data: {
        id: event.id,
        title: event.title,
        description: event.description,
        event_type: event.event_type,
        start_date: event.start_date,
        end_date: event.end_date,
        is_all_day: Boolean(event.is_all_day),
        location: event.location,
        is_public: Boolean(event.is_public),
        course: event.course_id
          ? {
              id: event.course_id,
              title: event.course_title,
              slug: event.course_slug
            }
          : null,
        created_by: event.created_by
          ? {
              id: event.created_by,
              first_name: event.creator_first_name,
              last_name: event.creator_last_name,
              email: event.creator_email,
              role: event.creator_role
            }
          : null,
        created_at: event.created_at,
        updated_at: event.updated_at
      }
    });
  } catch (error) {
    console.error('Erreur événement:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer l\'événement'
    });
  }
};

module.exports = {
  getEvents,
  getEventById
};

