require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const warnMissing = [];
if (!process.env.GOBIPAY_PUBLIC_KEY) warnMissing.push('GOBIPAY_PUBLIC_KEY');
if (!process.env.GOBIPAY_SECRET_KEY) warnMissing.push('GOBIPAY_SECRET_KEY');
if (!process.env.GOBIPAY_PLATFORM_MONEY) warnMissing.push('GOBIPAY_PLATFORM_MONEY');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const client = require('prom-client');

// Fallback loader: si certaines variables manquent, lire manuellement le .env
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const whitelist = new Set([
      'GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','API_URL','FRONTEND_URL','FRONTEND_URLS',
      'EMAIL_ENABLED','EMAIL_HOST','EMAIL_PORT','EMAIL_SECURE','EMAIL_USER','EMAIL_PASSWORD','EMAIL_FROM',
      'VERIFY_EMAIL_URL','RESET_PASSWORD_URL','EMAIL_VERIFICATION_EXPIRE','PASSWORD_RESET_EXPIRE'
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
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const courseRoutes = require('./routes/courseRoutes');
const courseApprovalRoutes = require('./routes/courses/courseApprovalRoutes');
const quizRoutes = require('./routes/quizRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const certificateController = require('./controllers/certificateController');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const instructorDashboardRoutes = require('./routes/instructorDashboardRoutes');
const studentDashboardRoutes = require('./routes/studentDashboardRoutes');
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
const notificationRoutes = require('./routes/notificationRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const adminNotificationRoutes = require('./routes/adminNotificationRoutes');
const adminEventRoutes = require('./routes/adminEventRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const forumRoutes = require('./routes/forumRoutes');
const liveSessionRoutes = require('./routes/liveSessionRoutes');
const testimonialsRoutes = require('./routes/testimonialsRoutes');
const adminPaymentConfigRoutes = require('./routes/adminPaymentConfigRoutes');
const reminderRoutes = require('./routes/reminderRoutes');

const app = express();

// Metrics Prometheus
const metricsRegister = new client.Registry();
client.collectDefaultMetrics({ register: metricsRegister });

// Middleware
// CORS avancé: support liste d'origines (FRONTEND_URLS=sep par virgules) et credentials
const allowedOrigins = ((process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean));
if (!allowedOrigins.length) {
  // Valeurs par défaut en local
  allowedOrigins.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173');
}

console.log('🌐 CORS: Origines autorisées:', allowedOrigins);

app.use(cors({
  origin: function(origin, callback) {
    // Autoriser requêtes sans origin (Postman/curl) ou si origin dans la liste
    if (!origin || allowedOrigins.includes(origin)) {
      if (origin) {
        console.log('✅ CORS: Origin autorisé:', origin);
      }
      return callback(null, true);
    }
    console.error('❌ CORS: Origin non autorisé:', origin, '- Listes autorisées:', allowedOrigins);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept'],
  exposedHeaders: ['Content-Disposition']
}));

// En-têtes CORS explicites + preflight global avec logging
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Log détaillé pour les requêtes OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    console.log('\n🔵 CORS PREFLIGHT OPTIONS:');
    console.log('   Origin:', origin || '(aucun)');
    console.log('   Requested-Method:', req.headers['access-control-request-method']);
    console.log('   Requested-Headers:', req.headers['access-control-request-headers']);
    console.log('   URL:', req.url);
    
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      console.log('   ✅ Origin autorisé, envoi 204');
    } else if (!origin) {
      // Autoriser les requêtes sans origin (curl, Postman)
      console.log('   ✅ Aucun origin (curl/Postman), envoi 204');
    } else {
      console.error('   ❌ Origin non autorisé:', origin);
      return res.status(403).json({
        success: false,
        message: 'Not allowed by CORS',
        origin: origin,
        allowedOrigins: allowedOrigins
      });
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.header('Access-Control-Max-Age', '86400'); // Cache preflight pour 24h
    return res.sendStatus(204);
  }
  
  // Pour les autres requêtes, ajouter les en-têtes CORS
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  
  next();
});

// Configuration Express avec UTF-8
app.use(express.json({ 
  charset: 'utf-8',
  type: ['application/json', 'application/json; charset=utf-8', 'text/json'],
  strict: false,
  limit: '550mb' // Limite pour les requêtes JSON (légèrement supérieure à 500MB pour les métadonnées)
}));
app.use(express.urlencoded({ 
  extended: true, 
  charset: 'utf-8',
  limit: '550mb' // Limite pour les données URL encodées (grosses vidéos)
}));

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

// Middleware pour logger si le body n'est pas parsé correctement
app.use((req, res, next) => {
  if (req.method === 'POST' && req.headers['content-type'] && req.headers['content-type'].includes('json')) {
    if (!req.body || Object.keys(req.body).length === 0) {
      console.warn('⚠️ Body JSON potentiellement non parsé pour', req.method, req.path);
      console.warn('   Content-Type:', req.headers['content-type']);
      console.warn('   Body:', req.body);
    }
  }
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

// Log des requêtes (toujours actif pour diagnostiquer les problèmes CORS/email)
app.use((req, res, next) => {
  // Log détaillé pour les requêtes DELETE (désinscription)
  if (req.method === 'DELETE' && (
    req.path.includes('/unenroll') || 
    req.path.includes('/enrollments/')
  )) {
    console.log(`🗑️ [SERVER] DELETE request: ${req.method} ${req.path}`);
    console.log(`🗑️ [SERVER] Headers:`, {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      'content-type': req.headers['content-type'],
      'user-agent': req.get('user-agent')?.substring(0, 50)
    });
    console.log(`🗑️ [SERVER] Params:`, req.params);
    console.log(`🗑️ [SERVER] Query:`, req.query);
  }
  
  // Log détaillé pour les requêtes POST importantes
  if (req.method === 'POST' && (
    req.path.includes('/forgot-password') || 
    req.path.includes('/register') || 
    req.path.includes('/verify-email') ||
    req.path.includes('/reset-password')
  )) {
    console.log(`\n🌐 ${req.method} ${req.path}`);
    console.log('   Origin:', req.headers.origin || '(aucun)');
    console.log('   Content-Type:', req.headers['content-type'] || '(aucun)');
    console.log('   IP:', req.ip || req.connection.remoteAddress);
    console.log('   Body keys:', req.body ? Object.keys(req.body).join(', ') : 'body is empty/undefined');
    console.log('   Body:', req.body ? JSON.stringify(req.body) : 'N/A');
    console.log('   User-Agent:', req.get('user-agent') || '(aucun)');
  }
  next();
});

// Les fichiers sont maintenant servis depuis MinIO via /api/media/uploads
// Plus besoin de servir les fichiers statiques depuis le système de fichiers local

// Servir les fichiers statiques du dossier public (pour les pages de test)
const publicPath = path.join(__dirname, '../public');
if (fs.existsSync(publicPath)) {
  app.use('/public', express.static(publicPath));
  console.log('✅ Dossier public accessible:', publicPath);
}

// Les fichiers sont maintenant stockés sur MinIO, plus besoin de vérifier le dossier uploads local

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
// Alias pour compatibilité frontend (sans /api)
app.use('/admin/auth', adminAuthRoutes);
app.use('/api/auth/admin', adminAuthRoutes);
// Routes admin spécifiques AVANT les routes générales pour éviter les conflits
app.use('/api/admin/payment-providers', adminPaymentConfigRoutes);
app.use('/api/admin', adminDashboardRoutes);
app.use('/api/admin', adminUserRoutes);
app.use('/api/admin/reminders', reminderRoutes);
app.use('/api', courseApprovalRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/certificates', certificateRoutes);
// Route admin pour tous les certificats (doit être après /api/certificates pour éviter les conflits)
const { authenticateToken, authorize } = require('./middleware/auth');
app.get('/api/admin/certificates', 
  authenticateToken,
  authorize(['admin']),
  certificateController.getAllCertificates
);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/instructor', instructorDashboardRoutes);
app.use('/api/student', studentDashboardRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/admin/events', adminEventRoutes);
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
app.use('/api', ratingRoutes);
app.use('/api', forumRoutes);
app.use('/api', liveSessionRoutes);
app.use('/api/testimonials', testimonialsRoutes);

// Endpoint Prometheus
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsRegister.contentType);
    res.end(await metricsRegister.metrics());
  } catch (e) {
    console.error('❌ Erreur metrics:', e);
    res.status(500).end('Metrics error');
  }
});

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

      // Démarrer le scheduler automatique des rappels
      try {
        const ReminderScheduler = require('./services/reminderScheduler');
        ReminderScheduler.start();
        console.log('✅ Scheduler des rappels de cours initialisé');
      } catch (error) {
        console.warn('⚠️ Impossible d\'initialiser le scheduler des rappels:', error.message);
      }
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
  try {
    const ReminderScheduler = require('./services/reminderScheduler');
    ReminderScheduler.stop();
  } catch (e) {
    // Ignorer si le module n'est pas chargé
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT reçu. Arrêt du serveur...');
  try {
    const ReminderScheduler = require('./services/reminderScheduler');
    ReminderScheduler.stop();
  } catch (e) {
    // Ignorer si le module n'est pas chargé
  }
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