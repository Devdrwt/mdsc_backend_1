const { pool } = require('../config/database');

// Rechercher un utilisateur par email
const searchUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email requis'
      });
    }

    const query = `
      SELECT id, first_name, last_name, email, role, profile_picture
      FROM users
      WHERE email LIKE ? AND is_active = TRUE
      LIMIT 10
    `;

    const [users] = await pool.execute(query, [`%${email}%`]);

    res.json({
      success: true,
      data: users.map(user => ({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        profile_picture: user.profile_picture
      }))
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche'
    });
  }
};

// Envoyer un message (support recipient_id OU recipient_email OU receiverEmail)
const sendMessage = async (req, res) => {
  try {
    // Accepter recipient_email ou receiverEmail (alias pour compatibilité frontend)
    const { recipient_id, recipient_email, receiverEmail, subject, content, message_type = 'direct' } = req.body;
    // Utiliser recipient_email en priorité, sinon receiverEmail
    const finalRecipientEmail = recipient_email || receiverEmail;
    const senderId = req.user.userId;

    // Récupérer l'email de l'expéditeur
    const [senders] = await pool.execute('SELECT email FROM users WHERE id = ?', [senderId]);
    if (senders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Expéditeur non trouvé'
      });
    }
    const senderEmail = senders[0].email;

    let recipientId = null;
    let recipientEmail = null;
    let recipientName = null;

    // Si recipient_id est fourni, l'utiliser
    if (recipient_id) {
      const recipientQuery = 'SELECT id, first_name, last_name, email FROM users WHERE id = ? AND is_active = TRUE';
      const [recipients] = await pool.execute(recipientQuery, [recipient_id]);

      if (recipients.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Destinataire non trouvé'
        });
      }

      recipientId = recipients[0].id;
      recipientEmail = recipients[0].email;
      recipientName = recipients[0].first_name + ' ' + recipients[0].last_name;
    }
    // Sinon, utiliser recipient_email ou receiverEmail
    else if (finalRecipientEmail) {
      const recipientQuery = 'SELECT id, first_name, last_name, email FROM users WHERE email = ? AND is_active = TRUE';
      const [recipients] = await pool.execute(recipientQuery, [finalRecipientEmail]);

      if (recipients.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Destinataire non trouvé avec cet email'
        });
      }

      recipientId = recipients[0].id;
      recipientEmail = recipients[0].email;
      recipientName = recipients[0].first_name + ' ' + recipients[0].last_name;
    } else {
      return res.status(400).json({
        success: false,
        message: 'recipient_id, recipient_email ou receiverEmail requis'
      });
    }

    // Insérer le message avec sender_email et recipient_email
    const insertQuery = `
      INSERT INTO messages (
        sender_id, recipient_id, sender_email, recipient_email,
        subject, content, message_type, is_read, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      senderId, recipientId, senderEmail, recipientEmail,
      subject, content, message_type
    ]);

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès',
      data: {
        id: result.insertId,
        recipient: recipientName,
        recipient_email: recipientEmail
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
        u.role as sender_role,
        u.profile_picture as sender_profile_picture
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
          read_at: msg.read_at,
          sender: {
            id: msg.sender_id,
            name: `${msg.sender_first_name || ''} ${msg.sender_last_name || ''}`.trim() || msg.sender_email,
            email: msg.sender_email,
            role: msg.sender_role,
            profile_picture: msg.sender_profile_picture
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
        u.role as recipient_role,
        u.profile_picture as recipient_profile_picture
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
          read_at: msg.read_at,
          recipient: {
            id: msg.recipient_id,
            name: `${msg.recipient_first_name || ''} ${msg.recipient_last_name || ''}`.trim() || msg.recipient_email,
            email: msg.recipient_email,
            role: msg.recipient_role,
            profile_picture: msg.recipient_profile_picture
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
        sender.profile_picture as sender_profile_picture,
        recipient.first_name as recipient_first_name,
        recipient.last_name as recipient_last_name,
        recipient.email as recipient_email,
        recipient.role as recipient_role,
        recipient.profile_picture as recipient_profile_picture
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
          name: `${message.sender_first_name || ''} ${message.sender_last_name || ''}`.trim() || message.sender_email,
          email: message.sender_email,
          role: message.sender_role,
          profile_picture: message.sender_profile_picture
        },
        recipient: {
          id: message.recipient_id,
          name: `${message.recipient_first_name || ''} ${message.recipient_last_name || ''}`.trim() || message.recipient_email,
          email: message.recipient_email,
          role: message.recipient_role,
          profile_picture: message.recipient_profile_picture
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

// Récupérer une conversation par email
const getConversationByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const userId = req.user.userId;

    // Récupérer l'email de l'utilisateur
    const [users] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    const userEmail = users[0].email;

    // Récupérer tous les messages avec cet email (en tant qu'expéditeur ou destinataire)
    const [messages] = await pool.execute(
      `SELECT 
        m.*,
        sender.first_name as sender_first_name,
        sender.last_name as sender_last_name,
        sender.email as sender_email,
        recipient.first_name as recipient_first_name,
        recipient.last_name as recipient_last_name,
        recipient.email as recipient_email
       FROM messages m
       LEFT JOIN users sender ON m.sender_id = sender.id
       LEFT JOIN users recipient ON m.recipient_id = recipient.id
       WHERE (m.sender_email = ? AND m.recipient_email = ?)
          OR (m.sender_email = ? AND m.recipient_email = ?)
       ORDER BY m.created_at ASC`,
      [userEmail, email, email, userEmail]
    );

    res.json({
      success: true,
      data: {
        conversation_email: email,
        messages: messages.map(msg => ({
          id: msg.id,
          subject: msg.subject,
          content: msg.content,
          message_type: msg.message_type,
          is_read: msg.is_read,
          created_at: msg.created_at,
          is_sent: msg.sender_email === userEmail,
          sender: {
            email: msg.sender_email,
            name: msg.sender_first_name ? `${msg.sender_first_name} ${msg.sender_last_name}` : null
          },
          recipient: {
            email: msg.recipient_email,
            name: msg.recipient_first_name ? `${msg.recipient_first_name} ${msg.recipient_last_name}` : null
          }
        }))
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

// Récupérer toutes mes conversations (groupées par email)
const getMyConversations = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Récupérer l'email de l'utilisateur
    const [users] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    const userEmail = users[0].email;

    // Récupérer toutes les conversations uniques (groupées par email)
    const [conversations] = await pool.execute(
      `SELECT 
        CASE 
          WHEN m.sender_email = ? THEN m.recipient_email
          ELSE m.sender_email
        END as conversation_email,
        COUNT(*) as message_count,
        MAX(m.created_at) as last_message_at,
        SUM(CASE WHEN m.recipient_email = ? AND m.is_read = FALSE THEN 1 ELSE 0 END) as unread_count,
        MAX(m.subject) as last_subject,
        MAX(CASE 
          WHEN m.sender_email = ? THEN CONCAT(sender.first_name, ' ', sender.last_name)
          ELSE CONCAT(recipient.first_name, ' ', recipient.last_name)
        END) as conversation_name
       FROM messages m
       LEFT JOIN users sender ON m.sender_id = sender.id
       LEFT JOIN users recipient ON m.recipient_id = recipient.id
       WHERE m.sender_email = ? OR m.recipient_email = ?
       GROUP BY conversation_email
       ORDER BY last_message_at DESC`,
      [userEmail, userEmail, userEmail, userEmail, userEmail]
    );

    res.json({
      success: true,
      data: conversations
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

module.exports = {
  searchUserByEmail,
  sendMessage,
  getReceivedMessages,
  getSentMessages,
  getMessage,
  markAsRead,
  deleteMessage,
  getMessageStats,
  getConversationByEmail,
  getMyConversations
};
