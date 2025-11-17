# API MdSC - Plateforme MOOC Complète

API backend complète pour la plateforme MOOC Maison de la Société Civile avec authentification, gestion des cours, progression, gamification, IA et analytics.

## 🚀 Installation

### 1. Configuration de la base de données

Créez la base de données en exécutant les scripts SQL dans l'ordre:

```bash
# 1. Schéma principal d'authentification
mysql -u root  -P 3306 < database/schema.sql

# 2. Schéma des cours et fonctionnalités MOOC
mysql -u root  -P 3306 < database/courses_schema.sql

# 3. Tables manquantes (IA, gamification, analytics)
mysql -u root -p -P 3306 < database/add_missing_tables.sql
```

Ou utilisez le script PowerShell automatisé :
```powershell
# Exécuter la migration complète
.\database\run_complete_migration.ps1
```

Ou depuis HeidiSQL/phpMyAdmin :
- Ouvrez les fichiers SQL dans l'ordre
- Exécutez-les sur votre serveur MariaDB (port 3306)

### 2. Configuration des variables d'environnement

Copiez le fichier `.env` et configurez vos paramètres :

```env
# Base de données
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=mdsc_auth

# JWT Secrets (CHANGEZ CES VALEURS EN PRODUCTION !)
JWT_SECRET=mdsc_secret_key_2024_super_secure_change_in_production
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=mdsc_refresh_secret_key_2024_super_secure_change_in_production
JWT_REFRESH_EXPIRE=30d

# Email (Gmail exemple)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=datainnovation12@gmail.com
EMAIL_PASSWORD=fkhcewbxenfmixhx
FRONTEND_URL=http://localhost:3000

# Google OAuth (optionnel)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# OpenAI (pour les fonctionnalités IA)
OPENAI_API_KEY=your_openai_api_key_here
# Serveur
PORT=5000
NODE_ENV=development
```

#### Configuration Gmail pour les emails :

1. Activez la validation en 2 étapes sur votre compte Gmail
2. Générez un "Mot de passe d'application" :
   - https://myaccount.google.com/apppasswords
   - Sélectionnez "Autre" et nommez-le "MdSC Auth"
   - Utilisez ce mot de passe dans `EMAIL_PASSWORD`

### 3. Démarrer le serveur

```bash
# Installation des dépendances
npm install

# Mode développement (avec hot reload)
npm run dev

# Mode production
npm start
```

Le serveur démarre sur `http://localhost:5000`

## 🎯 Fonctionnalités

### ✅ Implémentées
- **Authentification complète** : Inscription, connexion, vérification email, réinitialisation mot de passe
- **Gestion des cours** : CRUD complet, catégories, leçons, progression
- **Système d'inscription** : Inscription aux cours, suivi de progression
- **Quiz et évaluations** : Création, tentatives, résultats
- **Certificats** : Génération PDF automatique
- **Email** : Vérification, notifications, templates HTML
- **Routes de progression** : Suivi des leçons complétées

### 🚧 En développement
- **IA/ChatIA** : Conversations avec GPT-4o Mini, résumés automatiques
- **Gamification** : Badges, points, niveaux, leaderboard
- **Analytics avancés** : Tableaux de bord, métriques, monitoring

## 📡 Endpoints API

### 🔐 Authentification

#### Inscription
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123",
  "firstName": "Jean",
  "lastName": "Dupont"
}
```

#### Vérification d'email
```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "uuid-token-from-email"
}
```

#### Renvoyer l'email de vérification
```http
POST /api/auth/resend-verification
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Connexion
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123"
}
```

Réponse :
```json
{
  "success": true,
  "message": "Connexion réussie",
  "data": {
   "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "Jean",
    "lastName": "Dupont",
    "role": "student"
   },
   "token": "jwt-token",
   "refreshToken": "refresh-token"
  }
}
```

#### Mot de passe oublié
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Réinitialisation du mot de passe
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "uuid-token-from-email",
  "newPassword": "NewPassword123"
}
```

#### Rafraîchir le token
```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "refresh-token"
}
```

#### Déconnexion
```http
POST /api/auth/logout
Content-Type: application/json

{
  "refreshToken": "refresh-token"
}
```

### 📚 Gestion des Cours

#### Récupérer tous les cours
```http
GET /api/courses?page=1&limit=10&category=1&difficulty=beginner&search=leadership
Authorization: Bearer jwt-token
```

#### Récupérer un cours par ID
```http
GET /api/courses/:id
Authorization: Bearer jwt-token
```

#### Récupérer mes cours
```http
GET /api/courses/my
Authorization: Bearer jwt-token
```

#### Récupérer les leçons d'un cours
```http
GET /api/courses/:courseId/lessons
Authorization: Bearer jwt-token
```

#### Récupérer la progression d'un cours
```http
GET /api/courses/:courseId/progress
Authorization: Bearer jwt-token
```

#### Marquer une leçon comme complétée
```http
PUT /api/courses/:courseId/lessons/:lessonId/complete
Authorization: Bearer jwt-token
```

#### Créer un cours (instructeur)
```http
POST /api/courses
Authorization: Bearer jwt-token
Content-Type: application/json

{
  "title": "Introduction au Leadership",
  "description": "Apprenez les bases du leadership moderne",
  "category_id": 1,
  "difficulty": "beginner",
  "language": "fr",
  "price": 0
}
```

### 🎓 Inscription aux Cours

#### S'inscrire à un cours
```http
POST /api/enrollments
Authorization: Bearer jwt-token
Content-Type: application/json

{
  "course_id": 1
}
```

#### Récupérer mes inscriptions
```http
GET /api/enrollments/my-courses
Authorization: Bearer jwt-token
```

### 🧠 IA et ChatIA

#### Démarrer une conversation IA
```http
POST /api/ai/conversations
Authorization: Bearer jwt-token
Content-Type: application/json

{
  "title": "Aide avec mon cours",
  "context": "course_help"
}
```

#### Envoyer un message à l'IA
```http
POST /api/ai/conversations/:id/messages
Authorization: Bearer jwt-token
Content-Type: application/json

{
  "message": "Explique-moi le concept de leadership"
}
```

### 🏆 Gamification

#### Récupérer mes badges
```http
GET /api/gamification/badges
Authorization: Bearer jwt-token
```

#### Récupérer mes points
```http
GET /api/gamification/points
Authorization: Bearer jwt-token
```

#### Récupérer le leaderboard
```http
GET /api/gamification/leaderboard
Authorization: Bearer jwt-token
```

### 📊 Analytics

#### Tableau de bord étudiant
```http
GET /api/analytics/student-dashboard
Authorization: Bearer jwt-token
```

#### Tableau de bord instructeur
```http
GET /api/analytics/instructor-dashboard
Authorization: Bearer jwt-token
```

### Endpoints protégés (nécessitent authentification)

#### Récupérer le profil
```http
GET /api/auth/profile
Authorization: Bearer jwt-token
```

## 🔐 Sécurité

### Mot de passe requis
- Minimum 8 caractères
- Au moins une majuscule
- Au moins une minuscule
- Au moins un chiffre

### Tokens
- **JWT Access Token** : Expire après 7 jours
- **Refresh Token** : Expire après 30 jours
- **Email Verification Token** : Expire après 24 heures
- **Password Reset Token** : Expire après 1 heure

## 🗄️ Structure de la base de données

### Tables d'authentification
- **users** : Informations des utilisateurs
- **email_verification_tokens** : Tokens de vérification d'email
- **password_reset_tokens** : Tokens de réinitialisation de mot de passe
- **refresh_tokens** : Tokens de rafraîchissement JWT
- **user_sessions** : Sessions utilisateur (audit)

### Tables des cours
- **categories** : Catégories de cours
- **courses** : Cours et formations
- **lessons** : Leçons des cours
- **enrollments** : Inscriptions aux cours
- **course_progress** : Progression des cours
- **lesson_progress** : Progression des leçons

### Tables d'évaluation
- **quizzes** : Quiz et évaluations
- **questions** : Questions des quiz
- **answers** : Réponses possibles
- **quiz_attempts** : Tentatives de quiz
- **quiz_attempt_answers** : Réponses données
- **certificates** : Certificats générés

### Tables IA et Gamification
- **ai_conversations** : Conversations avec l'IA
- **ai_messages** : Messages de conversation
- **user_badges** : Badges des utilisateurs
- **user_points** : Points des utilisateurs
- **point_transactions** : Historique des points

### Tables Analytics
- **user_activity_logs** : Logs d'activité
- **course_analytics** : Analytics des cours
- **system_metrics** : Métriques système

### Tables de contenu
- **assignments** : Devoirs et travaux
- **assignment_submissions** : Soumissions de devoirs
- **forum_categories** : Catégories de forum
- **forum_topics** : Sujets de forum
- **forum_posts** : Messages de forum
- **events** : Événements et webinaires
- **event_attendees** : Participants aux événements
- **notifications** : Notifications utilisateur

## 📧 Templates d'emails

Les emails sont envoyés avec des templates HTML personnalisés aux couleurs MdSC :
- Email de vérification avec bouton CTA
- Email de réinitialisation de mot de passe

## 🧪 Test de l'API

### Scripts de migration

```powershell
# Migration complète (recommandé)
.\database\run_complete_migration.ps1

# Migration propre (alternative)
.\database\run_migration_clean.ps1

# Migration XAMPP spécifique
.\database\run_migration_xampp.ps1
```

### Tests avec cURL

```bash
# Inscription
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123","firstName":"Test","lastName":"User","phone":"123456789","organization":"Test Org","country":"FR","role":"student"}'

# Connexion
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123"}'

# Récupérer mes cours (avec token)
curl -X GET http://localhost:5000/api/courses/my \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Tests avec PowerShell

```powershell
# Inscription
$response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/register" -Method POST -ContentType "application/json" -Body '{"email":"test@example.com","password":"Password123","firstName":"Test","lastName":"User"}'

# Connexion
$response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"test@example.com","password":"Password123"}'
$token = ($response.Content | ConvertFrom-Json).data.token

# Récupérer mes cours
$response = Invoke-WebRequest -Uri "http://localhost:5000/api/courses/my" -Method GET -Headers @{"Authorization"="Bearer $token"}
```

### Avec Postman / Insomnia

Importez la collection d'endpoints ci-dessus.

## 🛠️ Maintenance

### Nettoyage des tokens expirés

Exécutez périodiquement (via cron ou tâche planifiée) :

```sql
DELETE FROM email_verification_tokens WHERE expires_at < NOW();
DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL;
DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at IS NOT NULL;
```

## 🏗️ Architecture

### Technologies utilisées
- **Backend** : Node.js + Express.js
- **Base de données** : MySQL/MariaDB
- **Authentification** : JWT + bcrypt
- **Email** : Nodemailer + Gmail SMTP
- **IA** : OpenAI GPT-4o Mini
- **PDF** : PDFKit pour les certificats
- **Validation** : express-validator
- **OAuth** : Passport.js (Google)

### Structure du projet
```
mdsc_auth_api/
├── src/
│   ├── config/          # Configuration DB et Passport
│   ├── controllers/     # Logique métier
│   ├── middleware/      # Auth et validation
│   ├── routes/         # Routes API
│   ├── services/       # Services (email, etc.)
│   └── server.js       # Point d'entrée
├── database/           # Scripts SQL et migration
├── uploads/            # Fichiers uploadés
└── package.json       # Dépendances
```

## 📝 Notes importantes

1. **En production** :
  - Changez tous les secrets JWT
  - Utilisez HTTPS
  - Configurez un vrai serveur SMTP
  - Activez les logs appropriés
  - Configurez un reverse proxy (nginx)
  - Utilisez un service de base de données géré

2. **Performance** :
  - Les connexions à la base de données utilisent un pool
  - Les mots de passe sont hashés avec bcrypt (12 rounds)
  - Cache Redis recommandé pour les sessions

3. **Email** :
  - En développement, vous pouvez utiliser Mailtrap, MailHog ou Gmail
  - En production, utilisez un service SMTP professionnel (SendGrid, Mailgun, SES)

4. **Sécurité** :
  - Rate limiting recommandé
  - CORS configuré pour le frontend
  - Validation stricte des entrées
  - Logs de sécurité

## 🐛 Dépannage

### La base de données ne se connecte pas
- Vérifiez que MariaDB est démarré sur le port 3306
- Vérifiez les credentials dans `.env`
- Testez la connexion manuellement : `mysql -u root -p -P 3306`

### Les emails ne sont pas envoyés
- Vérifiez la configuration EMAIL_* dans `.env`
- Pour Gmail, assurez-vous d'utiliser un mot de passe d'application
- Consultez les logs du serveur pour voir les erreurs
- Vérifiez que `EMAIL_USER` et `EMAIL_PASSWORD` sont définis

### Le token JWT est invalide
- Vérifiez que JWT_SECRET est défini
- Assurez-vous que le token n'a pas expiré
- Vérifiez le format du header Authorization: `Bearer <token>`

### Erreurs de migration
- Utilisez le script PowerShell approprié selon votre environnement
- Vérifiez que la base de données `mdsc_auth` existe
- Exécutez les scripts SQL dans l'ordre : schema.sql → courses_schema.sql → add_missing_tables.sql

### Erreurs de routes
- Vérifiez que toutes les fonctions sont exportées dans les contrôleurs
- Assurez-vous que les routes sont correctement montées dans server.js
- Vérifiez les logs du serveur pour les erreurs de syntaxe

## 📞 Support

Pour toute question, contactez l'équipe de développement MdSC.

