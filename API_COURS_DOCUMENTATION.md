# 📚 Documentation API Cours MdSC

## 🚀 Vue d'ensemble

L'API MdSC a été étendue avec un système complet de gestion des cours, incluant :
- **Cours et leçons** avec progression
- **Inscriptions** et suivi
- **Quiz interactifs** avec scoring
- **Certificats PDF** automatiques
- **Système d'avis** et favoris

## 📡 Endpoints Principaux

### 🎓 Cours

#### Récupérer tous les cours
```http
GET /api/courses
```

**Paramètres de requête :**
- `page` (int) : Numéro de page (défaut: 1)
- `limit` (int) : Nombre d'éléments par page (défaut: 10)
- `category` (int) : ID de la catégorie
- `difficulty` (string) : beginner, intermediate, advanced
- `language` (string) : Code langue (défaut: fr)
- `search` (string) : Terme de recherche
- `sort` (string) : Champ de tri (défaut: created_at)
- `order` (string) : ASC ou DESC (défaut: DESC)

**Réponse :**
```json
{
  "success": true,
  "data": {
    "courses": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

#### Récupérer un cours par ID
```http
GET /api/courses/:id
```

#### Créer un cours (Instructeur/Admin)
```http
POST /api/courses
Authorization: Bearer <token>
```

**Body :**
```json
{
  "title": "Titre du cours",
  "description": "Description complète",
  "short_description": "Description courte",
  "category_id": 1,
  "thumbnail_url": "https://...",
  "video_url": "https://...",
  "duration_minutes": 120,
  "difficulty": "beginner",
  "language": "fr",
  "price": 0,
  "currency": "XOF",
  "max_students": 50,
  "enrollment_deadline": "2024-12-31T23:59:59Z",
  "course_start_date": "2024-01-01T00:00:00Z",
  "course_end_date": "2024-12-31T23:59:59Z"
}
```

### 📖 Leçons

#### Ajouter une leçon
```http
POST /api/courses/:courseId/lessons
Authorization: Bearer <token>
```

**Body :**
```json
{
  "title": "Titre de la leçon",
  "description": "Description de la leçon",
  "content": "Contenu détaillé",
  "video_url": "https://...",
  "duration_minutes": 30
}
```

### 🎓 Inscriptions

#### S'inscrire à un cours
```http
POST /api/enrollments
Authorization: Bearer <token>
```

**Body :**
```json
{
  "courseId": 1
}
```

#### Récupérer mes cours
```http
GET /api/enrollments/my-courses
Authorization: Bearer <token>
```

**Paramètres :**
- `status` (string) : all, active, completed

#### Récupérer la progression d'un cours
```http
GET /api/enrollments/:courseId/progress
Authorization: Bearer <token>
```

#### Mettre à jour la progression d'une leçon
```http
PUT /api/enrollments/:courseId/lesson/:lessonId/progress
Authorization: Bearer <token>
```

**Body :**
```json
{
  "is_completed": true,
  "time_spent_minutes": 25,
  "last_position_seconds": 1200
}
```

### 🧠 Quiz

#### Récupérer les quiz d'un cours
```http
GET /api/courses/:courseId/quizzes
Authorization: Bearer <token>
```

#### Récupérer un quiz avec ses questions
```http
GET /api/quizzes/:quizId
Authorization: Bearer <token>
```

#### Commencer une tentative de quiz
```http
POST /api/quizzes/:quizId/attempt
Authorization: Bearer <token>
```

#### Soumettre une tentative de quiz
```http
PUT /api/quizzes/attempts/:attemptId
Authorization: Bearer <token>
```

**Body :**
```json
{
  "answers": [
    {
      "question_id": 1,
      "answer_id": 3
    },
    {
      "question_id": 2,
      "answer_text": "Ma réponse texte"
    }
  ]
}
```

### 🏆 Certificats

#### Récupérer mes certificats
```http
GET /api/certificates/my-certificates
Authorization: Bearer <token>
```

#### Télécharger un certificat PDF
```http
GET /api/certificates/:certificateId/download
Authorization: Bearer <token>
```

### ⭐ Favoris et Avis

#### Ajouter aux favoris
```http
POST /api/courses/:courseId/favorite
Authorization: Bearer <token>
```

#### Ajouter un avis
```http
POST /api/courses/:courseId/review
Authorization: Bearer <token>
```

**Body :**
```json
{
  "rating": 5,
  "comment": "Excellent cours !"
}
```

## 🗄️ Structure de la Base de Données

### Tables Principales

1. **categories** - Catégories de cours
2. **courses** - Cours
3. **lessons** - Leçons des cours
4. **enrollments** - Inscriptions aux cours
5. **lesson_progress** - Progression des leçons
6. **quizzes** - Quiz
7. **quiz_questions** - Questions de quiz
8. **quiz_answers** - Réponses aux questions
9. **quiz_attempts** - Tentatives de quiz
10. **user_quiz_answers** - Réponses des utilisateurs
11. **certificates** - Certificats
12. **course_favorites** - Cours favoris
13. **course_reviews** - Avis sur les cours

### Relations Clés

- `courses.instructor_id` → `users.id`
- `courses.category_id` → `categories.id`
- `lessons.course_id` → `courses.id`
- `enrollments.user_id` → `users.id`
- `enrollments.course_id` → `courses.id`
- `lesson_progress.user_id` → `users.id`
- `lesson_progress.lesson_id` → `lessons.id`
- `quiz_questions.quiz_id` → `quizzes.id`
- `quiz_answers.question_id` → `quiz_questions.id`
- `certificates.user_id` → `users.id`
- `certificates.course_id` → `courses.id`

## 🔧 Installation et Configuration

### 1. Exécuter la migration de base de données

```powershell
# Windows PowerShell
cd database
.\run_courses_migration.ps1
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Démarrer le serveur

```bash
# Mode développement
npm run dev

# Mode production
npm start
```

### 4. Tester l'API

```bash
node test-courses-api.js
```

## 🎯 Fonctionnalités Avancées

### Progression Automatique

La progression des cours est calculée automatiquement :
- **Trigger SQL** met à jour `enrollments.progress_percentage`
- **Completion automatique** quand toutes les leçons sont terminées
- **Génération de certificats** automatique à 100%

### Système de Quiz

- **Questions multiples** : Choix unique ou multiple
- **Questions texte** : Réponses libres
- **Limite de temps** : Contrôle automatique
- **Tentatives limitées** : Nombre max configurable
- **Scoring intelligent** : Points par question

### Certificats PDF

- **Génération automatique** à la completion
- **Design MdSC** avec couleurs officielles
- **Numérotation unique** : MDSC-{timestamp}-{random}
- **Téléchargement sécurisé** avec authentification

## 🚀 Prochaines Étapes

1. **Intégration Frontend** : Connecter avec votre frontend React/Vue
2. **Tests Complets** : Suite de tests automatisés
3. **Déploiement** : Configuration production
4. **Monitoring** : Logs et métriques

## 📞 Support

Pour toute question sur l'API étendue, contactez l'équipe de développement MdSC.

---

**🎉 Félicitations ! Votre API MdSC est maintenant complète avec un système de cours professionnel !**
