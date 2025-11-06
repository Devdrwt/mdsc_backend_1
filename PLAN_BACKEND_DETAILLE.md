# 🔧 Plan Backend Détaillé - Plateforme MdSC MOOC

**Basé sur l'audit de l'existant** - Voir `AUDIT_EXISTANT.md`  
**Date** : 2024-01-XX  
**Version** : 2.0

---

## 📋 Table des Matières

1. [Migrations Base de Données](#migrations-base-de-données)
2. [Authentification Admin](#authentification-admin)
3. [Type de Cours et Dates](#type-de-cours-et-dates)
4. [Quiz de Modules](#quiz-de-modules)
5. [Évaluation Finale Obligatoire](#évaluation-finale-obligatoire)
6. [Validation Admin Cours](#validation-admin-cours)
7. [Système de Paiement](#système-de-paiement)
8. [Progression Séquentielle](#progression-séquentielle)
9. [Workflow Certificats](#workflow-certificats)
10. [Messagerie par Email](#messagerie-par-email)

---

## 🗄️ Migrations Base de Données

### Fichier : `database/migrations/001_add_course_type_and_status.sql`

```sql
-- Migration : Ajout type de cours et statut de validation
-- Date : 2024-01-XX

-- 1. Ajouter colonnes dans courses
ALTER TABLE courses 
ADD COLUMN course_type ENUM('live', 'on_demand') DEFAULT 'on_demand' AFTER difficulty,
ADD COLUMN status ENUM('draft', 'pending_approval', 'approved', 'rejected', 'published') DEFAULT 'draft' AFTER course_type,
ADD COLUMN approved_by INT NULL AFTER status,
ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by,
ADD COLUMN rejection_reason TEXT NULL AFTER approved_at,
ADD COLUMN evaluation_id INT NULL AFTER rejection_reason,
ADD INDEX idx_course_type (course_type),
ADD INDEX idx_status (status),
ADD INDEX idx_approved_by (approved_by),
ADD CONSTRAINT fk_courses_evaluation FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE SET NULL;

-- 2. Mettre à jour les cours existants
UPDATE courses SET status = 'published' WHERE is_published = TRUE;
UPDATE courses SET status = 'draft' WHERE is_published = FALSE;

-- 3. Table course_approvals (historique des validations)
CREATE TABLE IF NOT EXISTS course_approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  course_id INT NOT NULL,
  admin_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  rejection_reason TEXT NULL,
  comments TEXT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id),
  INDEX idx_course_id (course_id),
  INDEX idx_admin_id (admin_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Fichier : `database/migrations/002_add_module_quizzes.sql`

```sql
-- Migration : Quiz de modules
-- Date : 2024-01-XX

CREATE TABLE IF NOT EXISTS module_quizzes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  module_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  passing_score INT DEFAULT 70,
  badge_id INT NULL,
  time_limit_minutes INT NULL,
  max_attempts INT DEFAULT 3,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE SET NULL,
  UNIQUE KEY unique_module_quiz (module_id),
  INDEX idx_module_id (module_id),
  INDEX idx_badge_id (badge_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les tentatives de quiz de modules
CREATE TABLE IF NOT EXISTS module_quiz_attempts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  enrollment_id INT NOT NULL,
  module_quiz_id INT NOT NULL,
  user_id INT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  answers JSON NULL,
  score DECIMAL(10,2) DEFAULT 0,
  total_points DECIMAL(10,2) DEFAULT 0,
  percentage DECIMAL(5,2) DEFAULT 0,
  is_passed BOOLEAN DEFAULT FALSE,
  time_spent_minutes INT DEFAULT 0,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (module_quiz_id) REFERENCES module_quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_enrollment_id (enrollment_id),
  INDEX idx_module_quiz_id (module_quiz_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Fichier : `database/migrations/003_add_course_evaluations.sql`

```sql
-- Migration : Évaluation finale unique par cours
-- Date : 2024-01-XX

-- Table pour les évaluations finales (relation 1:1 avec courses)
CREATE TABLE IF NOT EXISTS course_evaluations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  course_id INT NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  passing_score INT DEFAULT 70,
  duration_minutes INT NULL,
  max_attempts INT DEFAULT 3,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course_id (course_id),
  INDEX idx_is_published (is_published)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les questions d'évaluation finale
CREATE TABLE IF NOT EXISTS course_evaluation_questions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  evaluation_id INT NOT NULL,
  question_text TEXT NOT NULL,
  question_type ENUM('multiple_choice', 'true_false', 'short_answer') NOT NULL,
  points DECIMAL(10,2) DEFAULT 1,
  order_index INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evaluation_id) REFERENCES course_evaluations(id) ON DELETE CASCADE,
  INDEX idx_evaluation_id (evaluation_id),
  INDEX idx_order_index (order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les réponses des questions d'évaluation
CREATE TABLE IF NOT EXISTS course_evaluation_answers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  question_id INT NOT NULL,
  answer_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  order_index INT DEFAULT 0,
  FOREIGN KEY (question_id) REFERENCES course_evaluation_questions(id) ON DELETE CASCADE,
  INDEX idx_question_id (question_id),
  INDEX idx_is_correct (is_correct)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les tentatives d'évaluation finale
CREATE TABLE IF NOT EXISTS course_evaluation_attempts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  enrollment_id INT NOT NULL,
  evaluation_id INT NOT NULL,
  user_id INT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  answers JSON NOT NULL,
  score DECIMAL(10,2) DEFAULT 0,
  total_points DECIMAL(10,2) DEFAULT 0,
  percentage DECIMAL(5,2) DEFAULT 0,
  is_passed BOOLEAN DEFAULT FALSE,
  time_spent_minutes INT DEFAULT 0,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluation_id) REFERENCES course_evaluations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_enrollment_id (enrollment_id),
  INDEX idx_evaluation_id (evaluation_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mettre à jour la colonne evaluation_id dans courses
UPDATE courses c
INNER JOIN evaluations e ON c.id = e.course_id AND e.is_final = TRUE
SET c.evaluation_id = e.id
WHERE c.evaluation_id IS NULL;
```

### Fichier : `database/migrations/004_add_payments.sql`

```sql
-- Migration : Système de paiement
-- Date : 2024-01-XX

CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'XOF',
  payment_method ENUM('card', 'mobile_money') NOT NULL,
  payment_provider VARCHAR(50) NULL,
  provider_transaction_id VARCHAR(255) NULL,
  status ENUM('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled') DEFAULT 'pending',
  payment_data JSON NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_course_id (course_id),
  INDEX idx_status (status),
  INDEX idx_provider_transaction_id (provider_transaction_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter colonne payment_id dans enrollments
ALTER TABLE enrollments 
ADD COLUMN payment_id INT NULL AFTER enrollment_date,
ADD INDEX idx_payment_id (payment_id),
ADD CONSTRAINT fk_enrollments_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
```

### Fichier : `database/migrations/005_add_certificate_requests.sql`

```sql
-- Migration : Workflow demande/validation certificats
-- Date : 2024-01-XX

CREATE TABLE IF NOT EXISTS certificate_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  enrollment_id INT NOT NULL,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'issued') DEFAULT 'pending',
  user_info JSON NOT NULL,
  rejection_reason TEXT NULL,
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL,
  issued_at TIMESTAMP NULL,
  certificate_number VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_enrollment_id (enrollment_id),
  INDEX idx_user_id (user_id),
  INDEX idx_course_id (course_id),
  INDEX idx_status (status),
  INDEX idx_reviewed_by (reviewed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter colonne request_id dans certificates
ALTER TABLE certificates 
ADD COLUMN request_id INT NULL AFTER id,
ADD INDEX idx_request_id (request_id),
ADD CONSTRAINT fk_certificates_request FOREIGN KEY (request_id) REFERENCES certificate_requests(id) ON DELETE SET NULL;
```

### Fichier : `database/migrations/006_add_messages_email.sql`

```sql
-- Migration : Messagerie par email
-- Date : 2024-01-XX

-- Ajouter colonnes email dans messages
ALTER TABLE messages 
ADD COLUMN sender_email VARCHAR(255) NULL AFTER sender_id,
ADD COLUMN recipient_email VARCHAR(255) NULL AFTER recipient_id,
ADD INDEX idx_sender_email (sender_email),
ADD INDEX idx_recipient_email (recipient_email);

-- Populer les emails depuis users
UPDATE messages m
INNER JOIN users sender ON m.sender_id = sender.id
INNER JOIN users recipient ON m.recipient_id = recipient.id
SET m.sender_email = sender.email,
    m.recipient_email = recipient.email;
```

### Fichier : `database/migrations/007_add_admin_auth.sql`

```sql
-- Migration : Authentification admin avec 2FA
-- Date : 2024-01-XX

-- Table pour les codes 2FA admin
CREATE TABLE IF NOT EXISTS admin_2fa_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_admin_id (admin_id),
  INDEX idx_code (code),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table pour les logs de connexion admin
CREATE TABLE IF NOT EXISTS admin_login_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_id INT NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  success BOOLEAN DEFAULT FALSE,
  failure_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_admin_id (admin_id),
  INDEX idx_success (success),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Fichier : `database/migrations/008_add_sequential_progress.sql`

```sql
-- Migration : Support progression séquentielle
-- Date : 2024-01-XX

-- Ajouter colonne is_sequential dans courses
ALTER TABLE courses 
ADD COLUMN is_sequential BOOLEAN DEFAULT TRUE AFTER course_type,
ADD INDEX idx_is_sequential (is_sequential);

-- Ajouter colonne is_optional dans lessons
ALTER TABLE lessons 
ADD COLUMN is_optional BOOLEAN DEFAULT FALSE AFTER is_published,
ADD INDEX idx_is_optional (is_optional);
```

---

## 🔐 Authentification Admin

### Fichier : `src/routes/auth/adminAuthRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const adminAuthController = require('../../controllers/adminAuthController');
const { authenticateAdminToken } = require('../../middleware/adminAuth');

// Connexion admin
router.post('/login', adminAuthController.login);

// Vérification 2FA
router.post('/verify-2fa', adminAuthController.verify2FA);

// Déconnexion
router.post('/logout', authenticateAdminToken, adminAuthController.logout);

// Vérifier session
router.get('/me', authenticateAdminToken, adminAuthController.getMe);

module.exports = router;
```

### Fichier : `src/controllers/adminAuthController.js`

```javascript
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { sanitizeValue } = require('../utils/sanitize');

// Configuration
const ADMIN_EMAIL_DOMAIN = process.env.ADMIN_EMAIL_DOMAIN || '@mdsc.org';
const ADMIN_EMAIL_WHITELIST = process.env.ADMIN_EMAIL_WHITELIST?.split(',') || [];
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '30m'; // 30 minutes pour admin

// Connexion admin (étape 1 : email/password)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    // Vérifier que l'email est admin
    const isAdminEmail = email.endsWith(ADMIN_EMAIL_DOMAIN) || 
                        ADMIN_EMAIL_WHITELIST.includes(email);

    if (!isAdminEmail) {
      return res.status(403).json({
        success: false,
        message: 'Accès admin uniquement'
      });
    }

    // Récupérer l'utilisateur
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND role = "admin" AND is_active = TRUE',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    const user = users[0];

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      // Logger l'échec
      await pool.execute(
        'INSERT INTO admin_login_logs (admin_id, ip_address, user_agent, success, failure_reason) VALUES (?, ?, ?, FALSE, ?)',
        [user.id, req.ip, req.get('user-agent'), 'Mot de passe invalide']
      );

      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Générer code 2FA
    const code2FA = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Stocker le code
    await pool.execute(
      'INSERT INTO admin_2fa_codes (admin_id, code, expires_at) VALUES (?, ?, ?)',
      [user.id, code2FA, expiresAt]
    );

    // Envoyer par email
    // TODO: Implémenter envoi email avec nodemailer

    // Logger la tentative
    await pool.execute(
      'INSERT INTO admin_login_logs (admin_id, ip_address, user_agent, success) VALUES (?, ?, ?, TRUE)',
      [user.id, req.ip, req.get('user-agent')]
    );

    res.json({
      success: true,
      message: 'Code 2FA envoyé par email',
      data: {
        admin_id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
    });
  }
};

// Vérification 2FA (étape 2)
const verify2FA = async (req, res) => {
  try {
    const { admin_id, code } = req.body;

    if (!admin_id || !code) {
      return res.status(400).json({
        success: false,
        message: 'ID admin et code 2FA requis'
      });
    }

    // Vérifier le code
    const [codes] = await pool.execute(
      'SELECT * FROM admin_2fa_codes WHERE admin_id = ? AND code = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [admin_id, code]
    );

    if (codes.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Code 2FA invalide ou expiré'
      });
    }

    const codeRecord = codes[0];

    // Marquer le code comme utilisé
    await pool.execute(
      'UPDATE admin_2fa_codes SET used = TRUE WHERE id = ?',
      [codeRecord.id]
    );

    // Récupérer l'admin
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = ? AND role = "admin"',
      [admin_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin non trouvé'
      });
    }

    const admin = users[0];

    // Générer JWT
    const token = jwt.sign(
      { 
        userId: admin.id, 
        email: admin.email, 
        role: 'admin',
        type: 'admin'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          first_name: admin.first_name,
          last_name: admin.last_name,
          role: admin.role
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la vérification 2FA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
};

// Déconnexion
const logout = async (req, res) => {
  try {
    // Pour JWT, la déconnexion se fait côté client
    // On peut logger la déconnexion si nécessaire
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion'
    });
  }
};

// Récupérer l'admin connecté
const getMe = async (req, res) => {
  try {
    const adminId = req.user.userId;

    const [admins] = await pool.execute(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = ? AND role = "admin"',
      [adminId]
    );

    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin non trouvé'
      });
    }

    res.json({
      success: true,
      data: admins[0]
    });

  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

module.exports = {
  login,
  verify2FA,
  logout,
  getMe
};
```

### Fichier : `src/middleware/adminAuth.js`

```javascript
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware pour vérifier token admin
const authenticateAdminToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token manquant'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }

    // Vérifier que c'est un token admin
    if (decoded.role !== 'admin' || decoded.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès admin requis'
      });
    }

    req.user = decoded;
    next();
  });
};

module.exports = {
  authenticateAdminToken
};
```

---

## 📚 Type de Cours et Dates

### Modification : `src/controllers/courseController.js`

```javascript
// Dans createCourse, ajouter validation
const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      category_id,
      course_type = 'on_demand', // NOUVEAU
      course_start_date, // NOUVEAU
      course_end_date, // NOUVEAU
      max_students,
      // ... autres champs
    } = req.body;

    const instructorId = req.user.userId;

    // Validation conditionnelle selon le type
    if (course_type === 'live') {
      if (!course_start_date || !course_end_date) {
        return res.status(400).json({
          success: false,
          message: 'Les dates de début et fin sont obligatoires pour un cours Live'
        });
      }

      if (new Date(course_start_date) >= new Date(course_end_date)) {
        return res.status(400).json({
          success: false,
          message: 'La date de fin doit être après la date de début'
        });
      }

      if (!max_students || max_students <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Le nombre maximum d\'étudiants est obligatoire pour un cours Live'
        });
      }
    }

    // Insertion avec les nouveaux champs
    const query = `
      INSERT INTO courses (
        title, description, category_id, instructor_id,
        course_type, course_start_date, course_end_date,
        max_students, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', NOW())
    `;

    const [result] = await pool.execute(query, [
      sanitizeValue(title),
      sanitizeValue(description),
      sanitizeValue(category_id),
      instructorId,
      sanitizeValue(course_type),
      sanitizeValue(course_type === 'live' ? course_start_date : null),
      sanitizeValue(course_type === 'live' ? course_end_date : null),
      sanitizeValue(course_type === 'live' ? max_students : null)
    ]);

    // ... reste du code
  } catch (error) {
    // ... gestion erreur
  }
};
```

---

## 🎯 Quiz de Modules

### Fichier : `src/routes/modules/moduleQuizRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const moduleQuizController = require('../../controllers/moduleQuizController');
const { authenticateToken, authorize } = require('../../middleware/auth');

// Routes instructeur
router.post('/modules/:moduleId/quiz', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleQuizController.createModuleQuiz
);

router.get('/modules/:moduleId/quiz', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleQuizController.getModuleQuiz
);

router.put('/modules/:moduleId/quiz/:quizId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleQuizController.updateModuleQuiz
);

router.delete('/modules/:moduleId/quiz/:quizId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleQuizController.deleteModuleQuiz
);

// Routes étudiant
router.get('/enrollments/:enrollmentId/modules/:moduleId/quiz', 
  authenticateToken, 
  moduleQuizController.getModuleQuizForStudent
);

router.post('/enrollments/:enrollmentId/modules/:moduleId/quiz/attempt', 
  authenticateToken, 
  moduleQuizController.submitModuleQuizAttempt
);

module.exports = router;
```

### Fichier : `src/controllers/moduleQuizController.js`

```javascript
const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const { eventEmitter, EVENTS } = require('../middleware/eventEmitter');

// Créer un quiz pour un module
const createModuleQuiz = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const {
      title,
      description,
      passing_score = 70,
      badge_id,
      time_limit_minutes,
      max_attempts = 3,
      questions
    } = req.body;

    const instructorId = req.user.userId;

    // Vérifier que le module appartient à l'instructeur
    const [modules] = await pool.execute(
      'SELECT m.* FROM modules m JOIN courses c ON m.course_id = c.id WHERE m.id = ? AND c.instructor_id = ?',
      [moduleId, instructorId]
    );

    if (modules.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à créer un quiz pour ce module'
      });
    }

    // Vérifier qu'un quiz n'existe pas déjà
    const [existing] = await pool.execute(
      'SELECT id FROM module_quizzes WHERE module_id = ?',
      [moduleId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un quiz existe déjà pour ce module'
      });
    }

    // Créer le quiz
    const [quizResult] = await pool.execute(
      `INSERT INTO module_quizzes (
        module_id, title, description, passing_score, badge_id,
        time_limit_minutes, max_attempts, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        moduleId,
        sanitizeValue(title),
        sanitizeValue(description),
        passing_score,
        sanitizeValue(badge_id),
        sanitizeValue(time_limit_minutes),
        max_attempts
      ]
    );

    const quizId = quizResult.insertId;

    // Créer les questions (utiliser la même structure que quiz_questions)
    // TODO: Adapter selon votre structure de questions

    res.status(201).json({
      success: true,
      message: 'Quiz de module créé avec succès',
      data: {
        id: quizId,
        module_id: moduleId
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du quiz'
    });
  }
};

// Soumettre une tentative de quiz de module
const submitModuleQuizAttempt = async (req, res) => {
  try {
    const { enrollmentId, moduleId } = req.params;
    const { answers } = req.body;
    const userId = req.user.userId;

    // Vérifier l'inscription
    const [enrollments] = await pool.execute(
      'SELECT * FROM enrollments WHERE id = ? AND user_id = ?',
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    // Récupérer le quiz
    const [quizzes] = await pool.execute(
      'SELECT * FROM module_quizzes WHERE module_id = ? AND is_published = TRUE',
      [moduleId]
    );

    if (quizzes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé'
      });
    }

    const quiz = quizzes[0];

    // Vérifier les tentatives
    const [attempts] = await pool.execute(
      'SELECT COUNT(*) as count FROM module_quiz_attempts WHERE enrollment_id = ? AND module_quiz_id = ?',
      [enrollmentId, quiz.id]
    );

    if (attempts[0].count >= quiz.max_attempts) {
      return res.status(400).json({
        success: false,
        message: 'Nombre maximum de tentatives atteint'
      });
    }

    // Calculer le score (logique similaire à quizController)
    // TODO: Implémenter le calcul de score

    const score = 0; // À calculer
    const percentage = 0; // À calculer
    const isPassed = percentage >= quiz.passing_score;

    // Créer la tentative
    const [attemptResult] = await pool.execute(
      `INSERT INTO module_quiz_attempts (
        enrollment_id, module_quiz_id, user_id, answers,
        score, percentage, is_passed, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        enrollmentId,
        quiz.id,
        userId,
        JSON.stringify(answers),
        score,
        percentage,
        isPassed
      ]
    );

    // Si réussi et badge associé, attribuer le badge
    if (isPassed && quiz.badge_id) {
      // TODO: Attribuer le badge via GamificationService
      eventEmitter.emit(EVENTS.BADGE_EARNED, {
        userId,
        badgeId: quiz.badge_id
      });
    }

    res.json({
      success: true,
      message: 'Quiz soumis avec succès',
      data: {
        attempt_id: attemptResult.insertId,
        score,
        percentage,
        is_passed: isPassed
      }
    });

  } catch (error) {
    console.error('Erreur lors de la soumission:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la soumission'
    });
  }
};

module.exports = {
  createModuleQuiz,
  getModuleQuiz,
  updateModuleQuiz,
  deleteModuleQuiz,
  getModuleQuizForStudent,
  submitModuleQuizAttempt
};
```

---

## 📝 Évaluation Finale Obligatoire

### Modification : `src/controllers/evaluationController.js`

```javascript
// Modifier createEvaluation pour forcer l'unicité
const createEvaluation = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, passing_score = 70, duration_minutes, max_attempts = 3 } = req.body;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire
    const [courses] = await pool.execute(
      'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
      [courseId, instructorId]
    );

    if (courses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé'
      });
    }

    // Vérifier qu'une évaluation finale n'existe pas déjà
    const [existing] = await pool.execute(
      'SELECT id FROM course_evaluations WHERE course_id = ?',
      [courseId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Une évaluation finale existe déjà pour ce cours. Utilisez PUT pour la modifier.'
      });
    }

    // Créer l'évaluation finale
    const [result] = await pool.execute(
      `INSERT INTO course_evaluations (
        course_id, title, description, passing_score,
        duration_minutes, max_attempts, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [courseId, title, description, passing_score, duration_minutes, max_attempts]
    );

    // Mettre à jour courses.evaluation_id
    await pool.execute(
      'UPDATE courses SET evaluation_id = ? WHERE id = ?',
      [result.insertId, courseId]
    );

    res.status(201).json({
      success: true,
      message: 'Évaluation finale créée avec succès',
      data: {
        id: result.insertId,
        course_id: courseId
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création'
    });
  }
};
```

---

## ✅ Validation Admin Cours

### Fichier : `src/routes/courses/courseApprovalRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const courseApprovalController = require('../../controllers/courseApprovalController');
const { authenticateToken, authorize } = require('../../middleware/auth');
const { authenticateAdminToken } = require('../../middleware/adminAuth');

// Instructeur : Demander publication
router.post('/courses/:id/request-publication',
  authenticateToken,
  authorize(['instructor']),
  courseApprovalController.requestPublication
);

// Admin : Liste des cours en attente
router.get('/admin/courses/pending',
  authenticateAdminToken,
  courseApprovalController.getPendingCourses
);

// Admin : Approuver
router.post('/admin/courses/:id/approve',
  authenticateAdminToken,
  courseApprovalController.approveCourse
);

// Admin : Rejeter
router.post('/admin/courses/:id/reject',
  authenticateAdminToken,
  courseApprovalController.rejectCourse
);

module.exports = router;
```

### Fichier : `src/controllers/courseApprovalController.js`

```javascript
const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');

// Demander la publication d'un cours
const requestPublication = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user.userId;

    // Vérifier que le cours appartient à l'instructeur
    const [courses] = await pool.execute(
      'SELECT * FROM courses WHERE id = ? AND instructor_id = ?',
      [id, instructorId]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];

    // Vérifier les conditions de publication
    const validationErrors = [];

    // 1. Au moins un module avec au moins une leçon
    const [modules] = await pool.execute(
      `SELECT m.id FROM modules m
       JOIN lessons l ON m.id = l.module_id
       WHERE m.course_id = ? AND l.is_published = TRUE
       GROUP BY m.id`,
      [id]
    );

    if (modules.length === 0) {
      validationErrors.push('Le cours doit contenir au moins un module avec au moins une leçon publiée');
    }

    // 2. Évaluation finale créée
    const [evaluations] = await pool.execute(
      'SELECT id FROM course_evaluations WHERE course_id = ? AND is_published = TRUE',
      [id]
    );

    if (evaluations.length === 0) {
      validationErrors.push('Une évaluation finale est obligatoire');
    }

    // 3. Si cours Live : dates et max_students
    if (course.course_type === 'live') {
      if (!course.course_start_date || !course.course_end_date) {
        validationErrors.push('Les dates de début et fin sont obligatoires pour un cours Live');
      }
      if (!course.max_students || course.max_students <= 0) {
        validationErrors.push('Le nombre maximum d\'étudiants est obligatoire pour un cours Live');
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Le cours ne peut pas être publié',
        errors: validationErrors
      });
    }

    // Mettre à jour le statut
    await pool.execute(
      'UPDATE courses SET status = "pending_approval" WHERE id = ?',
      [id]
    );

    // Créer une entrée dans course_approvals
    await pool.execute(
      'INSERT INTO course_approvals (course_id, admin_id, status) VALUES (?, NULL, "pending")',
      [id]
    );

    res.json({
      success: true,
      message: 'Demande de publication soumise avec succès'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la demande'
    });
  }
};

// Liste des cours en attente (Admin)
const getPendingCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const [courses] = await pool.execute(
      `SELECT 
        c.*,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        ca.created_at as request_date
       FROM courses c
       JOIN users u ON c.instructor_id = u.id
       LEFT JOIN course_approvals ca ON c.id = ca.course_id AND ca.status = 'pending'
       WHERE c.status = 'pending_approval'
       ORDER BY ca.created_at ASC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: courses
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

// Approuver un cours (Admin)
const approveCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const adminId = req.user.userId;

    // Vérifier que le cours est en attente
    const [courses] = await pool.execute(
      'SELECT * FROM courses WHERE id = ? AND status = "pending_approval"',
      [id]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé ou déjà traité'
      });
    }

    // Mettre à jour le cours
    await pool.execute(
      `UPDATE courses SET 
        status = 'approved',
        approved_by = ?,
        approved_at = NOW()
       WHERE id = ?`,
      [adminId, id]
    );

    // Mettre à jour course_approvals
    await pool.execute(
      `UPDATE course_approvals SET 
        admin_id = ?,
        status = 'approved',
        comments = ?,
        reviewed_at = NOW()
       WHERE course_id = ? AND status = 'pending'`,
      [adminId, sanitizeValue(comments), id]
    );

    // Publier le cours
    await pool.execute(
      'UPDATE courses SET is_published = TRUE, status = "published" WHERE id = ?',
      [id]
    );

    // TODO: Envoyer notification à l'instructeur

    res.json({
      success: true,
      message: 'Cours approuvé et publié avec succès'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'approbation'
    });
  }
};

// Rejeter un cours (Admin)
const rejectCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason, comments } = req.body;
    const adminId = req.user.userId;

    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'La raison du rejet est obligatoire'
      });
    }

    // Vérifier que le cours est en attente
    const [courses] = await pool.execute(
      'SELECT * FROM courses WHERE id = ? AND status = "pending_approval"',
      [id]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé ou déjà traité'
      });
    }

    // Mettre à jour le cours
    await pool.execute(
      `UPDATE courses SET 
        status = 'rejected',
        approved_by = ?,
        approved_at = NOW(),
        rejection_reason = ?
       WHERE id = ?`,
      [adminId, sanitizeValue(rejection_reason), id]
    );

    // Mettre à jour course_approvals
    await pool.execute(
      `UPDATE course_approvals SET 
        admin_id = ?,
        status = 'rejected',
        rejection_reason = ?,
        comments = ?,
        reviewed_at = NOW()
       WHERE course_id = ? AND status = 'pending'`,
      [adminId, sanitizeValue(rejection_reason), sanitizeValue(comments), id]
    );

    // TODO: Envoyer notification à l'instructeur

    res.json({
      success: true,
      message: 'Cours rejeté avec succès'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rejet'
    });
  }
};

module.exports = {
  requestPublication,
  getPendingCourses,
  approveCourse,
  rejectCourse
};
```

---

## 💳 Système de Paiement

### Fichier : `src/routes/payments/paymentRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/paymentController');
const { authenticateToken } = require('../../middleware/auth');

// Initier un paiement
router.post('/initiate',
  authenticateToken,
  paymentController.initiatePayment
);

// Vérifier le statut d'un paiement
router.get('/:id/status',
  authenticateToken,
  paymentController.getPaymentStatus
);

// Historique des paiements
router.get('/my-payments',
  authenticateToken,
  paymentController.getMyPayments
);

module.exports = router;
```

### Fichier : `src/routes/payments/webhookRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const webhookController = require('../../controllers/webhookController');

// Webhook Stripe
router.post('/stripe',
  express.raw({ type: 'application/json' }),
  webhookController.handleStripeWebhook
);

// Webhook Mobile Money (Orange Money, MTN Mobile Money, etc.)
router.post('/mobile-money/:provider',
  webhookController.handleMobileMoneyWebhook
);

module.exports = router;
```

### Fichier : `src/controllers/paymentController.js`

```javascript
const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');

// Initier un paiement
const initiatePayment = async (req, res) => {
  try {
    const { courseId, paymentMethod, paymentProvider } = req.body;
    const userId = req.user.userId;

    if (!courseId || !paymentMethod || !paymentProvider) {
      return res.status(400).json({
        success: false,
        message: 'courseId, paymentMethod et paymentProvider sont requis'
      });
    }

    // Vérifier que le cours existe et est payant
    const [courses] = await pool.execute(
      'SELECT id, title, price, currency FROM courses WHERE id = ? AND is_published = TRUE',
      [courseId]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];

    if (!course.price || course.price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Ce cours est gratuit. Utilisez directement l\'inscription.'
      });
    }

    // Vérifier qu'un paiement n'est pas déjà en cours
    const [existingPayments] = await pool.execute(
      'SELECT id FROM payments WHERE user_id = ? AND course_id = ? AND status IN ("pending", "processing")',
      [userId, courseId]
    );

    if (existingPayments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un paiement est déjà en cours pour ce cours'
      });
    }

    // Créer l'enregistrement de paiement
    const [paymentResult] = await pool.execute(
      `INSERT INTO payments (
        user_id, course_id, amount, currency,
        payment_method, payment_provider, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        courseId,
        course.price,
        course.currency || 'XOF',
        paymentMethod,
        paymentProvider
      ]
    );

    const paymentId = paymentResult.insertId;

    // Initier le paiement selon le provider
    let paymentData = null;

    if (paymentMethod === 'card' && paymentProvider === 'stripe') {
      paymentData = await StripeService.createPaymentIntent({
        amount: course.price,
        currency: course.currency || 'xof',
        metadata: {
          payment_id: paymentId,
          user_id: userId,
          course_id: courseId
        }
      });

      // Mettre à jour avec l'ID de transaction
      await pool.execute(
        'UPDATE payments SET provider_transaction_id = ?, payment_data = ?, status = "processing" WHERE id = ?',
        [
          paymentData.client_secret,
          JSON.stringify(paymentData),
          paymentId
        ]
      );

    } else if (paymentMethod === 'mobile_money') {
      // Récupérer le numéro de téléphone depuis req.body
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis pour Mobile Money'
        });
      }

      paymentData = await MobileMoneyService.initiatePayment({
        provider: paymentProvider,
        amount: course.price,
        currency: course.currency || 'XOF',
        phoneNumber,
        paymentId,
        userId,
        courseId
      });

      // Mettre à jour avec l'ID de transaction
      await pool.execute(
        'UPDATE payments SET provider_transaction_id = ?, payment_data = ?, status = "processing" WHERE id = ?',
        [
          paymentData.transactionId,
          JSON.stringify(paymentData),
          paymentId
        ]
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Méthode de paiement non supportée'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Paiement initié avec succès',
      data: {
        payment_id: paymentId,
        payment_data: paymentData,
        redirect_url: paymentData.redirectUrl || null
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'initiation du paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'initiation du paiement',
      error: error.message
    });
  }
};

// Vérifier le statut d'un paiement
const getPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const [payments] = await pool.execute(
      `SELECT 
        p.*,
        c.title as course_title,
        c.slug as course_slug
       FROM payments p
       JOIN courses c ON p.course_id = c.id
       WHERE p.id = ? AND p.user_id = ?`,
      [id, userId]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paiement non trouvé'
      });
    }

    const payment = payments[0];

    // Si le paiement est en cours, vérifier avec le provider
    if (payment.status === 'processing' && payment.provider_transaction_id) {
      // TODO: Vérifier le statut avec le provider
      // await verifyPaymentWithProvider(payment);
    }

    res.json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
};

// Historique des paiements
const getMyPayments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.user_id = ?';
    let params = [userId];

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    const [payments] = await pool.execute(
      `SELECT 
        p.*,
        c.title as course_title,
        c.slug as course_slug,
        c.thumbnail_url
       FROM payments p
       JOIN courses c ON p.course_id = c.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Compter le total
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM payments p ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
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

module.exports = {
  initiatePayment,
  getPaymentStatus,
  getMyPayments
};
```

### Fichier : `src/controllers/webhookController.js`

```javascript
const { pool } = require('../config/database');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');

// Webhook Stripe
const handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = StripeService.verifyWebhookSignature(req.body, signature);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleStripePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handleStripePaymentFailed(event.data.object);
        break;
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Erreur webhook Stripe:', error);
    res.status(400).json({ error: error.message });
  }
};

// Gérer un paiement Stripe réussi
const handleStripePaymentSuccess = async (paymentIntent) => {
  const paymentId = paymentIntent.metadata?.payment_id;

  if (!paymentId) {
    console.error('payment_id manquant dans metadata');
    return;
  }

  // Mettre à jour le paiement
  await pool.execute(
    'UPDATE payments SET status = "completed", completed_at = NOW(), provider_transaction_id = ? WHERE id = ?',
    [paymentIntent.id, paymentId]
  );

  // Créer l'inscription automatiquement
  const [payments] = await pool.execute(
    'SELECT user_id, course_id FROM payments WHERE id = ?',
    [paymentId]
  );

  if (payments.length > 0) {
    const { user_id, course_id } = payments[0];

    // Vérifier qu'une inscription n'existe pas déjà
    const [existing] = await pool.execute(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
      [user_id, course_id]
    );

    if (existing.length === 0) {
      // Créer l'inscription
      const [enrollmentResult] = await pool.execute(
        `INSERT INTO enrollments (user_id, course_id, payment_id, enrollment_date, status)
         VALUES (?, ?, ?, NOW(), 'enrolled')`,
        [user_id, course_id, paymentId]
      );

      console.log(`Inscription créée automatiquement: ${enrollmentResult.insertId}`);
    }
  }
};

// Gérer un paiement Stripe échoué
const handleStripePaymentFailed = async (paymentIntent) => {
  const paymentId = paymentIntent.metadata?.payment_id;

  if (!paymentId) return;

  await pool.execute(
    'UPDATE payments SET status = "failed", error_message = ? WHERE id = ?',
    [paymentIntent.last_payment_error?.message || 'Paiement échoué', paymentId]
  );
};

// Webhook Mobile Money
const handleMobileMoneyWebhook = async (req, res) => {
  try {
    const { provider } = req.params;
    const payload = req.body;

    // Vérifier la signature selon le provider
    const isValid = await MobileMoneyService.verifyWebhookSignature(provider, payload);

    if (!isValid) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    // Traiter selon le provider
    switch (provider) {
      case 'orange-money':
        await handleOrangeMoneyWebhook(payload);
        break;
      case 'mtn-mobile-money':
        await handleMTNWebhook(payload);
        break;
      default:
        return res.status(400).json({ error: 'Provider non supporté' });
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Erreur webhook Mobile Money:', error);
    res.status(400).json({ error: error.message });
  }
};

// TODO: Implémenter les handlers spécifiques pour chaque provider Mobile Money
const handleOrangeMoneyWebhook = async (payload) => {
  // Implémentation spécifique Orange Money
};

const handleMTNWebhook = async (payload) => {
  // Implémentation spécifique MTN
};

module.exports = {
  handleStripeWebhook,
  handleMobileMoneyWebhook
};
```

### Fichier : `src/services/paymentProviders/stripeService.js`

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

class StripeService {
  // Créer un PaymentIntent
  static async createPaymentIntent({ amount, currency, metadata }) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convertir en centimes
        currency: currency.toLowerCase(),
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        redirectUrl: null // Pour Stripe, utiliser le client_secret côté frontend
      };

    } catch (error) {
      console.error('Erreur Stripe:', error);
      throw new Error(`Erreur Stripe: ${error.message}`);
    }
  }

  // Vérifier la signature du webhook
  static verifyWebhookSignature(payload, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    try {
      return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      throw new Error(`Signature invalide: ${error.message}`);
    }
  }

  // Récupérer le statut d'un paiement
  static async getPaymentStatus(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent.status;
    } catch (error) {
      throw new Error(`Erreur récupération statut: ${error.message}`);
    }
  }
}

module.exports = StripeService;
```

### Fichier : `src/services/paymentProviders/mobileMoneyService.js`

```javascript
const axios = require('axios');

class MobileMoneyService {
  // Initier un paiement Mobile Money
  static async initiatePayment({ provider, amount, currency, phoneNumber, paymentId, userId, courseId }) {
    try {
      // Configuration selon le provider
      const config = this.getProviderConfig(provider);

      const response = await axios.post(config.apiUrl, {
        amount,
        currency,
        phoneNumber,
        merchantId: config.merchantId,
        merchantKey: config.merchantKey,
        callbackUrl: `${process.env.BACKEND_URL}/api/payments/webhook/mobile-money/${provider}`,
        metadata: {
          payment_id: paymentId,
          user_id: userId,
          course_id: courseId
        }
      }, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        transactionId: response.data.transaction_id,
        redirectUrl: response.data.redirect_url || null,
        status: response.data.status
      };

    } catch (error) {
      console.error(`Erreur ${provider}:`, error);
      throw new Error(`Erreur ${provider}: ${error.message}`);
    }
  }

  // Vérifier la signature du webhook
  static async verifyWebhookSignature(provider, payload) {
    const config = this.getProviderConfig(provider);
    const signature = payload.signature || payload.hash;
    const expectedSignature = this.generateSignature(payload, config.webhookSecret);

    return signature === expectedSignature;
  }

  // Générer la signature
  static generateSignature(payload, secret) {
    const crypto = require('crypto');
    const data = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  // Configuration par provider
  static getProviderConfig(provider) {
    const configs = {
      'orange-money': {
        apiUrl: process.env.ORANGE_MONEY_API_URL,
        merchantId: process.env.ORANGE_MONEY_MERCHANT_ID,
        merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY,
        apiKey: process.env.ORANGE_MONEY_API_KEY,
        webhookSecret: process.env.ORANGE_MONEY_WEBHOOK_SECRET
      },
      'mtn-mobile-money': {
        apiUrl: process.env.MTN_MOBILE_MONEY_API_URL,
        merchantId: process.env.MTN_MERCHANT_ID,
        merchantKey: process.env.MTN_MERCHANT_KEY,
        apiKey: process.env.MTN_API_KEY,
        webhookSecret: process.env.MTN_WEBHOOK_SECRET
      }
    };

    const config = configs[provider];
    if (!config) {
      throw new Error(`Provider ${provider} non configuré`);
    }

    return config;
  }
}

module.exports = MobileMoneyService;
```

### Modification : `src/controllers/enrollmentController.js`

```javascript
// Dans enrollInCourse, ajouter vérification paiement
const enrollInCourse = async (req, res) => {
  try {
    const courseId = req.body.courseId || req.body.course_id;
    const userId = req.user?.id ?? req.user?.userId;
    const { paymentId } = req.body; // NOUVEAU

    // ... code existant pour vérifier cours ...

    const course = courses[0];

    // NOUVEAU : Vérifier le paiement si cours payant
    if (course.price && course.price > 0) {
      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: 'Ce cours est payant. Un paiement est requis.'
        });
      }

      // Vérifier que le paiement est complété
      const [payments] = await pool.execute(
        'SELECT id, status FROM payments WHERE id = ? AND user_id = ? AND course_id = ?',
        [paymentId, userId, courseId]
      );

      if (payments.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Paiement non trouvé'
        });
      }

      if (payments[0].status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Le paiement n\'est pas complété'
        });
      }
    }

    // Créer l'inscription avec payment_id
    const [enrollmentResult] = await pool.execute(
      `INSERT INTO enrollments (
        user_id, course_id, enrollment_date, status, payment_id
      ) VALUES (?, ?, NOW(), 'enrolled', ?)`,
      [userId, courseId, course.price > 0 ? paymentId : null]
    );

    // ... reste du code ...
  } catch (error) {
    // ... gestion erreur ...
  }
};
```

---

## 🔒 Progression Séquentielle

### Modification : `src/services/progressService.js`

```javascript
// Ajouter méthode pour vérifier l'accès à une leçon
static async checkLessonAccess(enrollmentId, lessonId) {
  const enrollmentQuery = 'SELECT * FROM enrollments WHERE id = ?';
  const [enrollments] = await pool.execute(enrollmentQuery, [enrollmentId]);
  
  if (enrollments.length === 0) {
    throw new Error('Inscription non trouvée');
  }

  const enrollment = enrollments[0];

  // Récupérer le cours
  const [courses] = await pool.execute(
    'SELECT is_sequential FROM courses WHERE id = ?',
    [enrollment.course_id]
  );

  if (courses.length === 0) {
    throw new Error('Cours non trouvé');
  }

  const course = courses[0];

  // Si progression non séquentielle, autoriser l'accès
  if (!course.is_sequential) {
    return { hasAccess: true, reason: 'Progression non séquentielle' };
  }

  // Récupérer la leçon
  const [lessons] = await pool.execute(
    'SELECT id, module_id, order_index, is_optional FROM lessons WHERE id = ?',
    [lessonId]
  );

  if (lessons.length === 0) {
    throw new Error('Leçon non trouvée');
  }

  const lesson = lessons[0];

  // Si leçon optionnelle, autoriser l'accès
  if (lesson.is_optional) {
    return { hasAccess: true, reason: 'Leçon optionnelle' };
  }

  // Récupérer toutes les leçons précédentes du même module
  const [previousLessons] = await pool.execute(
    `SELECT l.id FROM lessons l
     WHERE l.module_id = ? 
     AND l.order_index < ?
     AND l.is_published = TRUE
     AND l.is_optional = FALSE
     ORDER BY l.order_index`,
    [lesson.module_id, lesson.order_index]
  );

  // Vérifier que toutes les leçons précédentes sont complétées
  for (const prevLesson of previousLessons) {
    const [progress] = await pool.execute(
      'SELECT id FROM progress WHERE enrollment_id = ? AND lesson_id = ? AND status = "completed"',
      [enrollmentId, prevLesson.id]
    );

    if (progress.length === 0) {
      return {
        hasAccess: false,
        reason: `Vous devez compléter toutes les leçons précédentes`,
        requiredLessonId: prevLesson.id
      };
    }
  }

  // Vérifier aussi les modules précédents si nécessaire
  const [lessonModule] = await pool.execute(
    'SELECT order_index FROM modules WHERE id = ?',
    [lesson.module_id]
  );

  if (lessonModule.length > 0 && lessonModule[0].order_index > 1) {
    // Vérifier que tous les modules précédents sont complétés
    const [previousModules] = await pool.execute(
      `SELECT m.id FROM modules m
       WHERE m.course_id = ?
       AND m.order_index < ?
       ORDER BY m.order_index`,
      [enrollment.course_id, lessonModule[0].order_index]
    );

    for (const prevModule of previousModules) {
      // Vérifier que toutes les leçons du module précédent sont complétées
      const [moduleLessons] = await pool.execute(
        `SELECT l.id FROM lessons l
         WHERE l.module_id = ? AND l.is_published = TRUE AND l.is_optional = FALSE`,
        [prevModule.id]
      );

      for (const moduleLesson of moduleLessons) {
        const [progress] = await pool.execute(
          'SELECT id FROM progress WHERE enrollment_id = ? AND lesson_id = ? AND status = "completed"',
          [enrollmentId, moduleLesson.id]
        );

        if (progress.length === 0) {
          return {
            hasAccess: false,
            reason: `Vous devez compléter le module précédent`,
            requiredModuleId: prevModule.id
          };
        }
      }
    }
  }

  return { hasAccess: true, reason: 'Accès autorisé' };
}

// Déverrouiller la leçon suivante après complétion
static async unlockNextLesson(enrollmentId, lessonId) {
  const [lessons] = await pool.execute(
    'SELECT module_id, order_index, course_id FROM lessons WHERE id = ?',
    [lessonId]
  );

  if (lessons.length === 0) return;

  const lesson = lessons[0];

  // Récupérer la leçon suivante du même module
  const [nextLessons] = await pool.execute(
    `SELECT id FROM lessons 
     WHERE module_id = ? 
     AND order_index = ? + 1
     AND is_published = TRUE
     LIMIT 1`,
    [lesson.module_id, lesson.order_index]
  );

  // Si pas de leçon suivante dans le module, vérifier le module suivant
  if (nextLessons.length === 0) {
    const [currentModule] = await pool.execute(
      'SELECT order_index FROM modules WHERE id = ?',
      [lesson.module_id]
    );

    if (currentModule.length > 0) {
      const [nextModules] = await pool.execute(
        `SELECT id FROM modules 
         WHERE course_id = ? 
         AND order_index = ? + 1
         ORDER BY order_index
         LIMIT 1`,
        [lesson.course_id, currentModule[0].order_index]
      );

      if (nextModules.length > 0) {
        // Déverrouiller la première leçon du module suivant
        const [firstLessons] = await pool.execute(
          `SELECT id FROM lessons 
           WHERE module_id = ? 
           AND is_published = TRUE
           ORDER BY order_index
           LIMIT 1`,
          [nextModules[0].id]
        );

        if (firstLessons.length > 0) {
          // La leçon suivante sera automatiquement déverrouillée
          // car toutes les leçons précédentes sont complétées
          return { unlockedLessonId: firstLessons[0].id };
        }
      }
    }
  } else {
    return { unlockedLessonId: nextLessons[0].id };
  }

  return null;
}
```

### Fichier : `src/routes/progress/progressRoutes.js` (à ajouter)

```javascript
const express = require('express');
const router = express.Router();
const progressController = require('../../controllers/progressController');
const { authenticateToken } = require('../../middleware/auth');

// Vérifier l'accès à une leçon
router.get('/enrollments/:enrollmentId/lessons/:lessonId/access',
  authenticateToken,
  progressController.checkLessonAccess
);

// Compléter une leçon (déverrouille la suivante)
router.post('/enrollments/:enrollmentId/lessons/:lessonId/complete',
  authenticateToken,
  progressController.completeLesson
);

module.exports = router;
```

### Modification : `src/controllers/progressController.js`

```javascript
const ProgressService = require('../services/progressService');

// Vérifier l'accès à une leçon
const checkLessonAccess = async (req, res) => {
  try {
    const { enrollmentId, lessonId } = req.params;
    const userId = req.user.id;

    // Vérifier que l'inscription appartient à l'utilisateur
    const [enrollments] = await pool.execute(
      'SELECT user_id FROM enrollments WHERE id = ?',
      [enrollmentId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    if (enrollments[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    const access = await ProgressService.checkLessonAccess(enrollmentId, lessonId);

    res.json({
      success: true,
      data: access
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la vérification'
    });
  }
};

// Compléter une leçon
const completeLesson = async (req, res) => {
  try {
    const { enrollmentId, lessonId } = req.params;
    const { time_spent } = req.body;
    const userId = req.user.id;

    // Vérifier l'accès
    const access = await ProgressService.checkLessonAccess(enrollmentId, lessonId);

    if (!access.hasAccess) {
      return res.status(403).json({
        success: false,
        message: access.reason
      });
    }

    // Marquer comme complété
    const progress = await ProgressService.markLessonCompleted(
      enrollmentId,
      lessonId,
      time_spent || 0
    );

    // Déverrouiller la leçon suivante
    const unlocked = await ProgressService.unlockNextLesson(enrollmentId, lessonId);

    res.json({
      success: true,
      message: 'Leçon complétée',
      data: {
        progress,
        unlockedNextLesson: unlocked
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la complétion'
    });
  }
};

module.exports = {
  // ... exports existants
  checkLessonAccess,
  completeLesson
};
```

---

## 🎓 Workflow Certificats

### Fichier : `src/routes/certificates/certificateRequestRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const certificateRequestController = require('../../controllers/certificateRequestController');
const { authenticateToken } = require('../../middleware/auth');
const { authenticateAdminToken } = require('../../middleware/adminAuth');

// Vérifier éligibilité
router.get('/eligibility/:enrollmentId',
  authenticateToken,
  certificateRequestController.checkEligibility
);

// Demander un certificat
router.post('/request',
  authenticateToken,
  certificateRequestController.requestCertificate
);

// Mes certificats (déjà existant, mais à enrichir)
router.get('/my-certificates',
  authenticateToken,
  certificateRequestController.getMyCertificates
);

// Admin : Liste des demandes en attente
router.get('/admin/pending',
  authenticateAdminToken,
  certificateRequestController.getPendingRequests
);

// Admin : Approuver
router.post('/admin/:requestId/approve',
  authenticateAdminToken,
  certificateRequestController.approveRequest
);

// Admin : Rejeter
router.post('/admin/:requestId/reject',
  authenticateAdminToken,
  certificateRequestController.rejectRequest
);

module.exports = router;
```

### Fichier : `src/controllers/certificateRequestController.js`

```javascript
const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const { generateCertificateForCourse } = require('./certificateController');

// Vérifier l'éligibilité
const checkEligibility = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.userId;

    // Vérifier l'inscription
    const [enrollments] = await pool.execute(
      'SELECT * FROM enrollments WHERE id = ? AND user_id = ?',
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    const enrollment = enrollments[0];

    // Vérifier que le cours est complété
    if (enrollment.status !== 'completed') {
      return res.json({
        success: true,
        eligible: false,
        reason: 'Le cours n\'est pas complété'
      });
    }

    // Vérifier l'évaluation finale si elle existe
    const [evaluations] = await pool.execute(
      `SELECT ce.* FROM course_evaluations ce
       JOIN courses c ON ce.course_id = c.id
       WHERE c.id = ? AND ce.is_published = TRUE`,
      [enrollment.course_id]
    );

    if (evaluations.length > 0) {
      const evaluation = evaluations[0];

      // Vérifier qu'une tentative réussie existe
      const [attempts] = await pool.execute(
        `SELECT id FROM course_evaluation_attempts
         WHERE enrollment_id = ? AND evaluation_id = ? AND is_passed = TRUE`,
        [enrollmentId, evaluation.id]
      );

      if (attempts.length === 0) {
        return res.json({
          success: true,
          eligible: false,
          reason: 'L\'évaluation finale doit être réussie'
        });
      }
    }

    // Vérifier qu'une demande n'existe pas déjà
    const [existingRequests] = await pool.execute(
      'SELECT id, status FROM certificate_requests WHERE enrollment_id = ?',
      [enrollmentId]
    );

    if (existingRequests.length > 0) {
      const request = existingRequests[0];
      return res.json({
        success: true,
        eligible: false,
        reason: `Une demande existe déjà (statut: ${request.status})`,
        request_id: request.id,
        status: request.status
      });
    }

    res.json({
      success: true,
      eligible: true,
      message: 'Vous êtes éligible pour un certificat'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
};

// Demander un certificat
const requestCertificate = async (req, res) => {
  try {
    const { enrollmentId, userInfo } = req.body;
    const userId = req.user.userId;

    if (!enrollmentId || !userInfo) {
      return res.status(400).json({
        success: false,
        message: 'enrollmentId et userInfo sont requis'
      });
    }

    // Vérifier l'éligibilité
    const eligibility = await checkEligibilityInternal(enrollmentId, userId);

    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        message: eligibility.reason
      });
    }

    // Récupérer l'inscription
    const [enrollments] = await pool.execute(
      'SELECT course_id FROM enrollments WHERE id = ? AND user_id = ?',
      [enrollmentId, userId]
    );

    const courseId = enrollments[0].course_id;

    // Créer la demande
    const [requestResult] = await pool.execute(
      `INSERT INTO certificate_requests (
        enrollment_id, user_id, course_id, status, user_info
      ) VALUES (?, ?, ?, 'pending', ?)`,
      [enrollmentId, userId, courseId, JSON.stringify(userInfo)]
    );

    res.status(201).json({
      success: true,
      message: 'Demande de certificat créée avec succès',
      data: {
        request_id: requestResult.insertId
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la demande'
    });
  }
};

// Liste des demandes en attente (Admin)
const getPendingRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const [requests] = await pool.execute(
      `SELECT 
        cr.*,
        u.first_name, u.last_name, u.email,
        c.title as course_title,
        e.status as enrollment_status
       FROM certificate_requests cr
       JOIN users u ON cr.user_id = u.id
       JOIN courses c ON cr.course_id = c.id
       JOIN enrollments e ON cr.enrollment_id = e.id
       WHERE cr.status = 'pending'
       ORDER BY cr.created_at ASC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    res.json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

// Approuver une demande (Admin)
const approveRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user.userId;

    // Récupérer la demande
    const [requests] = await pool.execute(
      'SELECT * FROM certificate_requests WHERE id = ? AND status = "pending"',
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée ou déjà traitée'
      });
    }

    const request = requests[0];

    // Générer le certificat
    const certificateId = await generateCertificateForCourse(
      request.user_id,
      request.course_id
    );

    // Mettre à jour la demande
    await pool.execute(
      `UPDATE certificate_requests SET 
        status = 'approved',
        reviewed_by = ?,
        reviewed_at = NOW(),
        issued_at = NOW()
       WHERE id = ?`,
      [adminId, requestId]
    );

    // Récupérer le numéro de certificat
    const [certificates] = await pool.execute(
      'SELECT certificate_number FROM certificates WHERE id = ?',
      [certificateId]
    );

    if (certificates.length > 0) {
      await pool.execute(
        'UPDATE certificate_requests SET certificate_number = ? WHERE id = ?',
        [certificates[0].certificate_number, requestId]
      );
    }

    // Mettre à jour le certificat avec request_id
    await pool.execute(
      'UPDATE certificates SET request_id = ? WHERE id = ?',
      [requestId, certificateId]
    );

    // TODO: Envoyer notification à l'étudiant

    res.json({
      success: true,
      message: 'Certificat approuvé et généré avec succès',
      data: {
        certificate_id: certificateId,
        certificate_number: certificates[0]?.certificate_number
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'approbation'
    });
  }
};

// Rejeter une demande (Admin)
const rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejection_reason } = req.body;
    const adminId = req.user.userId;

    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'La raison du rejet est obligatoire'
      });
    }

    // Mettre à jour la demande
    await pool.execute(
      `UPDATE certificate_requests SET 
        status = 'rejected',
        rejection_reason = ?,
        reviewed_by = ?,
        reviewed_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [sanitizeValue(rejection_reason), adminId, requestId]
    );

    // TODO: Envoyer notification à l'étudiant

    res.json({
      success: true,
      message: 'Demande rejetée avec succès'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rejet'
    });
  }
};

// Fonction interne pour vérifier l'éligibilité
const checkEligibilityInternal = async (enrollmentId, userId) => {
  // ... même logique que checkEligibility mais retourne un objet
  // (code similaire à checkEligibility)
};

module.exports = {
  checkEligibility,
  requestCertificate,
  getPendingRequests,
  approveRequest,
  rejectRequest
};
```

---

## 💬 Messagerie par Email

### Modification : `src/controllers/messageController.js`

```javascript
// Ajouter recherche par email
const searchUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Email invalide'
      });
    }

    const [users] = await pool.execute(
      `SELECT id, email, first_name, last_name, role, profile_picture
       FROM users 
       WHERE email = ? AND is_active = TRUE
       LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        id: users[0].id,
        email: users[0].email,
        name: `${users[0].first_name} ${users[0].last_name}`,
        role: users[0].role,
        profile_picture: users[0].profile_picture
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche'
    });
  }
};

// Modifier sendMessage pour accepter email
const sendMessage = async (req, res) => {
  try {
    const { recipient_id, recipient_email, subject, content, message_type = 'direct' } = req.body;
    const senderId = req.user.userId;

    let recipientId = recipient_id;
    let recipientEmail = recipient_email;

    // Si recipient_email est fourni, rechercher l'utilisateur
    if (recipient_email && !recipient_id) {
      const [users] = await pool.execute(
        'SELECT id, email FROM users WHERE email = ? AND is_active = TRUE',
        [recipient_email]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Destinataire non trouvé'
        });
      }

      recipientId = users[0].id;
      recipientEmail = users[0].email;
    } else if (recipient_id && !recipient_email) {
      // Récupérer l'email depuis l'ID
      const [users] = await pool.execute(
        'SELECT email FROM users WHERE id = ?',
        [recipient_id]
      );

      if (users.length > 0) {
        recipientEmail = users[0].email;
      }
    }

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'recipient_id ou recipient_email requis'
      });
    }

    // Récupérer l'email de l'expéditeur
    const [senders] = await pool.execute(
      'SELECT email FROM users WHERE id = ?',
      [senderId]
    );

    const senderEmail = senders.length > 0 ? senders[0].email : null;

    // Insérer le message avec emails
    const insertQuery = `
      INSERT INTO messages (
        sender_id, sender_email, recipient_id, recipient_email,
        subject, content, message_type, is_read, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      senderId, senderEmail, recipientId, recipientEmail,
      subject, content, message_type
    ]);

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès',
      data: {
        id: result.insertId
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi'
    });
  }
};

// Récupérer une conversation par email
const getConversationByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const userId = req.user.userId;

    // Récupérer l'ID de l'utilisateur
    const [users] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const otherUserId = users[0].id;

    // Récupérer tous les messages de la conversation
    const [messages] = await pool.execute(
      `SELECT 
        m.*,
        sender.first_name as sender_first_name,
        sender.last_name as sender_last_name,
        recipient.first_name as recipient_first_name,
        recipient.last_name as recipient_last_name
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users recipient ON m.recipient_id = recipient.id
       WHERE (m.sender_id = ? AND m.recipient_id = ?)
          OR (m.sender_id = ? AND m.recipient_id = ?)
       ORDER BY m.created_at ASC`,
      [userId, otherUserId, otherUserId, userId]
    );

    res.json({
      success: true,
      data: {
        conversation_with: {
          id: otherUserId,
          email: email
        },
        messages: messages.map(msg => ({
          id: msg.id,
          subject: msg.subject,
          content: msg.content,
          sender_id: msg.sender_id,
          sender_email: msg.sender_email,
          recipient_id: msg.recipient_id,
          recipient_email: msg.recipient_email,
          is_read: msg.is_read,
          created_at: msg.created_at
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

// Liste des conversations organisées par email
const getMyConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Récupérer les conversations uniques (groupées par email)
    const [conversations] = await pool.execute(
      `SELECT 
        CASE 
          WHEN m.sender_id = ? THEN m.recipient_email
          ELSE m.sender_email
        END as conversation_email,
        CASE 
          WHEN m.sender_id = ? THEN m.recipient_id
          ELSE m.sender_id
        END as conversation_user_id,
        MAX(m.created_at) as last_message_date,
        COUNT(CASE WHEN m.recipient_id = ? AND m.is_read = FALSE THEN 1 END) as unread_count
       FROM messages m
       WHERE m.sender_id = ? OR m.recipient_id = ?
       GROUP BY conversation_email, conversation_user_id
       ORDER BY last_message_date DESC
       LIMIT ? OFFSET ?`,
      [userId, userId, userId, userId, userId, parseInt(limit), offset]
    );

    // Enrichir avec les informations utilisateur
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const [users] = await pool.execute(
          'SELECT first_name, last_name, profile_picture FROM users WHERE id = ?',
          [conv.conversation_user_id]
        );

        return {
          email: conv.conversation_email,
          user_id: conv.conversation_user_id,
          name: users.length > 0 ? `${users[0].first_name} ${users[0].last_name}` : null,
          profile_picture: users.length > 0 ? users[0].profile_picture : null,
          last_message_date: conv.last_message_date,
          unread_count: conv.unread_count
        };
      })
    );

    res.json({
      success: true,
      data: enrichedConversations
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
  // ... exports existants
  searchUserByEmail,
  sendMessage, // Modifié
  getConversationByEmail,
  getMyConversations
};
```

### Modification : `src/routes/messageRoutes.js`

```javascript
// Ajouter les nouvelles routes
router.get('/search-user/:email', authenticateToken, messageController.searchUserByEmail);
router.post('/send', authenticateToken, messageController.sendMessage); // Modifié
router.get('/conversation/:email', authenticateToken, messageController.getConversationByEmail);
router.get('/my-conversations', authenticateToken, messageController.getMyConversations);
```

---

## 📝 Notes Finales

### Structure des Fichiers à Créer

```
src/
├── routes/
│   ├── auth/
│   │   └── adminAuthRoutes.js        ✅ NOUVEAU
│   ├── courses/
│   │   └── courseApprovalRoutes.js   ✅ NOUVEAU
│   ├── modules/
│   │   └── moduleQuizRoutes.js      ✅ NOUVEAU
│   └── payments/
│       ├── paymentRoutes.js         ✅ NOUVEAU
│       └── webhookRoutes.js         ✅ NOUVEAU
├── controllers/
│   ├── adminAuthController.js       ✅ NOUVEAU
│   ├── courseApprovalController.js   ✅ NOUVEAU
│   ├── moduleQuizController.js      ✅ NOUVEAU
│   ├── paymentController.js         ✅ NOUVEAU
│   └── certificateRequestController.js ✅ NOUVEAU
├── middleware/
│   └── adminAuth.js                 ✅ NOUVEAU
└── services/
    ├── paymentProviders/
    │   ├── stripeService.js         ✅ NOUVEAU
    │   └── mobileMoneyService.js    ✅ NOUVEAU
    └── certificateGenerator.js      ✅ NOUVEAU (à améliorer)
```

### Checklist d'Implémentation

- [ ] Migrations base de données
- [ ] Authentification admin
- [ ] Type de cours et dates
- [ ] Quiz de modules
- [ ] Évaluation finale obligatoire
- [ ] Validation admin
- [ ] Système de paiement
- [ ] Progression séquentielle
- [ ] Workflow certificats
- [ ] Messagerie par email

---

*Document créé le : 2024-01-XX*  
*Dernière mise à jour : 2024-01-XX*

