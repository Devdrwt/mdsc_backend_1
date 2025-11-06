require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');

// Fallback loader: si certaines variables manquent, lire manuellement le .env
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const whitelist = new Set([
      'GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','API_URL','FRONTEND_URL',
      'EMAIL_ENABLED','EMAIL_HOST','EMAIL_PORT','EMAIL_SECURE','EMAIL_USER','EMAIL_PASSWORD','EMAIL_FROM'
    ]);
    content.split(/\r?\n/).forEach(line => {
      if (!line || line.trim().startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (whitelist.has(key)) {
        process.env[key] = val; // forcer l'affectation
      }
    });
  }
} catch (e) {
  // ignore fallback errors
}

const { testConnection } = require('./config/database');
// Charger emailService et passport APRES le chargement .env
const { verifyEmailConfig } = require('./services/emailService');
const passport = require('./config/passport');
const authRoutes = require('./routes/authRoutes');
const googleAuthRoutes = require('./routes/googleAuthRoutes');
const adminAuthRoutes = require('./routes/auth/adminAuthRoutes');
const courseRoutes = require('./routes/courseRoutes');
const courseApprovalRoutes = require('./routes/courses/courseApprovalRoutes');
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
const moduleQuizRoutes = require('./routes/modules/moduleQuizRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const badgeRoutes = require('./routes/badgeRoutes');
const progressRoutes = require('./routes/progressRoutes');
const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/payments/paymentRoutes');
const webhookRoutes = require('./routes/payments/webhookRoutes');
const certificateRequestRoutes = require('./routes/certificates/certificateRequestRoutes');

const app = express();

// Middleware
// CORS avancé: support liste d'origines (FRONTEND_URLS=sep par virgules) et credentials
const allowedOrigins = ((process.env.FRONTEND_URLS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean));
if (!allowedOrigins.length) {
  // Valeurs par défaut en local
  allowedOrigins.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173');
}

app.use(cors({
  origin: function(origin, callback) {
    // Autoriser requêtes sans origin (Postman/curl) ou si origin dans la liste
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept'],
  exposedHeaders: ['Content-Disposition']
}));

// En-têtes CORS explicites + preflight global
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Configuration Express avec UTF-8
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Middleware pour s'assurer que toutes les réponses JSON ont le charset UTF-8
app.use((req, res, next) => {
  // Pour toutes les réponses JSON, ajouter le charset UTF-8
  const originalJson = res.json;
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson.call(this, data);
  };
  next();
});

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

// Servir les fichiers statiques (uploads)
// Important : cette route doit être avant les routes API pour éviter les conflits
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    // Ajouter les en-têtes CORS pour les fichiers statiques
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache 1 an
  }
}));

// Log pour vérifier que le dossier uploads est accessible
if (process.env.NODE_ENV === 'development') {
  const fs = require('fs');
  if (fs.existsSync(uploadsPath)) {
    console.log('✅ Dossier uploads accessible:', uploadsPath);
  } else {
    console.warn('⚠️ Dossier uploads non trouvé:', uploadsPath);
  }
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
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api', courseApprovalRoutes);
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
app.use('/api', moduleQuizRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/webhook', webhookRoutes);
app.use('/api', certificateRequestRoutes);
app.use('/api/instructor', require('./routes/instructorRoutes'));

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

    // Debug minimal sur la config
    const gid = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const gsec = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const hasGoogle = !!(gid && gsec);
    const emailUserRaw = (process.env.EMAIL_USER || '').trim();
    const maskedEmailUser = emailUserRaw ? emailUserRaw.replace(/.(?=.{2})/g, '*') : '';
    console.log(`Config check → Google:${hasGoogle ? 'OK' : 'KO'}(idLen=${gid.length},secLen=${gsec.length}) EmailUser:${maskedEmailUser || 'NONE'}(len=${emailUserRaw.length})`);

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
      console.log(`🗄️ Base de données: ${process.env.DB_NAME || 'mdsc_auth'}`);
      console.log(`🔗 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
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

// Initialiser les event listeners (après démarrage app)
try {
  require('./services/eventListeners/LessonEventListener');
  require('./services/eventListeners/QuizEventListener');
  require('./services/eventListeners/CourseEventListener');
  console.log('✅ Event listeners initialisés');
} catch (e) {
  console.warn('⚠️ Impossible d\'initialiser certains listeners:', e.message);
}