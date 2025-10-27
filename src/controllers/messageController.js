const { pool } = require('../config/database');

// Envoyer un message
const sendMessage = async (req, res) => {
  try {
    const { recipient_id, subject, content, message_type = 'direct' } = req.body;
    const senderId = req.user.userId;

    // Vérifier que le destinataire existe
    const recipientQuery = 'SELECT id, first_name, last_name FROM users WHERE id = ? AND is_active = TRUE';
    const [recipients] = await pool.execute(recipientQuery, [recipient_id]);

    if (recipients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Destinataire non trouvé'
      });
    }

    // Insérer le message
    const insertQuery = `
      INSERT INTO messages (
        sender_id, recipient_id, subject, content, message_type, 
        is_read, created_at
      ) VALUES (?, ?, ?, ?, ?, FALSE, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      senderId, recipient_id, subject, content, message_type
    ]);

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès',
      data: {
        id: result.insertId,
        recipient: recipients[0].first_name + ' ' + recipients[0].last_name
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message'
    });
  }
};

// Récupérer les messages reçus
const getReceivedMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE m.recipient_id = ?';
    let params = [userId];

    if (unread_only === 'true') {
      whereClause += ' AND m.is_read = FALSE';
    }

    const query = `
      SELECT 
        m.*,
        u.first_name as sender_first_name,
        u.last_name as sender_last_name,
        u.email as sender_email,
        u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), offset);
    const [messages] = await pool.execute(query, params);

    // Compter le total des messages
    const countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      ${whereClause}
    `;
    const [countResult] = await pool.execute(countQuery, [userId, ...(unread_only === 'true' ? [] : [])]);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        messages: messages.map(msg => ({
          id: msg.id,
          subject: msg.subject,
          content: msg.content,
          message_type: msg.message_type,
          is_read: msg.is_read,
          created_at: msg.created_at,
          sender: {
            id: msg.sender_id,
            name: msg.sender_first_name + ' ' + msg.sender_last_name,
            email: msg.sender_email,
            role: msg.sender_role
          }
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages'
    });
  }
};

// Récupérer les messages envoyés
const getSentMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        m.*,
        u.first_name as recipient_first_name,
        u.last_name as recipient_last_name,
        u.email as recipient_email,
        u.role as recipient_role
      FROM messages m
      JOIN users u ON m.recipient_id = u.id
      WHERE m.sender_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [messages] = await pool.execute(query, [userId, parseInt(limit), offset]);

    // Compter le total des messages envoyés
    const countQuery = 'SELECT COUNT(*) as total FROM messages WHERE sender_id = ?';
    const [countResult] = await pool.execute(countQuery, [userId]);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        messages: messages.map(msg => ({
          id: msg.id,
          subject: msg.subject,
          content: msg.content,
          message_type: msg.message_type,
          is_read: msg.is_read,
          created_at: msg.created_at,
          recipient: {
            id: msg.recipient_id,
            name: msg.recipient_first_name + ' ' + msg.recipient_last_name,
            email: msg.recipient_email,
            role: msg.recipient_role
          }
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des messages envoyés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages envoyés'
    });
  }
};

// Récupérer un message spécifique
const getMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const query = `
      SELECT 
        m.*,
        sender.first_name as sender_first_name,
        sender.last_name as sender_last_name,
        sender.email as sender_email,
        sender.role as sender_role,
        recipient.first_name as recipient_first_name,
        recipient.last_name as recipient_last_name,
        recipient.email as recipient_email,
        recipient.role as recipient_role
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.id = ? AND (m.sender_id = ? OR m.recipient_id = ?)
    `;

    const [messages] = await pool.execute(query, [messageId, userId, userId]);

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    const message = messages[0];

    // Marquer comme lu si c'est le destinataire
    if (message.recipient_id === userId && !message.is_read) {
      await pool.execute(
        'UPDATE messages SET is_read = TRUE, read_at = NOW() WHERE id = ?',
        [messageId]
      );
      message.is_read = true;
    }

    res.json({
      success: true,
      data: {
        id: message.id,
        subject: message.subject,
        content: message.content,
        message_type: message.message_type,
        is_read: message.is_read,
        created_at: message.created_at,
        read_at: message.read_at,
        sender: {
          id: message.sender_id,
          name: message.sender_first_name + ' ' + message.sender_last_name,
          email: message.sender_email,
          role: message.sender_role
        },
        recipient: {
          id: message.recipient_id,
          name: message.recipient_first_name + ' ' + message.recipient_last_name,
          email: message.recipient_email,
          role: message.recipient_role
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du message'
    });
  }
};

// Marquer un message comme lu
const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    // Vérifier que l'utilisateur est le destinataire
    const messageQuery = 'SELECT id FROM messages WHERE id = ? AND recipient_id = ?';
    const [messages] = await pool.execute(messageQuery, [messageId, userId]);

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Marquer comme lu
    await pool.execute(
      'UPDATE messages SET is_read = TRUE, read_at = NOW() WHERE id = ?',
      [messageId]
    );

    res.json({
      success: true,
      message: 'Message marqué comme lu'
    });

  } catch (error) {
    console.error('Erreur lors du marquage du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage du message'
    });
  }
};

// Supprimer un message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    // Vérifier que l'utilisateur peut supprimer ce message (expéditeur ou destinataire)
    const messageQuery = 'SELECT id FROM messages WHERE id = ? AND (sender_id = ? OR recipient_id = ?)';
    const [messages] = await pool.execute(messageQuery, [messageId, userId, userId]);

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Supprimer le message
    await pool.execute('DELETE FROM messages WHERE id = ?', [messageId]);

    res.json({
      success: true,
      message: 'Message supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du message'
    });
  }
};

// Récupérer les statistiques des messages
const getMessageStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN recipient_id = ? AND is_read = FALSE THEN 1 END) as unread_count,
        COUNT(CASE WHEN recipient_id = ? THEN 1 END) as received_count,
        COUNT(CASE WHEN sender_id = ? THEN 1 END) as sent_count
      FROM messages
    `;

    const [stats] = await pool.execute(statsQuery, [userId, userId, userId]);

    res.json({
      success: true,
      data: {
        unread_count: stats[0].unread_count || 0,
        received_count: stats[0].received_count || 0,
        sent_count: stats[0].sent_count || 0
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

module.exports = {
  sendMessage,
  getReceivedMessages,
  getSentMessages,
  getMessage,
  markAsRead,
  deleteMessage,
  getMessageStats
};
