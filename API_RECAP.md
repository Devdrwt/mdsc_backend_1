# 📡 Récapitulatif des APIs - Plateforme MdSC

## 🎯 Vue d'ensemble

La plateforme MdSC propose une API REST complète avec **9 modules principaux** et **50+ endpoints** pour gérer une plateforme MOOC moderne.

---

## 🔐 **1. AUTHENTIFICATION** (`/api/auth`)

### **Endpoints publics**
| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `POST` | `/register` | Inscription utilisateur | ✅ |
| `POST` | `/login` | Connexion | ✅ |
| `POST` | `/verify-email` | Vérification email | ✅ |
| `POST` | `/resend-verification` | Renvoyer email de vérification | ✅ |
| `POST` | `/forgot-password` | Mot de passe oublié | ✅ |
| `POST` | `/reset-password` | Réinitialisation mot de passe | ✅ |
| `POST` | `/refresh-token` | Rafraîchir le token JWT | ✅ |
| `POST` | `/logout` | Déconnexion | ✅ |

### **Endpoints protégés**
| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/profile` | Récupérer le profil utilisateur | ✅ |
| `PUT` | `/profile` | Mettre à jour le profil | ✅ |
| `POST` | `/change-password` | Changer le mot de passe | ✅ |

### **OAuth Google**
| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/google` | Connexion Google | ✅ |
| `GET` | `/google/callback` | Callback Google | ✅ |

---

## 📚 **2. GESTION DES COURS** (`/api/courses`)

### **Endpoints publics**
| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/` | Liste tous les cours (pagination) | ✅ |
| `GET` | `/:id` | Détails d'un cours | ✅ |
| `GET` | `/category/:categoryId` | Cours par catégorie | ✅ |
| `GET` | `/search` | Recherche de cours | ✅ |
| `GET` | `/featured` | Cours mis en avant | ✅ |

### **Endpoints protégés (étudiants)**
| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/my` | Mes cours inscrits | ✅ |
| `GET` | `/:courseId/lessons` | Leçons d'un cours | ✅ |
| `GET` | `/:courseId/progress` | Progression d'un cours | ✅ |
| `PUT` | `/:courseId/lessons/:lessonId/complete` | Marquer leçon complétée | ✅ |

### **Endpoints protégés (instructeurs/admins)**
| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `POST` | `/` | Créer un cours | ✅ |
| `PUT` | `/:id` | Modifier un cours | ✅ |
| `DELETE` | `/:id` | Supprimer un cours | ✅ |
| `POST` | `/:id/lessons` | Ajouter une leçon | ✅ |
| `PUT` | `/:courseId/lessons/:lessonId` | Modifier une leçon | ✅ |
| `DELETE` | `/:courseId/lessons/:lessonId` | Supprimer une leçon | ✅ |

---

## 🎓 **3. INSCRIPTIONS** (`/api/enrollments`)

| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `POST` | `/` | S'inscrire à un cours | ✅ |
| `GET` | `/my-courses` | Mes cours inscrits | ✅ |
| `GET` | `/:enrollmentId` | Détails d'une inscription | ✅ |
| `DELETE` | `/:enrollmentId` | Se désinscrire d'un cours | ✅ |

---

## 🧠 **4. QUIZ ET ÉVALUATIONS** (`/api/quizzes`)

| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/` | Liste des quiz | ✅ |
| `GET` | `/:id` | Détails d'un quiz | ✅ |
| `POST` | `/` | Créer un quiz (instructeur) | ✅ |
| `PUT` | `/:id` | Modifier un quiz | ✅ |
| `DELETE` | `/:id` | Supprimer un quiz | ✅ |
| `POST` | `/:id/attempt` | Tenter un quiz | ✅ |
| `GET` | `/:id/attempts` | Mes tentatives de quiz | ✅ |
| `GET` | `/:id/attempts/:attemptId` | Détails d'une tentative | ✅ |

---

## 🏆 **5. CERTIFICATS** (`/api/certificates`)

| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/my` | Mes certificats | ✅ |
| `GET` | `/:id` | Télécharger un certificat | ✅ |
| `POST` | `/generate/:courseId` | Générer un certificat | ✅ |

---

## 🏷️ **6. CATÉGORIES** (`/api/categories`)

| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/` | Liste des catégories | ✅ |
| `GET` | `/:id` | Détails d'une catégorie | ✅ |
| `POST` | `/` | Créer une catégorie (admin) | ✅ |
| `PUT` | `/:id` | Modifier une catégorie | ✅ |
| `DELETE` | `/:id` | Supprimer une catégorie | ✅ |

---

## 🤖 **7. IA ET CHATIA** (`/api/ai`)

| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `POST` | `/conversations` | Démarrer une conversation IA | ✅ |
| `GET` | `/conversations` | Mes conversations IA | ✅ |
| `GET` | `/conversations/:id` | Détails d'une conversation | ✅ |
| `POST` | `/conversations/:id/messages` | Envoyer un message à l'IA | ✅ |
| `GET` | `/conversations/:id/messages` | Historique des messages | ✅ |
| `POST` | `/summarize` | Générer un résumé automatique | ✅ |
| `POST` | `/recommendations` | Recommandations personnalisées | ✅ |

---

## 🎮 **8. GAMIFICATION** (`/api/gamification`)

| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/badges` | Mes badges | ✅ |
| `GET` | `/badges/:id` | Détails d'un badge | ✅ |
| `GET` | `/points` | Mes points | ✅ |
| `GET` | `/leaderboard` | Classement global | ✅ |
| `GET` | `/achievements` | Mes réalisations | ✅ |
| `POST` | `/badges/:id/claim` | Réclamer un badge | ✅ |

---

## 📊 **9. ANALYTICS** (`/api/analytics`)

### **Tableaux de bord**
| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/student-dashboard` | Dashboard étudiant | ✅ |
| `GET` | `/instructor-dashboard` | Dashboard instructeur | ✅ |
| `GET` | `/admin-dashboard` | Dashboard administrateur | ✅ |

### **Métriques**
| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/course-stats/:courseId` | Statistiques d'un cours | ✅ |
| `GET` | `/user-activity` | Activité utilisateur | ✅ |
| `GET` | `/system-metrics` | Métriques système | ✅ |
| `GET` | `/completion-rates` | Taux de complétion | ✅ |

---

## 🔧 **ENDPOINTS UTILITAIRES**

### **Santé du système**
| Méthode | Endpoint | Description | Status |
|--------|----------|-------------|---------|
| `GET` | `/health` | Vérification de l'API | ✅ |

---

## 📋 **RÉSUMÉ STATISTIQUES**

### **📊 Répartition par module :**
- **Authentification** : 8 endpoints publics + 3 protégés + 2 OAuth = **13 endpoints**
- **Cours** : 5 publics + 4 étudiants + 6 instructeurs = **15 endpoints**
- **Inscriptions** : **4 endpoints**
- **Quiz** : **8 endpoints**
- **Certificats** : **3 endpoints**
- **Catégories** : **5 endpoints**
- **IA** : **7 endpoints**
- **Gamification** : **6 endpoints**
- **Analytics** : **7 endpoints**
- **Utilitaires** : **1 endpoint**

### **🎯 Total : 69 endpoints**

### **🔐 Authentification requise :**
- **Endpoints publics** : 18 (authentification, cours publics, santé)
- **Endpoints protégés** : 51 (toutes les autres fonctionnalités)

### **👥 Rôles supportés :**
- **Étudiant** : Accès lecture + inscription aux cours
- **Instructeur** : Création/modification de cours + analytics
- **Administrateur** : Accès complet + gestion système

---

## 🚀 **STATUT D'IMPLÉMENTATION**

### ✅ **Complètement implémenté (100%)**
- Authentification (JWT + OAuth Google)
- Gestion des cours (CRUD complet)
- Système d'inscription
- Quiz et évaluations
- Certificats PDF
- Catégories
- Routes de progression

### 🚧 **En développement (80%)**
- IA/ChatIA (GPT-4o Mini)
- Gamification (badges, points, leaderboard)
- Analytics avancés

### 📈 **Fonctionnalités avancées**
- **Email** : Templates HTML personnalisés
- **PDF** : Génération automatique de certificats
- **IA** : Conversations contextuelles
- **Gamification** : Système de récompenses
- **Analytics** : Tableaux de bord temps réel

---

## 🔗 **URLs de base**

- **API Backend** : `http://localhost:5000`
- **Frontend** : `http://localhost:3000`
- **Base de données** : `localhost:3306` (MariaDB)

---

*Dernière mise à jour : Octobre 2024*
