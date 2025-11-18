const { pool } = require("../config/database");

// Rechercher un utilisateur par email
// Accessible à tous les utilisateurs authentifiés
// - Étudiants : peuvent rechercher uniquement d'autres étudiants
// - Instructeurs et admins : peuvent rechercher tous les utilisateurs
const searchUserByEmail = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email requis",
      });
    }

    // Construire la requête avec filtre selon le rôle
    let query = `
      SELECT id, first_name, last_name, email, role, profile_picture
      FROM users
      WHERE email LIKE ? AND is_active = TRUE
    `;
    const params = [`%${email}%`];

    // Si l'utilisateur est un étudiant, ne montrer que les étudiants
    if (userRole === 'student') {
      query += ' AND role = ?';
      params.push('student');
    }
    // Les instructeurs et admins peuvent voir tous les utilisateurs (pas de filtre supplémentaire)

    query += ' LIMIT 10';

    const [users] = await pool.execute(query, params);

    res.json({
      success: true,
      data: users.map((user) => ({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role,
        profile_picture: user.profile_picture,
      })),
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la recherche",
    });
  }
};

// Envoyer un message (support recipient_id OU recipient_email OU receiverEmail)
const sendMessage = async (req, res) => {
  try {
    const {
      recipient_id,
      recipient_email,
      receiverEmail,
      subject,
      content,
      message_type = "direct",
    } = req.body;

    const finalRecipientEmail = recipient_email || receiverEmail;
    const senderId = req.user.userId;

    // 🔹 Récupérer les infos de l'expéditeur (id, prénom, nom, email)
    const [senders] = await pool.execute(
      "SELECT id, first_name, last_name, email FROM users WHERE id = ?",
      [senderId]
    );
    if (senders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Expéditeur non trouvé",
      });
    }
    const sender = senders[0];
    const senderName = `${sender.first_name} ${sender.last_name}`;

    let recipientId = null;
    let recipientEmail = null;
    let recipientName = null;

    // 🔹 Chercher le destinataire
    if (recipient_id) {
      const [recipients] = await pool.execute(
        "SELECT id, first_name, last_name, email FROM users WHERE id = ? AND is_active = TRUE",
        [recipient_id]
      );
      if (recipients.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Destinataire non trouvé",
        });
      }
      const r = recipients[0];
      recipientId = r.id;
      recipientEmail = r.email;
      recipientName = `${r.first_name} ${r.last_name}`;
    } else if (finalRecipientEmail) {
      const [recipients] = await pool.execute(
        "SELECT id, first_name, last_name, email FROM users WHERE email = ? AND is_active = TRUE",
        [finalRecipientEmail]
      );
      if (recipients.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Destinataire non trouvé avec cet email",
        });
      }
      const r = recipients[0];
      recipientId = r.id;
      recipientEmail = r.email;
      recipientName = `${r.first_name} ${r.last_name}`;
    } else {
      return res.status(400).json({
        success: false,
        message: "recipient_id, recipient_email ou receiverEmail requis",
      });
    }

    // 🔹 Insérer le message
    const insertQuery = `
      INSERT INTO messages (
        sender_id, recipient_id, sender_email, recipient_email,
        subject, content, message_type, is_read, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NOW())
    `;
    const [result] = await pool.execute(insertQuery, [
      senderId,
      recipientId,
      sender.email,
      recipientEmail,
      subject,
      content,
      message_type,
    ]);

    const messageId = result.insertId;

    // 🔹 Créer une notification pour le destinataire
    try {
      const notificationTitle = 'Nouveau message reçu';
      const notificationMessage = `Vous avez reçu un nouveau message de ${senderName}${subject ? ` : "${subject}"` : ''}`;
      const actionUrl = `/messages/${messageId}`;
      const metadata = JSON.stringify({
        message_id: messageId,
        sender_id: senderId,
        sender_name: senderName,
        sender_email: sender.email,
        subject: subject,
        action: 'view_message',
        link: actionUrl
      });

      await pool.execute(
        `INSERT INTO notifications (
          user_id, title, message, type, is_read, action_url, metadata
        ) VALUES (?, ?, ?, 'info', FALSE, ?, ?)`,
        [recipientId, notificationTitle, notificationMessage, actionUrl, metadata]
      );

      console.log(`✅ Notification créée pour le destinataire ${recipientName} (ID: ${recipientId}) concernant le message ${messageId}`);
    } catch (notificationError) {
      // Ne pas faire échouer l'envoi du message si la création de notification échoue
      console.error('⚠️ Erreur lors de la création de la notification:', notificationError);
    }

    // 🔹 Enregistrer l'activité pour l'expéditeur (message envoyé)
    try {
      const { recordActivity } = require('./gamificationController');
      await recordActivity(
        senderId,
        'message_sent',
        0, // Pas de points pour l'envoi de message
        `Message envoyé à ${recipientName}${subject ? ` : "${subject}"` : ''}`,
        {
          message_id: messageId,
          recipient_id: recipientId,
          recipient_name: recipientName,
          recipient_email: recipientEmail,
          subject: subject
        }
      );
    } catch (activityError) {
      console.error('⚠️ Erreur lors de l\'enregistrement de l\'activité (message envoyé):', activityError);
    }

    // 🔹 Enregistrer l'activité pour le destinataire (message reçu)
    try {
      const { recordActivity } = require('./gamificationController');
      await recordActivity(
        recipientId,
        'message_received',
        0, // Pas de points pour la réception de message
        `Message reçu de ${senderName}${subject ? ` : "${subject}"` : ''}`,
        {
          message_id: messageId,
          sender_id: senderId,
          sender_name: senderName,
          sender_email: sender.email,
          subject: subject
        }
      );
    } catch (activityError) {
      console.error('⚠️ Erreur lors de l\'enregistrement de l\'activité (message reçu):', activityError);
    }

    // 🔹 Réponse enrichie (sender + recipient)
    res.status(201).json({
      success: true,
      message: "Message envoyé avec succès",
      data: {
        id: messageId,
        sender: {
          id: sender.id,
          name: senderName,
          email: sender.email,
        },
        recipient: {
          id: recipientId,
          name: recipientName,
          email: recipientEmail,
        },
        subject,
        content,
        sent_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Erreur lors de l'envoi du message:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'envoi du message",
    });
  }
};

// Récupérer les messages reçus
const getReceivedMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = "WHERE m.recipient_id = ?";
    let params = [userId];

    if (unread_only === "true") {
      whereClause += " AND m.is_read = FALSE";
    }

    const query = `
      SELECT 
        m.*,
        sender.first_name as sender_first_name,
        sender.last_name as sender_last_name,
        sender.email as sender_email,
        sender.role as sender_role,
        sender.profile_picture as sender_profile_picture
      FROM messages m
      LEFT JOIN users sender ON m.sender_id = sender.id
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
    const [countResult] = await pool.execute(countQuery, [userId]);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        messages: messages.map((msg) => ({
          id: msg.id,
          subject: msg.subject,
          content: msg.content,
          message_type: msg.message_type,
          is_read: msg.is_read,
          created_at: msg.created_at,
          read_at: msg.read_at,
          sender: {
            id: msg.sender_id,
            name:
              msg.sender_first_name && msg.sender_last_name
                ? `${msg.sender_first_name} ${msg.sender_last_name}`
                : msg.sender_email || "Inconnu",
            email: msg.sender_email || "inconnu@example.com",
            role: msg.sender_role,
            profile_picture: msg.sender_profile_picture,
          },
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des messages:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des messages",
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
        recipient.first_name as recipient_first_name,
        recipient.last_name as recipient_last_name,
        recipient.email as recipient_email,
        recipient.role as recipient_role,
        recipient.profile_picture as recipient_profile_picture
      FROM messages m
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.sender_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [messages] = await pool.execute(query, [
      userId,
      parseInt(limit),
      offset,
    ]);

    const countQuery =
      "SELECT COUNT(*) as total FROM messages WHERE sender_id = ?";
    const [countResult] = await pool.execute(countQuery, [userId]);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        messages: messages.map((msg) => ({
          id: msg.id,
          subject: msg.subject,
          content: msg.content,
          message_type: msg.message_type,
          is_read: msg.is_read,
          created_at: msg.created_at,
          read_at: msg.read_at,
          recipient: {
            id: msg.recipient_id,
            name:
              msg.recipient_first_name && msg.recipient_last_name
                ? `${msg.recipient_first_name} ${msg.recipient_last_name}`
                : msg.recipient_email || "Inconnu",
            email: msg.recipient_email || "inconnu@example.com",
            role: msg.recipient_role,
            profile_picture: msg.recipient_profile_picture,
          },
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des messages envoyés:",
      error
    );
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des messages envoyés",
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
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users recipient ON m.recipient_id = recipient.id
      WHERE m.id = ? AND (m.sender_id = ? OR m.recipient_id = ?)
    `;

    const [messages] = await pool.execute(query, [messageId, userId, userId]);

    if (messages.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Message non trouvé" });
    }

    const message = messages[0];

    // Marquer comme lu si c'est le destinataire
    if (message.recipient_id === userId && !message.is_read) {
      await pool.execute(
        "UPDATE messages SET is_read = TRUE, read_at = NOW() WHERE id = ?",
        [messageId]
      );
      message.is_read = true;

      // Marquer aussi la notification associée comme lue
      try {
        await pool.execute(
          `UPDATE notifications 
           SET is_read = TRUE, read_at = NOW() 
           WHERE user_id = ? 
           AND metadata LIKE ? 
           AND is_read = FALSE`,
          [userId, `%"message_id":${messageId}%`]
        );
      } catch (notificationError) {
        // Ne pas faire échouer la récupération du message si la mise à jour de notification échoue
        console.error('⚠️ Erreur lors de la mise à jour de la notification:', notificationError);
      }
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
          name:
            message.sender_first_name && message.sender_last_name
              ? `${message.sender_first_name} ${message.sender_last_name}`
              : message.sender_email || "Inconnu",
          email: message.sender_email || "inconnu@example.com",
          role: message.sender_role,
          profile_picture: message.sender_profile_picture,
        },
        recipient: {
          id: message.recipient_id,
          name:
            message.recipient_first_name && message.recipient_last_name
              ? `${message.recipient_first_name} ${message.recipient_last_name}`
              : message.recipient_email || "Inconnu",
          email: message.recipient_email || "inconnu@example.com",
          role: message.recipient_role,
          profile_picture: message.recipient_profile_picture,
        },
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du message:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du message",
    });
  }
};

// Marquer un message comme lu
const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    // Vérifier que l'utilisateur est le destinataire
    const messageQuery =
      "SELECT id FROM messages WHERE id = ? AND recipient_id = ?";
    const [messages] = await pool.execute(messageQuery, [messageId, userId]);

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Message non trouvé",
      });
    }

    // Marquer comme lu
    await pool.execute(
      "UPDATE messages SET is_read = TRUE, read_at = NOW() WHERE id = ?",
      [messageId]
    );

    // Marquer aussi la notification associée comme lue
    try {
      await pool.execute(
        `UPDATE notifications 
         SET is_read = TRUE, read_at = NOW() 
         WHERE user_id = ? 
         AND metadata LIKE ? 
         AND is_read = FALSE`,
        [userId, `%"message_id":${messageId}%`]
      );
    } catch (notificationError) {
      // Ne pas faire échouer le marquage du message si la mise à jour de notification échoue
      console.error('⚠️ Erreur lors de la mise à jour de la notification:', notificationError);
    }

    res.json({
      success: true,
      message: "Message marqué comme lu",
    });
  } catch (error) {
    console.error("Erreur lors du marquage du message:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du marquage du message",
    });
  }
};

// Supprimer un message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    // Vérifier que l'utilisateur peut supprimer ce message (expéditeur ou destinataire)
    const messageQuery =
      "SELECT id FROM messages WHERE id = ? AND (sender_id = ? OR recipient_id = ?)";
    const [messages] = await pool.execute(messageQuery, [
      messageId,
      userId,
      userId,
    ]);

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Message non trouvé",
      });
    }

    // Supprimer le message
    await pool.execute("DELETE FROM messages WHERE id = ?", [messageId]);

    res.json({
      success: true,
      message: "Message supprimé avec succès",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du message:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression du message",
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
        sent_count: stats[0].sent_count || 0,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des statistiques",
    });
  }
};

// Récupérer une conversation par email
const getConversationByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const userId = req.user.userId;

    const [users] = await pool.execute("SELECT email FROM users WHERE id = ?", [
      userId,
    ]);
    if (users.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Utilisateur non trouvé" });

    const userEmail = users[0].email;

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
        messages: messages.map((msg) => ({
          id: msg.id,
          subject: msg.subject,
          content: msg.content,
          message_type: msg.message_type,
          is_read: msg.is_read,
          created_at: msg.created_at,
          is_sent: msg.sender_email === userEmail,
          sender: {
            email: msg.sender_email || "inconnu@example.com",
            name:
              msg.sender_first_name && msg.sender_last_name
                ? `${msg.sender_first_name} ${msg.sender_last_name}`
                : msg.sender_email || "Inconnu",
          },
          recipient: {
            email: msg.recipient_email || "inconnu@example.com",
            name:
              msg.recipient_first_name && msg.recipient_last_name
                ? `${msg.recipient_first_name} ${msg.recipient_last_name}`
                : msg.recipient_email || "Inconnu",
          },
        })),
      },
    });
  } catch (error) {
    console.error("Erreur:", error);
    res
      .status(500)
      .json({ success: false, message: "Erreur lors de la récupération" });
  }
};

// Récupérer toutes mes conversations (groupées par email)
const getMyConversations = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [users] = await pool.execute("SELECT email FROM users WHERE id = ?", [
      userId,
    ]);
    if (users.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Utilisateur non trouvé" });

    const userEmail = users[0].email;

    const [conversations] = await pool.execute(
      `SELECT 
        CASE WHEN m.sender_email = ? THEN m.recipient_email ELSE m.sender_email END as conversation_email,
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

    // Fallback pour les noms manquants
    const result = conversations.map((c) => ({
      conversation_email: c.conversation_email,
      conversation_name: c.conversation_name || c.conversation_email,
      message_count: c.message_count,
      unread_count: c.unread_count,
      last_message_at: c.last_message_at,
      last_subject: c.last_subject,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Erreur:", error);
    res
      .status(500)
      .json({ success: false, message: "Erreur lors de la récupération" });
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
  getMyConversations,
};
