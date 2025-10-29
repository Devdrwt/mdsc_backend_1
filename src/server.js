const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('./config/passport');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { verifyEmailConfig } = require('./services/emailService');
const authRoutes = require('./routes/authRoutes');
const googleAuthRoutes = require('./routes/googleAuthRoutes');
const courseRoutes = require('./routes/courseRoutes');
const quizRoutes = require('./routes/quizRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const aiRoutes = require('./routes/aiRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const messageRoutes = require('./routes/messageRoutes');
const fileRoutes = require('./routes/fileRoutes');
const professionalRoutes = require('./routes/professionalRoutes');
const moduleRoutes = require('./routes/moduleRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const badgeRoutes = require('./routes/badgeRoutes');
const progressRoutes = require('./routes/progressRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration de la session (nécessaire pour Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'mdsc_session_secret_2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Initialiser Passport
app.use(passport.initialize());
app.use(passport.session());

// Log des requêtes en développement
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API d\'authentification MdSC - Fonctionne correctement',
    timestamp: new Date().toISOString()
  });
});

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/auth', googleAuthRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/professional', professionalRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/progress', progressRoutes);

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur globale:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Démarrage du serveur
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Tester la connexion à la base de données
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Impossible de se connecter à la base de données');
      process.exit(1);
    }

    // Vérifier la configuration email (optionnel)
    await verifyEmailConfig().catch(err => {
      console.warn('⚠️ Configuration email non valide. Les emails ne seront pas envoyés.');
    });

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 Serveur d\'authentification MdSC démarré');
      console.log('='.repeat(60));
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️ Base de données: ${process.env.DB_NAME}`);
      console.log(`🔗 Frontend: ${process.env.FRONTEND_URL}`);
      console.log('='.repeat(60) + '\n');
    });

  } catch (error) {
    console.error('❌ Erreur au démarrage du serveur:', error);
    process.exit(1);
  }
};

startServer();

// Gestion de l'arrêt propre
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM reçu. Arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT reçu. Arrêt du serveur...');
  process.exit(0);
});
