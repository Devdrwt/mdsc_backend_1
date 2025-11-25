# Système de Rappel des Cours en Progression

## Vue d'ensemble

Le système de rappel envoie automatiquement des emails aux étudiants qui ont des cours en progression mais qui n'ont pas accédé à leur cours depuis un certain temps.

## Fonctionnalités

- **Rappels automatiques** : Envoie des emails de rappel à des périodes définies (3, 7, 14 jours d'inactivité)
- **Détection intelligente** : Identifie uniquement les étudiants avec des cours en progression (0% < progression < 100%)
- **Évite les doublons** : Ne renvoie pas de rappel si un rappel a déjà été envoyé récemment
- **Statistiques** : Suivi des rappels envoyés avec statistiques détaillées
- **Logs** : Enregistrement de tous les rappels envoyés dans la base de données

## Configuration

### Périodes de rappel

Les périodes de rappel sont définies dans `src/services/courseReminderService.js` :

```javascript
static REMINDER_PERIODS = [3, 7, 14]; // 3 jours, 7 jours, 14 jours
```

Vous pouvez modifier ces valeurs selon vos besoins.

### Variables d'environnement

Assurez-vous que les variables suivantes sont configurées dans votre fichier `.env` :

```env
EMAIL_ENABLED=true
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=votre-email@gmail.com
EMAIL_PASSWORD=votre-mot-de-passe
EMAIL_FROM="Maison de la Société Civile <noreply@mdsc.local>"
FRONTEND_URL=http://localhost:3000
```

## Utilisation

### 1. Via l'API (Administrateur uniquement)

#### Envoyer tous les rappels

```bash
POST /api/admin/reminders/send-all
Authorization: Bearer <admin_token>
```

**Réponse :**
```json
{
  "success": true,
  "message": "Rappels envoyés avec succès",
  "data": {
    "totalEnrollments": 15,
    "totalSuccess": 12,
    "totalFailure": 0,
    "totalSkipped": 3,
    "periods": [
      {
        "period": 3,
        "total": 5,
        "success": 5,
        "failure": 0,
        "skipped": 0
      },
      {
        "period": 7,
        "total": 6,
        "success": 4,
        "failure": 0,
        "skipped": 2
      },
      {
        "period": 14,
        "total": 4,
        "success": 3,
        "failure": 0,
        "skipped": 1
      }
    ]
  }
}
```

#### Envoyer les rappels pour une période spécifique

```bash
POST /api/admin/reminders/send/:days
Authorization: Bearer <admin_token>
```

Exemple : Envoyer les rappels pour 7 jours d'inactivité
```bash
POST /api/admin/reminders/send/7
```

#### Obtenir les statistiques

```bash
GET /api/admin/reminders/stats
Authorization: Bearer <admin_token>
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "total": {
      "total_enrollments": 50,
      "total_reminders_sent": 120,
      "successful_reminders": 115,
      "failed_reminders": 5
    },
    "byPeriod": [
      {
        "reminder_days": 3,
        "count": 45,
        "success_count": 44,
        "failure_count": 1,
        "last_sent": "2024-01-15T09:00:00.000Z"
      },
      {
        "reminder_days": 7,
        "count": 40,
        "success_count": 38,
        "failure_count": 2,
        "last_sent": "2024-01-15T09:00:00.000Z"
      },
      {
        "reminder_days": 14,
        "count": 35,
        "success_count": 33,
        "failure_count": 2,
        "last_sent": "2024-01-15T09:00:00.000Z"
      }
    ]
  }
}
```

### 2. Via le script automatique (Cron)

Le script `scripts/sendCourseReminders.js` peut être exécuté automatiquement via un cron job.

#### Configuration Cron (Linux/Mac)

Éditez votre crontab :
```bash
crontab -e
```

Ajoutez la ligne suivante pour exécuter le script tous les jours à 9h00 :
```cron
0 9 * * * cd /chemin/vers/mdsc_auth_api && node scripts/sendCourseReminders.js >> /var/log/mdsc_reminders.log 2>&1
```

#### Exécution manuelle

```bash
cd /chemin/vers/mdsc_auth_api
node scripts/sendCourseReminders.js
```

## Structure de la base de données

### Table `course_reminder_logs`

Cette table est créée automatiquement lors de la première exécution. Elle enregistre tous les rappels envoyés.

```sql
CREATE TABLE course_reminder_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  reminder_days INT NOT NULL,
  sent_at DATETIME NOT NULL,
  success TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_enrollment (enrollment_id),
  INDEX idx_sent_at (sent_at),
  INDEX idx_reminder_days (reminder_days),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
);
```

## Logique de détection

Le système identifie les étudiants à rappeler selon les critères suivants :

1. **Enrollment actif** : `is_active = TRUE`
2. **Cours non terminé** : `completed_at IS NULL`
3. **Progression entre 0% et 100%** : `progress_percentage > 0 AND progress_percentage < 100`
4. **Inactivité correspondant à la période** : `DATEDIFF(NOW(), COALESCE(last_accessed_at, enrolled_at)) = X jours`
5. **Utilisateur actif et vérifié** : `is_active = TRUE AND is_email_verified = TRUE`

## Template d'email

Le template d'email inclut :
- Nom de l'étudiant
- Titre du cours
- Barre de progression visuelle
- Pourcentage de progression
- Nombre de jours d'inactivité
- Lien direct vers le cours
- Design responsive et professionnel

## Personnalisation

### Modifier les périodes de rappel

Éditez `src/services/courseReminderService.js` :

```javascript
static REMINDER_PERIODS = [3, 7, 14, 30]; // Ajouter 30 jours
```

### Modifier le template d'email

Éditez la méthode `getReminderEmailTemplate` dans `src/services/courseReminderService.js`.

### Modifier l'URL du frontend

Assurez-vous que `FRONTEND_URL` est correctement configuré dans votre `.env`.

## Dépannage

### Les emails ne sont pas envoyés

1. Vérifiez que `EMAIL_ENABLED=true` dans votre `.env`
2. Vérifiez les identifiants email (`EMAIL_USER`, `EMAIL_PASSWORD`)
3. Consultez les logs du serveur pour les erreurs
4. Vérifiez que les étudiants ont `is_email_verified = TRUE`

### Les rappels sont envoyés plusieurs fois

Le système évite les doublons en vérifiant si un rappel a déjà été envoyé dans les 24 dernières heures pour la même période. Si le problème persiste, vérifiez la table `course_reminder_logs`.

### Le script cron ne s'exécute pas

1. Vérifiez les permissions du script : `chmod +x scripts/sendCourseReminders.js`
2. Vérifiez le chemin absolu dans le crontab
3. Vérifiez les logs : `tail -f /var/log/mdsc_reminders.log`
4. Testez l'exécution manuelle du script

## Sécurité

- Seuls les administrateurs peuvent déclencher les rappels via l'API
- Les emails sont envoyés uniquement aux utilisateurs avec `is_email_verified = TRUE`
- Les logs sont conservés pour audit et statistiques

## Support

Pour toute question ou problème, contactez l'équipe de développement.

