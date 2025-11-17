# 📅 Architecture de Synchronisation : Suivi de Cours ↔ Calendrier

## 🎯 Objectif

Synchroniser automatiquement le suivi de progression des étudiants avec leur calendrier pour :
- **Planifier automatiquement** les sessions d'apprentissage
- **Créer des rappels** pour les deadlines et quiz
- **Suggérer un planning** basé sur la progression
- **Visualiser** l'avancement dans le calendrier

---

## 🏗️ Architecture Proposée

### 1. **Modèle de Données**

#### Table : `course_schedule_items` (Nouvelle)
```sql
CREATE TABLE course_schedule_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  course_id INT NOT NULL,
  lesson_id INT NULL,
  quiz_id INT NULL,
  item_type ENUM('lesson', 'quiz', 'deadline', 'reminder', 'milestone') NOT NULL,
  scheduled_date DATETIME NOT NULL,
  estimated_duration_minutes INT DEFAULT 30,
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  status ENUM('pending', 'in_progress', 'completed', 'skipped', 'overdue') DEFAULT 'pending',
  auto_generated BOOLEAN DEFAULT TRUE,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE SET NULL,
  INDEX idx_enrollment (enrollment_id),
  INDEX idx_scheduled_date (scheduled_date),
  INDEX idx_status (status),
  INDEX idx_item_type (item_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Table : `events` (Extension)
Ajouter des champs pour lier les événements au suivi :
- `schedule_item_id` INT NULL (référence vers `course_schedule_items`)
- `auto_sync` BOOLEAN DEFAULT FALSE (indique si l'événement est synchronisé automatiquement)

---

## 🔄 Flux de Synchronisation

### **Phase 1 : Génération Automatique du Planning**

#### 1.1 Lors de l'inscription à un cours
```javascript
// Dans enrollmentController.js - enrollInCourse()
async function generateInitialSchedule(enrollmentId, courseId, userId) {
  // 1. Récupérer la structure du cours (modules, leçons, quiz)
  // 2. Calculer un planning optimal basé sur :
  //    - Durée estimée du cours
  //    - Nombre de leçons
  //    - Prérequis (cours séquentiels)
  //    - Préférences de l'étudiant (student_preferences)
  
  // 3. Créer des course_schedule_items pour chaque leçon/quiz
  // 4. Générer des événements calendrier correspondants
}
```

#### 1.2 Algorithme de Planification
```javascript
function calculateOptimalSchedule(course, userPreferences) {
  const schedule = [];
  const startDate = new Date();
  const preferredStudyDays = userPreferences?.learning?.study_days || [1,2,3,4,5]; // Lun-Ven
  const preferredStudyTime = userPreferences?.learning?.preferred_time || '09:00';
  const dailyStudyMinutes = userPreferences?.learning?.daily_study_minutes || 60;
  
  // Distribuer les leçons sur les jours préférés
  // Respecter les prérequis et l'ordre séquentiel
  // Créer des milestones (fin de module, quiz, etc.)
  
  return schedule;
}
```

### **Phase 2 : Synchronisation Bidirectionnelle**

#### 2.1 Progression → Calendrier
```javascript
// Quand une leçon est complétée
async function syncProgressToCalendar(lessonId, enrollmentId, completedAt) {
  // 1. Mettre à jour le course_schedule_item correspondant
  // 2. Marquer l'événement calendrier comme complété
  // 3. Ajuster le planning des prochaines leçons si nécessaire
  // 4. Créer un événement de milestone si un module est terminé
}
```

#### 2.2 Calendrier → Progression
```javascript
// Quand un événement est modifié dans le calendrier
async function syncCalendarToProgress(eventId, newDate) {
  // 1. Mettre à jour le course_schedule_item
  // 2. Recalculer les dates suivantes si nécessaire
  // 3. Envoyer une notification si la date est reportée
}
```

---

## 📋 Fonctionnalités Clés

### **1. Génération Automatique de Planning**

#### Scénario : Étudiant s'inscrit à un cours
1. **Analyse du cours** :
   - Durée totale estimée
   - Nombre de modules/leçons
   - Quiz obligatoires
   - Dates limites (si cours avec deadline)

2. **Analyse des préférences étudiant** :
   - Jours préférés pour étudier
   - Heures préférées
   - Temps disponible par jour
   - Mode d'apprentissage (intensif, régulier, extensif)

3. **Génération du planning** :
   - Distribution des leçons sur la période disponible
   - Création de milestones (fin de module, quiz)
   - Ajout de buffers pour révision
   - Respect des prérequis

### **2. Mise à Jour Dynamique**

#### Quand l'étudiant complète une leçon :
- ✅ Marquer l'item comme complété dans le calendrier
- 📅 Ajuster automatiquement les dates suivantes si en avance
- 🎯 Créer un événement "Module X terminé" si applicable
- 📊 Mettre à jour la progression globale

#### Quand l'étudiant rate une deadline :
- ⚠️ Marquer l'item comme "overdue"
- 🔔 Envoyer une notification de rappel
- 📅 Proposer une nouvelle date de rattrapage

### **3. Suggestions Intelligentes**

#### Basées sur :
- **Progression actuelle** : Si en retard, suggérer plus de sessions
- **Performance** : Si excellent, proposer d'accélérer
- **Historique** : Jours/heures où l'étudiant est le plus actif
- **Deadlines** : Prioriser les éléments avec dates limites

### **4. Types d'Événements Calendrier**

1. **📚 Session d'Apprentissage** (`lesson`)
   - Leçon à compléter
   - Durée estimée
   - Lien direct vers la leçon

2. **📝 Quiz à Passer** (`quiz`)
   - Quiz obligatoire
   - Date limite
   - Score minimum requis

3. **⏰ Deadline** (`deadline`)
   - Date limite pour compléter un module
   - Date limite pour le cours entier

4. **🔔 Rappel** (`reminder`)
   - Rappel 24h avant un quiz
   - Rappel pour reprendre un cours en pause

5. **🎯 Milestone** (`milestone`)
   - Fin de module
   - 50% du cours complété
   - Cours terminé

---

## 🔧 Implémentation Technique

### **Service : `CalendarSyncService`**

```javascript
class CalendarSyncService {
  // Générer le planning initial
  static async generateSchedule(enrollmentId, courseId, userId) { }
  
  // Synchroniser la progression vers le calendrier
  static async syncProgressToCalendar(progressData) { }
  
  // Synchroniser les modifications calendrier vers la progression
  static async syncCalendarToProgress(eventId, updates) { }
  
  // Recalculer le planning (si retard/avance)
  static async recalculateSchedule(enrollmentId) { }
  
  // Créer un événement calendrier depuis un schedule_item
  static async createCalendarEvent(scheduleItemId) { }
  
  // Mettre à jour un événement calendrier
  static async updateCalendarEvent(eventId, scheduleItemId) { }
  
  // Supprimer un événement obsolète
  static async removeCalendarEvent(eventId) { }
}
```

### **Hooks d'Intégration**

#### Dans `progressService.js` :
```javascript
// Après marquage d'une leçon comme complétée
await CalendarSyncService.syncProgressToCalendar({
  type: 'lesson_completed',
  lessonId,
  enrollmentId,
  completedAt: new Date()
});
```

#### Dans `enrollmentController.js` :
```javascript
// Après inscription
await CalendarSyncService.generateSchedule(enrollmentId, courseId, userId);
```

#### Dans `calendarController.js` :
```javascript
// Quand un événement est modifié
await CalendarSyncService.syncCalendarToProgress(eventId, {
  newDate: req.body.start_date,
  newStatus: req.body.status
});
```

---

## 📊 Exemple de Données

### Planning Généré pour un Cours de 10 Leçons

```json
{
  "enrollment_id": 123,
  "course_id": 45,
  "schedule_items": [
    {
      "id": 1,
      "item_type": "lesson",
      "lesson_id": 101,
      "scheduled_date": "2025-11-14T09:00:00Z",
      "estimated_duration_minutes": 30,
      "priority": "medium",
      "status": "pending"
    },
    {
      "id": 2,
      "item_type": "lesson",
      "lesson_id": 102,
      "scheduled_date": "2025-11-15T09:00:00Z",
      "estimated_duration_minutes": 45,
      "priority": "medium",
      "status": "pending"
    },
    {
      "id": 3,
      "item_type": "quiz",
      "quiz_id": 5,
      "scheduled_date": "2025-11-20T10:00:00Z",
      "estimated_duration_minutes": 20,
      "priority": "high",
      "status": "pending"
    },
    {
      "id": 4,
      "item_type": "milestone",
      "scheduled_date": "2025-11-25T09:00:00Z",
      "metadata": {
        "type": "module_completion",
        "module_id": 3
      },
      "priority": "medium",
      "status": "pending"
    }
  ]
}
```

---

## 🎨 Interface Utilisateur (Frontend)

### **Vue Calendrier Enrichie**

1. **Événements de Cours** :
   - Couleur différente par type (leçon, quiz, deadline)
   - Badge de progression (% complété)
   - Indicateur visuel si en retard

2. **Drag & Drop** :
   - Permettre de déplacer les sessions d'apprentissage
   - Recalcul automatique des dates suivantes

3. **Suggestions** :
   - "Vous avez 3 leçons en retard, voulez-vous les replanifier ?"
   - "Excellent ! Vous êtes en avance, voulez-vous accélérer ?"

---

## 🔐 Sécurité et Performance

### **Sécurité**
- Vérifier que l'étudiant ne peut modifier que ses propres événements
- Valider les dates pour éviter les conflits
- Limiter le nombre de recalculs automatiques

### **Performance**
- Index sur `scheduled_date`, `enrollment_id`, `status`
- Cache des plannings générés
- Calculs asynchrones pour les recalculs

---

## 📈 Métriques et Analytics

### **Données à Tracker**
- Taux de respect du planning (% de sessions complétées à la date prévue)
- Temps réel vs temps estimé
- Impact des ajustements sur la progression
- Préférences réelles vs préférences déclarées

---

## 🚀 Plan d'Implémentation

### **Phase 1 : Infrastructure** (Semaine 1)
- ✅ Créer la table `course_schedule_items`
- ✅ Étendre la table `events`
- ✅ Créer le service `CalendarSyncService`

### **Phase 2 : Génération Automatique** (Semaine 2)
- ✅ Algorithme de planification
- ✅ Génération lors de l'inscription
- ✅ Intégration avec `student_preferences`

### **Phase 3 : Synchronisation** (Semaine 3)
- ✅ Hook progression → calendrier
- ✅ Hook calendrier → progression
- ✅ Recalcul automatique

### **Phase 4 : Interface** (Semaine 4)
- ✅ Affichage dans le calendrier
- ✅ Drag & drop
- ✅ Notifications et rappels

---

## 💡 Avantages

1. **Pour l'Étudiant** :
   - Planning personnalisé et adaptatif
   - Rappels automatiques
   - Visualisation claire de la progression
   - Flexibilité (peut ajuster le planning)

2. **Pour la Plateforme** :
   - Meilleure rétention (planning structuré)
   - Données d'engagement plus précises
   - Suggestions intelligentes
   - Expérience utilisateur améliorée

---

## 🔄 Cas d'Usage

### **Cas 1 : Inscription à un Cours**
```
1. Étudiant s'inscrit → Planning généré automatiquement
2. Événements créés dans le calendrier
3. Notifications envoyées pour les premières sessions
```

### **Cas 2 : Leçon Complétée**
```
1. Leçon complétée → Item marqué comme "completed"
2. Événement calendrier mis à jour
3. Prochaines leçons ajustées si en avance
4. Milestone créé si module terminé
```

### **Cas 3 : Retard dans le Planning**
```
1. Détection d'un retard (item "pending" avec date passée)
2. Notification envoyée
3. Suggestion de replanification
4. Recalcul automatique si accepté
```

### **Cas 4 : Modification Manuelle**
```
1. Étudiant déplace un événement dans le calendrier
2. Schedule_item mis à jour
3. Dates suivantes recalculées
4. Notification de confirmation
```

---

## 📝 Notes Techniques

- **Format de Dates** : Utiliser UTC pour la cohérence
- **Timezone** : Gérer le fuseau horaire de l'étudiant
- **Concurrence** : Gérer les modifications simultanées
- **Rollback** : Prévoir l'annulation des modifications

---

## ✅ Conclusion

Cette architecture permet une synchronisation bidirectionnelle fluide entre le suivi de progression et le calendrier, offrant une expérience d'apprentissage structurée et adaptative pour les étudiants.


