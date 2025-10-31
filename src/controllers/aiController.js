const { pool } = require('../config/database');
const axios = require('axios');

// Configuration OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Créer une nouvelle conversation IA
const createConversation = async (req, res) => {
  try {
    const { title, context = 'general' } = req.body;
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
    }

    const query = `
      INSERT INTO ai_conversations (user_id, title, context)
      VALUES (?, ?, ?)
    `;

    const [result] = await pool.execute(query, [userId, title, context]);

    res.status(201).json({
      success: true,
      message: 'Conversation créée avec succès',
      data: {
        conversation_id: result.insertId,
        title,
        context
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création de la conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la conversation'
    });
  }
};

// Envoyer un message à l'IA
const sendMessage = async (req, res) => {
  try {
    const { conversationId, message, context = 'general' } = req.body;
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
    }

    // Vérifier que la conversation appartient à l'utilisateur
    const conversationQuery = `
      SELECT * FROM ai_conversations 
      WHERE id = ? AND user_id = ? AND is_active = TRUE
    `;
    const [conversations] = await pool.execute(conversationQuery, [conversationId, userId]);

    if (conversations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    // Récupérer l'historique de la conversation
    const historyQuery = `
      SELECT role, content FROM ai_messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ASC 
      LIMIT 20
    `;
    const [history] = await pool.execute(historyQuery, [conversationId]);

    // Construire le contexte selon le type
    let systemPrompt = getSystemPrompt(context, userId);
    
    // Ajouter le contexte utilisateur si nécessaire
    if (context === 'course_help' || context === 'assignment_help') {
      const userContext = await getUserContext(userId);
      systemPrompt += `\n\nContexte utilisateur: ${userContext}`;
    }

    // Préparer les messages pour OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    // Envoyer à OpenAI
    const openaiResponse = await axios.post(OPENAI_API_URL, {
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const aiResponse = openaiResponse.data.choices[0].message.content;

    // Sauvegarder le message utilisateur
    await pool.execute(
      'INSERT INTO ai_messages (conversation_id, role, content) VALUES (?, ?, ?)',
      [conversationId, 'user', message]
    );

    // Sauvegarder la réponse de l'IA
    await pool.execute(
      'INSERT INTO ai_messages (conversation_id, role, content, metadata) VALUES (?, ?, ?, ?)',
      [conversationId, 'assistant', aiResponse, JSON.stringify({
        model: 'gpt-4o-mini',
        tokens_used: openaiResponse.data.usage?.total_tokens || 0,
        context: context
      })]
    );

    res.json({
      success: true,
      data: {
        message: aiResponse,
        conversation_id: conversationId,
        context: context
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message à l\'IA'
    });
  }
};

// Récupérer l'historique d'une conversation
const getConversationHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
    }

    // Vérifier les permissions
    const conversationQuery = `
      SELECT * FROM ai_conversations 
      WHERE id = ? AND user_id = ?
    `;
    const [conversations] = await pool.execute(conversationQuery, [conversationId, userId]);

    if (conversations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation non trouvée'
      });
    }

    // Récupérer les messages
    const messagesQuery = `
      SELECT role, content, created_at, metadata
      FROM ai_messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ASC
    `;
    const [messages] = await pool.execute(messagesQuery, [conversationId]);

    res.json({
      success: true,
      data: {
        conversation: conversations[0],
        messages
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
};

// Récupérer toutes les conversations de l'utilisateur
const getUserConversations = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
    }
    const { context } = req.query;

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    if (context) {
      whereClause += ' AND context = ?';
      params.push(context);
    }

    const query = `
      SELECT 
        c.*,
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at
      FROM ai_conversations c
      LEFT JOIN ai_messages m ON c.id = m.conversation_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `;

    const [conversations] = await pool.execute(query, params);

    res.json({
      success: true,
      data: conversations
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des conversations'
    });
  }
};

// Générer un résumé de cours
const generateCourseSummary = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
    }

    // Vérifier que l'utilisateur a accès au cours
    const courseQuery = `
      SELECT c.*, u.first_name, u.last_name
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.id = ? AND c.is_published = TRUE
    `;
    const [courses] = await pool.execute(courseQuery, [courseId]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    // Récupérer les leçons du cours
    const lessonsQuery = `
      SELECT title, description, content, duration_minutes
      FROM lessons 
      WHERE course_id = ? AND is_published = TRUE 
      ORDER BY order_index ASC
    `;
    const [lessons] = await pool.execute(lessonsQuery, [courseId]);

    // Construire le prompt pour le résumé
    const courseContent = `
Cours: ${courses[0].title}
Instructeur: ${courses[0].first_name} ${courses[0].last_name}
Description: ${courses[0].description}

Leçons:
${lessons.map(lesson => `
- ${lesson.title} (${lesson.duration_minutes} min)
  ${lesson.description}
`).join('\n')}
    `;

    const systemPrompt = `Tu es un assistant pédagogique expert. Génère un résumé structuré et utile du cours suivant. 
    Le résumé doit inclure:
    1. Vue d'ensemble du cours
    2. Points clés à retenir
    3. Objectifs d'apprentissage
    4. Recommandations d'étude
    5. Questions de révision
    
    Format: Markdown structuré et professionnel.`;

    const openaiResponse = await axios.post(OPENAI_API_URL, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: courseContent }
      ],
      max_tokens: 1500,
      temperature: 0.5
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const summary = openaiResponse.data.choices[0].message.content;

    res.json({
      success: true,
      data: {
        course: courses[0],
        summary,
        generated_at: new Date()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la génération du résumé:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du résumé'
    });
  }
};

// Obtenir des recommandations personnalisées
const getPersonalizedRecommendations = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Utilisateur non authentifié' });
    }
    const { type = 'course' } = req.query;

    // Analyser le profil de l'utilisateur
    const userProfile = await analyzeUserProfile(userId);
    
    // Générer des recommandations basées sur l'IA
    const recommendations = await generateRecommendations(userId, userProfile, type);

    res.json({
      success: true,
      data: {
        recommendations,
        user_profile: userProfile,
        generated_at: new Date()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la génération des recommandations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des recommandations'
    });
  }
};

// Fonctions utilitaires
const getSystemPrompt = (context, userId) => {
  const basePrompt = `Tu es ChatIA, l'assistant intelligent de la plateforme MOOC MdSC (Maison de la Société Civile). 
  Tu es là pour aider les apprenants dans leur parcours d'apprentissage.`;

  switch (context) {
    case 'course_help':
      return basePrompt + ` Tu aides spécifiquement avec les questions liées aux cours, leçons, et contenu pédagogique.`;
    case 'assignment_help':
      return basePrompt + ` Tu aides avec les devoirs, exercices, et évaluations.`;
    case 'study_plan':
      return basePrompt + ` Tu aides à créer des plans d'étude personnalisés et des stratégies d'apprentissage.`;
    default:
      return basePrompt + ` Tu peux aider avec tous les aspects de la plateforme d'apprentissage.`;
  }
};

const getUserContext = async (userId) => {
  // Récupérer le contexte de l'utilisateur (cours suivis, progression, etc.)
  const userQuery = `
    SELECT 
      u.first_name, u.last_name, u.role,
      COUNT(DISTINCT e.course_id) as courses_enrolled,
      AVG(e.progress_percentage) as avg_progress,
      COUNT(DISTINCT c.id) as courses_completed
    FROM users u
    LEFT JOIN enrollments e ON u.id = e.user_id
    LEFT JOIN enrollments c ON u.id = c.user_id AND c.completed_at IS NOT NULL
    WHERE u.id = ?
    GROUP BY u.id
  `;
  
  const [users] = await pool.execute(userQuery, [userId]);
  return users[0] || {};
};

const analyzeUserProfile = async (userId) => {
  // Analyser le profil utilisateur pour les recommandations
  const profileQuery = `
    SELECT 
      u.role,
      COUNT(DISTINCT e.course_id) as total_courses,
      AVG(e.progress_percentage) as avg_progress,
      COUNT(DISTINCT c.id) as completed_courses,
      COUNT(DISTINCT qa.id) as quiz_attempts,
      AVG(qa.percentage) as avg_quiz_score
    FROM users u
    LEFT JOIN enrollments e ON u.id = e.user_id
    LEFT JOIN enrollments c ON u.id = c.user_id AND c.completed_at IS NOT NULL
    LEFT JOIN quiz_attempts qa ON u.id = qa.user_id
    WHERE u.id = ?
    GROUP BY u.id
  `;
  
  const [profiles] = await pool.execute(profileQuery, [userId]);
  return profiles[0] || {};
};

const generateRecommendations = async (userId, userProfile, type) => {
  // Générer des recommandations basées sur l'IA
  const prompt = `
    Basé sur ce profil utilisateur: ${JSON.stringify(userProfile)}
    Génère 5 recommandations personnalisées de type "${type}" pour cet apprenant.
    Format: JSON avec title, description, priority (1-5), et reason.
  `;

  try {
    const openaiResponse = await axios.post(OPENAI_API_URL, {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Tu es un expert en recommandations pédagogiques. Réponds uniquement en JSON valide.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const recommendations = JSON.parse(openaiResponse.data.choices[0].message.content);
    
    // Sauvegarder les recommandations en base
    for (const rec of recommendations) {
      await pool.execute(
        'INSERT INTO recommendations (user_id, recommendation_type, title, description, priority, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, type, rec.title, rec.description, rec.priority, JSON.stringify({ reason: rec.reason })]
      );
    }

    return recommendations;
  } catch (error) {
    console.error('Erreur génération recommandations IA:', error);
    return [];
  }
};

module.exports = {
  createConversation,
  sendMessage,
  getConversationHistory,
  getUserConversations,
  generateCourseSummary,
  getPersonalizedRecommendations
};
