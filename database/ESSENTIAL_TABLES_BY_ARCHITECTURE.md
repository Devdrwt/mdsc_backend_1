# 📚 Tables Essentielles selon l'Architecture de Gestion des Cours

## 🎯 Architecture Principale : Gestion des Cours MdSC

Selon l'architecture implémentée, voici les tables **ESSENTIELLES** à conserver :

---

## ✅ Tables CORE (Nécessaires - 21 tables)

### 1. Authentification (4 tables)
- ✅ **`users`** - Utilisateurs du système
- ✅ **`email_verification_tokens`** - Vérification email
- ✅ **`password_reset_tokens`** - Réinitialisation mot de passe
- ✅ **`refresh_tokens`** - Tokens JWT

### 2. Cours & Structure (7 tables)
- ✅ **`courses`** - Cours (avec slug, prerequisite_course_id)
- ✅ **`categories`** - Catégories de cours
- ✅ **`modules`** - Modules de cours (nouvelle table)
- ✅ **`lessons`** - Leçons (avec module_id, content_type, media_file_id)
- ✅ **`enrollments`** - Inscriptions (avec status: enrolled, in_progress, completed, certified)
- ✅ **`progress`** - Progression (remplace lesson_progress)
- ✅ **`course_reviews`** - Avis sur les cours
- ✅ **`course_favorites`** - Favoris

### 3. Quiz & Évaluations (5 tables)
- ✅ **`quizzes`** - Quiz (avec is_final)
- ✅ **`quiz_questions`** - Questions (avec options JSON, correct_answer)
- ✅ **`quiz_answers`** - Réponses possibles
- ✅ **`quiz_attempts`** - Tentatives (avec answers JSON)
- ✅ **`user_quiz_answers`** - Réponses données par utilisateur

### 4. Médias (1 table)
- ✅ **`media_files`** - Fichiers uploadés (vidéos, documents, audio, etc.)

### 5. Badges & Gamification (2 tables)
- ✅ **`badges`** - Badges disponibles (criteria JSON)
- ✅ **`user_badges`** - Badges obtenus par utilisateurs

### 6. Certificats (1 table)
- ✅ **`certificates`** - Certificats (avec certificate_code, qr_code_url)

### 7. Session (1 table optionnelle)
- ⚠️ **`user_sessions`** - Sessions utilisateur (pour audit/logs)

---

## ⚠️ Tables OPTIONNELLES (Selon fonctionnalités activées)

### Fonctionnalités Professionnelles (Si activées)
- ⚠️ **`domains`** - Domaines professionnels
- ⚠️ **`sequences`** - Séquences de contenu
- ⚠️ **`contents`** - Contenus de séquences
- ⚠️ **`mini_controls`** - Mini contrôles
- ⚠️ **`mini_control_results`** - Résultats mini contrôles
- ⚠️ **`sequence_progress`** - Progression séquences

### Fonctionnalités Modules Spéciaux (Si activées)
- ⚠️ **`module_enrollments`** - Inscriptions aux modules
- ⚠️ **`module_evaluations`** - Évaluations modules
- ⚠️ **`module_evaluation_results`** - Résultats évaluations modules

### Fonctionnalités Évaluations Avancées (Si activées)
- ⚠️ **`evaluations`** - Évaluations avancées
- ⚠️ **`user_evaluations`** - Évaluations utilisateurs
- ⚠️ **`assignments`** - Devoirs
- ⚠️ **`assignment_submissions`** - Soumissions devoirs

### Fonctionnalités Communications (Si activées)
- ⚠️ **`messages`** - Messages entre utilisateurs
- ⚠️ **`notifications`** - Notifications

### Fonctionnalités IA (Si activées)
- ⚠️ **`ai_conversations`** - Conversations IA
- ⚠️ **`ai_messages`** - Messages IA

### Fonctionnalités Analytics (Si activées)
- ⚠️ **`user_points`** - Points utilisateurs
- ⚠️ **`point_transactions`** - Historique points
- ⚠️ **`user_activity_logs`** - Logs d'activité
- ⚠️ **`course_analytics`** - Analytics cours
- ⚠️ **`system_metrics`** - Métriques système

### Fichiers Utilisateurs (Si activée)
- ⚠️ **`user_files`** - Fichiers uploadés par utilisateurs

---

## 🗑️ Tables À SUPPRIMER (Non utilisées dans l'architecture principale)

### Déjà supprimées ✅
- ~~`lesson_progress`~~ → Remplacée par `progress`
- ~~`forum_categories`~~ → Forum non implémenté
- ~~`forum_posts`~~ → Forum non implémenté
- ~~`forum_topics`~~ → Forum non implémenté
- ~~`events`~~ → Événements non implémentés
- ~~`event_attendees`~~ → Événements non implémentés

---

## 📊 Résumé par Scénario

### Scénario 1 : Architecture MINIMUM (Gestion Cours Pure)
**21 tables essentielles** :
1. users
2. email_verification_tokens
3. password_reset_tokens
4. refresh_tokens
5. courses
6. categories
7. modules
8. lessons
9. enrollments
10. progress
11. quizzes
12. quiz_questions
13. quiz_answers
14. quiz_attempts
15. user_quiz_answers
16. media_files
17. badges
18. user_badges
19. certificates
20. course_reviews
21. course_favorites

### Scénario 2 : Architecture COMPLÈTE (Toutes fonctionnalités)
**Toutes les 45 tables** (toutes les optionnelles incluses)

### Scénario 3 : Architecture RECOMMANDÉE (Gestion Cours + Fonctionnalités Utiles)
**30-35 tables** :
- 21 tables essentielles
- + user_sessions (audit)
- + user_files (si gestion fichiers utilisateurs)
- + messages (si messagerie)
- + notifications (si notifications)
- + user_points, point_transactions (si gamification avancée)

---

## 🎯 Recommandation

Pour suivre **l'architecture de gestion des cours** uniquement :

**CONSERVER les 21 tables CORE + user_sessions = 22 tables**

**POURRAIT SUPPRIMER** (si ces fonctionnalités ne sont pas utilisées) :
- Tables professionnelles (domains, sequences, contents, etc.)
- Tables évaluations avancées (si seulement quizzes utilisés)
- Tables IA (si IA non activée)
- Tables analytics avancées (si analytics basiques suffisantes)

---

## ✅ Liste Finale Recommandée (Architecture Cours Pure)

```sql
-- Tables essentielles pour l'architecture de gestion des cours

-- Authentification (4)
users
email_verification_tokens
password_reset_tokens
refresh_tokens

-- Cours (8)
courses
categories
modules
lessons
enrollments
progress
course_reviews
course_favorites

-- Quiz (5)
quizzes
quiz_questions
quiz_answers
quiz_attempts
user_quiz_answers

-- Médias (1)
media_files

-- Badges (2)
badges
user_badges

-- Certificats (1)
certificates

-- Audit (1)
user_sessions

TOTAL: 22 tables essentielles
```

---

## 📝 Script de Vérification

Pour vérifier quelles tables sont réellement utilisées dans votre code :

```sql
-- Voir quelles tables ont des données
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size_MB'
FROM 
    information_schema.TABLES 
WHERE 
    TABLE_SCHEMA = 'mdsc_auth'
    AND TABLE_ROWS > 0
ORDER BY 
    TABLE_ROWS DESC;
```

---

**Conclusion** : Pour une architecture de gestion des cours pure, **22 tables** suffisent. Les autres peuvent être supprimées si les fonctionnalités correspondantes ne sont pas utilisées.

