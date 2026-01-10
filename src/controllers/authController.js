const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const SHA256_REGEX = /^[A-Fa-f0-9]{64}$/;

// Générer un token JWT
const generateToken = (userId, email, role) => {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET || 'mdsc_secret_key_2024_super_secure_change_in_production',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Générer un refresh token
const generateRefreshToken = (userId, email, role) => {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_REFRESH_SECRET || 'mdsc_refresh_secret_key_2024_super_secure_change_in_production',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
};

const normalizeTokenHash = (token) => {
  if (token === undefined || token === null) {
    return null;
  }

  const trimmedToken = String(token).trim();
  if (!trimmedToken) {
    return null;
  }

  if (SHA256_REGEX.test(trimmedToken)) {
    return trimmedToken.toLowerCase();
  }

  return crypto.createHash('sha256').update(trimmedToken).digest('hex');
};

// Inscription
exports.register = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      npi, 
      phone, 
      organization, 
      country,
      role
    } = req.body;

    // Valider le rôle (student, instructor ou admin)
    const validRoles = ['student', 'instructor', 'admin'];
    const userRole = validRoles.includes(role) ? role : 'student';

    // Vérifier si l'utilisateur existe déjà
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un compte existe déjà avec cette adresse email'
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
    const [result] = await connection.query(
      'INSERT INTO users (email, password, first_name, last_name, phone, organization, country, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, firstName, lastName, phone, organization, country, userRole]
    );

    const userId = result.insertId;

    // Générer un token de vérification d'email (stockage hashé en base)
    const verificationToken = uuidv4();
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.EMAIL_VERIFICATION_EXPIRE || 24));

    await connection.query(
      'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, verificationTokenHash, expiresAt]
    );

    // Envoyer l'email de vérification (optionnel - ne fait pas échouer l'inscription si erreur)
    try {
      await sendVerificationEmail(email, firstName, verificationTokenHash);
      console.log('✅ Email de vérification envoyé à:', email);
    } catch (emailError) {
      console.error('❌ Erreur envoi email de vérification:', emailError.message);
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️  L\'utilisateur devra vérifier son email manuellement');
        console.log('📧 Token de vérification (hash):', verificationTokenHash);
        console.log('🔗 Lien de vérification:', `${process.env.VERIFY_EMAIL_URL}?token=${verificationTokenHash}`);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Inscription réussie ! Veuillez vérifier votre email pour activer votre compte.',
      data: {
        userId,
        email,
        firstName,
        lastName,
        npi,
        phone,
        organization,
        country,
        verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
      }
    });

  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
};

// Vérification d'email
exports.verifyEmail = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { token } = req.body;
    const providedHash = normalizeTokenHash(token);

    if (!providedHash) {
      return res.status(400).json({
        success: false,
        message: 'Token de vérification invalide'
      });
    }

    // Vérifier le token
    const [tokens] = await connection.query(
      'SELECT user_id, expires_at FROM email_verification_tokens WHERE token = ?',
      [providedHash]
    );

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token de vérification invalide'
      });
    }

    const { user_id, expires_at } = tokens[0];

    // Vérifier l'expiration
    if (new Date() > new Date(expires_at)) {
      await connection.query('DELETE FROM email_verification_tokens WHERE token = ?', [providedHash]);
      return res.status(400).json({
        success: false,
        message: 'Le token de vérification a expiré. Veuillez demander un nouveau lien.'
      });
    }

    // Mettre à jour l'utilisateur
    await connection.query(
      'UPDATE users SET is_email_verified = TRUE, email_verified_at = NOW() WHERE id = ?',
      [user_id]
    );

    // Supprimer le token utilisé
    await connection.query('DELETE FROM email_verification_tokens WHERE token = ?', [providedHash]);

    res.json({
      success: true,
      message: 'Email vérifié avec succès ! Vous pouvez maintenant vous connecter.'
    });

  } catch (error) {
    console.error('Erreur vérification email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de l\'email'
    });
  } finally {
    connection.release();
  }
};

// Connexion
exports.login = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { email, password } = req.body;

    // Récupérer l'utilisateur
    const [users] = await connection.query(
      'SELECT id, email, password, first_name, last_name, is_email_verified, is_active, role FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const user = users[0];

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier si l'email est vérifié
    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Veuillez vérifier votre email avant de vous connecter',
        emailNotVerified: true
      });
    }

    // Vérifier si le compte est actif
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Votre compte a été désactivé. Contactez l\'administrateur.'
      });
    }

    // Générer les tokens
    const token = generateToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id, user.email, user.role);

    // Stocker le refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);

    await connection.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [user.id, refreshToken, refreshExpiresAt, req.ip, req.get('user-agent')]
    );

    // Mettre à jour la dernière connexion
    await connection.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    // Enregistrer la session
    const userAgent = req.get('user-agent') || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
    
    await connection.query(
      'INSERT INTO user_sessions (user_id, ip_address, user_agent, login_at) VALUES (?, ?, ?, NOW())',
      [user.id, ipAddress, userAgent]
    );

    // Créer une notification de connexion (seulement pour les étudiants)
    if (user.role === 'student') {
      try {
        // Extraire des informations sur la machine depuis user-agent
        const deviceInfo = userAgent.includes('Mobile') ? 'Mobile' : 
                          userAgent.includes('Tablet') ? 'Tablet' : 'Desktop';
        const browserInfo = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[0] || 'Navigateur inconnu';
        
        await connection.query(
          `INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            user.id,
            '🔐 Connexion réussie',
            `Vous vous êtes connecté depuis ${deviceInfo} (${browserInfo}) - IP: ${ipAddress}`,
            'user_login',
            '/dashboard/student',
            JSON.stringify({ 
              ip_address: ipAddress, 
              user_agent: userAgent,
              device: deviceInfo,
              browser: browserInfo,
              login_at: new Date().toISOString()
            })
          ]
        );
      } catch (notificationError) {
        console.error('Erreur lors de la création de la notification de connexion:', notificationError);
      }

      // Enregistrer l'activité de connexion
      try {
        const { recordActivity } = require('./gamificationController');
        await recordActivity(
          user.id,
          'login',
          5, // Points pour la connexion
          `Connexion depuis ${ipAddress}`,
          { 
            ip_address: ipAddress, 
            user_agent: userAgent,
            device: userAgent.includes('Mobile') ? 'Mobile' : userAgent.includes('Tablet') ? 'Tablet' : 'Desktop'
          }
        );
      } catch (activityError) {
        console.error('Erreur lors de l\'enregistrement de l\'activité de connexion:', activityError);
      }
    }

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
    });
  } finally {
    connection.release();
  }
};

// Renvoyer l'email de vérification
exports.resendVerificationEmail = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { email } = req.body;

    // Récupérer l'utilisateur
    const [users] = await connection.query(
      'SELECT id, first_name, is_email_verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucun compte trouvé avec cette adresse email'
      });
    }

    const user = users[0];

    if (user.is_email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà vérifié'
      });
    }

    // Supprimer les anciens tokens
    await connection.query('DELETE FROM email_verification_tokens WHERE user_id = ?', [user.id]);

    // Générer un nouveau token (stockage hashé)
    const verificationToken = uuidv4();
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.EMAIL_VERIFICATION_EXPIRE || 24));

    await connection.query(
      'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, verificationTokenHash, expiresAt]
    );

    // Envoyer l'email
    try {
      await sendVerificationEmail(email, user.first_name, verificationTokenHash);
    } catch (emailError) {
      console.error('❌ Erreur renvoi email de vérification:', emailError.message);
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔗 Lien de vérification manuel:', `${process.env.VERIFY_EMAIL_URL}?token=${verificationTokenHash}`);
      }
      throw emailError;
    }

    res.json({
      success: true,
      message: 'Email de vérification renvoyé avec succès'
    });

  } catch (error) {
    console.error('Erreur renvoi email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du renvoi de l\'email de vérification'
    });
  } finally {
    connection.release();
  }
};

// Demande de réinitialisation de mot de passe
exports.forgotPassword = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { email } = req.body;

    // Récupérer l'utilisateur
    const [users] = await connection.query(
      'SELECT id, first_name, is_email_verified FROM users WHERE email = ?',
      [email]
    );

    // Pour des raisons de sécurité, on renvoie toujours un message de succès
    if (users.length === 0) {
      return res.json({
        success: true,
        message: 'Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation.'
      });
    }

    const user = users[0];

    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Veuillez d\'abord vérifier votre email'
      });
    }

    // Supprimer les anciens tokens non utilisés
    await connection.query(
      'DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );

    // Générer un nouveau token (stockage hashé)
    const resetToken = uuidv4();
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.PASSWORD_RESET_EXPIRE || 1));

    await connection.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetTokenHash, expiresAt]
    );

    // Envoyer l'email
    try {
      await sendPasswordResetEmail(email, user.first_name, resetTokenHash);
    } catch (emailError) {
      console.error('❌ Erreur envoi email de réinitialisation:', emailError.message);
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔗 Lien de réinitialisation manuel:', `${process.env.RESET_PASSWORD_URL}?token=${resetTokenHash}`);
      }
      throw emailError;
    }

    res.json({
      success: true,
      message: 'Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation.'
    });

  } catch (error) {
    console.error('Erreur forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la demande de réinitialisation'
    });
  } finally {
    connection.release();
  }
};

// Réinitialisation du mot de passe
exports.resetPassword = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { token, newPassword } = req.body;
    const providedHash = normalizeTokenHash(token);

    if (!providedHash) {
      return res.status(400).json({
        success: false,
        message: 'Token de réinitialisation invalide'
      });
    }

    // Vérifier le token
    const [tokens] = await connection.query(
      'SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?',
      [providedHash]
    );

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token de réinitialisation invalide'
      });
    }

    const { user_id, expires_at, used_at } = tokens[0];

    // Vérifier si le token a déjà été utilisé
    if (used_at) {
      return res.status(400).json({
        success: false,
        message: 'Ce token a déjà été utilisé'
      });
    }

    // Vérifier l'expiration
    if (new Date() > new Date(expires_at)) {
      await connection.query('DELETE FROM password_reset_tokens WHERE token = ?', [providedHash]);
      return res.status(400).json({
        success: false,
        message: 'Le token de réinitialisation a expiré. Veuillez faire une nouvelle demande.'
      });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour le mot de passe
    await connection.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, user_id]
    );

    // Marquer le token comme utilisé
    await connection.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ?',
      [providedHash]
    );

    // Révoquer tous les refresh tokens de l'utilisateur (sécurité)
    await connection.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [user_id]
    );

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
    });

  } catch (error) {
    console.error('Erreur reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du mot de passe'
    });
  } finally {
    connection.release();
  }
};

// Rafraîchir le token
exports.refreshToken = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token manquant'
      });
    }

    // Vérifier le refresh token dans la base de données
    const [tokens] = await connection.query(
      'SELECT user_id, expires_at, revoked_at FROM refresh_tokens WHERE token = ?',
      [refreshToken]
    );

    if (tokens.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token invalide'
      });
    }

    const { user_id, expires_at, revoked_at } = tokens[0];

    // Vérifier si le token a été révoqué
    if (revoked_at) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token révoqué'
      });
    }

    // Vérifier l'expiration
    if (new Date() > new Date(expires_at)) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expiré'
      });
    }

    // Vérifier le JWT
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token invalide'
      });
    }

    // Récupérer les infos utilisateur
    const [users] = await connection.query(
      'SELECT email, role FROM users WHERE id = ?',
      [user_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const user = users[0];

    // Générer un nouveau token
    const newToken = generateToken(user_id, user.email, user.role);

    res.json({
      success: true,
      data: {
        token: newToken
      }
    });

  } catch (error) {
    console.error('Erreur refresh token:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rafraîchissement du token'
    });
  } finally {
    connection.release();
  }
};

// Déconnexion
exports.logout = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Révoquer le refresh token
      await connection.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = ?',
        [refreshToken]
      );
    }

    // Mettre à jour la session
    if (req.user) {
      await connection.query(
        'UPDATE user_sessions SET logout_at = NOW() WHERE user_id = ? AND logout_at IS NULL ORDER BY login_at DESC LIMIT 1',
        [req.user.userId]
      );
    }

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('Erreur logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion'
    });
  } finally {
    connection.release();
  }
};

// Récupérer le profil utilisateur (nécessite authentification)
exports.getProfile = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const userId = req.user?.id ?? req.user?.userId;

    // Récupérer toutes les informations de l'utilisateur
    const [users] = await connection.query(
      `SELECT 
        id, email, first_name, last_name, role, 
        is_email_verified, email_verified_at,
        is_active, phone, organization, country, npi,
        created_at, updated_at, last_login_at 
       FROM users 
       WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const user = users[0];
    const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;

    // Récupérer tous les fichiers de l'utilisateur
    const [filesRows] = await connection.query(
      `SELECT 
        id, file_type, file_name, original_name, file_size,
        mime_type, is_verified, verified_at, created_at
       FROM user_files
       WHERE user_id = ?
       ORDER BY file_type, created_at DESC`,
      [userId]
    );

    // Organiser les fichiers par type
    const files = {
      profile_picture: null,
      identity_document: null,
      certificate: [],
      other: []
    };

    filesRows.forEach(file => {
      const fileUrl = file.file_name 
        ? `${apiUrl}/uploads/profiles/${file.file_name}`
        : null;
      
      const fileData = {
        id: file.id,
        fileName: file.file_name,
        originalName: file.original_name,
        fileSize: file.file_size,
        mimeType: file.mime_type,
        isVerified: Boolean(file.is_verified),
        verifiedAt: file.verified_at,
        createdAt: file.created_at,
        url: fileUrl
      };

      if (file.file_type === 'profile_picture') {
        files.profile_picture = fileData;
      } else if (file.file_type === 'identity_document') {
        files.identity_document = fileData;
      } else if (file.file_type === 'certificate') {
        files.certificate.push(fileData);
      } else {
        files.other.push(fileData);
      }
    });

    // Récupérer les statistiques selon le rôle
    let statistics = {};

    if (user.role === 'student') {
      // Statistiques étudiant
      const [enrollmentStats] = await connection.query(
        `SELECT 
          COUNT(*) as total_enrollments,
          SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed_courses,
          SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) as active_courses,
          AVG(progress_percentage) as avg_progress
         FROM enrollments
         WHERE user_id = ? AND is_active = TRUE`,
        [userId]
      );

      const [badgeStats] = await connection.query(
        `SELECT COUNT(*) as total_badges
         FROM user_badges
         WHERE user_id = ?`,
        [userId]
      );

      const [certificateStats] = await connection.query(
        `SELECT COUNT(*) as total_certificates
         FROM certificates
         WHERE user_id = ?`,
        [userId]
      );

      statistics = {
        enrollments: {
          total: Number(enrollmentStats[0]?.total_enrollments || 0),
          completed: Number(enrollmentStats[0]?.completed_courses || 0),
          active: Number(enrollmentStats[0]?.active_courses || 0),
          averageProgress: Number(enrollmentStats[0]?.avg_progress || 0)
        },
        badges: {
          total: Number(badgeStats[0]?.total_badges || 0)
        },
        certificates: {
          total: Number(certificateStats[0]?.total_certificates || 0)
        }
      };
    } else if (user.role === 'instructor') {
      // Statistiques instructeur
      const [courseStats] = await connection.query(
        `SELECT 
          COUNT(*) as total_courses,
          SUM(CASE WHEN is_published = TRUE THEN 1 ELSE 0 END) as published_courses,
          SUM(CASE WHEN is_published = FALSE THEN 1 ELSE 0 END) as draft_courses
         FROM courses
         WHERE instructor_id = ?`,
        [userId]
      );

      const [studentStats] = await connection.query(
        `SELECT COUNT(DISTINCT e.user_id) as total_students
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE c.instructor_id = ? AND e.is_active = TRUE`,
        [userId]
      );

      statistics = {
        courses: {
          total: Number(courseStats[0]?.total_courses || 0),
          published: Number(courseStats[0]?.published_courses || 0),
          drafts: Number(courseStats[0]?.draft_courses || 0)
        },
        students: {
          total: Number(studentStats[0]?.total_students || 0)
        }
      };
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name} ${user.last_name}`,
          role: user.role,
          phone: user.phone,
          organization: user.organization,
          country: user.country,
          npi: user.npi,
          isEmailVerified: Boolean(user.is_email_verified),
          emailVerifiedAt: user.email_verified_at,
          isActive: Boolean(user.is_active),
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          lastLoginAt: user.last_login_at,
          avatarUrl: files.profile_picture?.url || null
        },
        files: {
          profilePicture: files.profile_picture,
          identityDocument: files.identity_document,
          certificates: files.certificate,
          other: files.other
        },
        statistics
      }
    });

  } catch (error) {
    console.error('Erreur get profile:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
};

// Modifier le profil utilisateur
exports.updateProfile = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      organization, 
      country, 
      npi 
    } = req.body;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non authentifié'
      });
    }

    // Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur
    if (email !== undefined && email !== null && email !== '') {
      const [existingUsers] = await connection.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cette adresse email est déjà utilisée'
        });
      }
    }

    // Construire la requête de mise à jour dynamiquement
    const updates = [];
    const values = [];

    if (firstName !== undefined && firstName !== null) {
      updates.push('first_name = ?');
      values.push(firstName.trim() || null);
    }
    if (lastName !== undefined && lastName !== null) {
      updates.push('last_name = ?');
      values.push(lastName.trim() || null);
    }
    if (email !== undefined && email !== null && email !== '') {
      updates.push('email = ?');
      values.push(email.trim());
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      // Convertir chaîne vide en null, sinon trimmer
      values.push(phone && phone.trim() !== '' ? phone.trim() : null);
    }
    if (organization !== undefined) {
      updates.push('organization = ?');
      // Convertir chaîne vide en null, sinon trimmer
      values.push(organization && organization.trim() !== '' ? organization.trim() : null);
    }
    if (country !== undefined) {
      updates.push('country = ?');
      // Convertir chaîne vide en null, sinon trimmer et limiter à 3 caractères (code pays)
      const countryValue = country && country.trim() !== '' ? country.trim().substring(0, 3).toUpperCase() : null;
      values.push(countryValue);
    }
    if (npi !== undefined) {
      updates.push('npi = ?');
      // Convertir chaîne vide en null, sinon trimmer
      values.push(npi && npi.trim() !== '' ? npi.trim() : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    // Ajouter updated_at pour marquer la mise à jour
    updates.push('updated_at = NOW()');
    values.push(userId);

    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    console.log('Update profile query:', updateQuery);
    console.log('Update profile values:', values);
    
    await connection.query(updateQuery, values);

    // Récupérer l'utilisateur mis à jour pour la réponse
    const [updatedUsers] = await connection.query(
      'SELECT id, first_name, last_name, email, phone, organization, country, npi FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        user: updatedUsers[0] || null
      }
    });

  } catch (error) {
    console.error('Erreur update profile:', error);
    console.error('Stack trace:', error.stack);
    
    // Vérifier si c'est une erreur de contrainte de base de données
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Une valeur en double a été détectée. Veuillez vérifier vos données.'
      });
    }
    
    // Vérifier si c'est une erreur de validation de données
    if (error.code === 'ER_DATA_TOO_LONG') {
      return res.status(400).json({
        success: false,
        message: 'Une valeur est trop longue. Veuillez vérifier vos données.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la mise à jour du profil',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
};

// Changer le mot de passe
exports.changePassword = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Vérifier le mot de passe actuel
    const [users] = await connection.query(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    // Hacher le nouveau mot de passe
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Mettre à jour le mot de passe
    await connection.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNewPassword, userId]
    );

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur change password:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de mot de passe'
    });
  } finally {
    connection.release();
  }
};

