# Système Automatique de Rappel des Cours

## 🎯 Fonctionnement Automatique

**OUI, le système envoie automatiquement les rappels !** 

Le scheduler est intégré au serveur et s'exécute **automatiquement une fois par jour à 9h00** pour envoyer les rappels aux étudiants avec des cours en progression.

## ⚙️ Comment ça fonctionne

### 1. Démarrage Automatique

Quand le serveur démarre :
- ✅ Le scheduler se lance automatiquement
- ✅ Il calcule le prochain moment d'exécution (9h00 du matin)
- ✅ Il programme l'exécution quotidienne

### 2. Exécution Quotidienne

Chaque jour à **9h00 du matin**, le système :
1. 🔍 Détecte automatiquement les étudiants avec des cours en progression inactifs
2. 📧 Envoie les emails de rappel selon les périodes configurées (3, 7, 14 jours)
3. 📊 Enregistre les résultats dans la base de données
4. 📝 Log les statistiques dans la console

### 3. Périodes de Rappel

Les rappels sont envoyés automatiquement pour :
- **3 jours** d'inactivité
- **7 jours** d'inactivité  
- **14 jours** d'inactivité

## 🔧 Configuration

### Activer/Désactiver le Scheduler

Par défaut, le scheduler est **ACTIVÉ**. Pour le désactiver, ajoutez dans votre `.env` :

```env
REMINDER_SCHEDULER_ENABLED=false
```

### Modifier l'heure d'exécution

Par défaut, les rappels sont envoyés à **9h00 du matin**. Pour modifier cette heure, éditez `src/services/reminderScheduler.js` :

```javascript
nextRun.setHours(9, 0, 0, 0); // Changez 9 par l'heure souhaitée (0-23)
```

### Modifier les périodes de rappel

Éditez `src/services/courseReminderService.js` :

```javascript
static REMINDER_PERIODS = [3, 7, 14]; // Modifiez selon vos besoins
```

## 📊 Vérifier le Statut

### Via l'API (Admin)

```bash
# Vérifier le statut du scheduler
GET /api/admin/reminders/scheduler/status
Authorization: Bearer <admin_token>
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "isScheduled": true,
    "lastRun": "2024-01-15T09:00:00.000Z",
    "nextRun": "2024-01-16T09:00:00.000Z",
    "schedulerEnabled": true
  }
}
```

### Via les Logs du Serveur

Quand le serveur démarre, vous verrez :
```
🔄 [SCHEDULER] Démarrage du scheduler automatique des rappels...
⏰ [SCHEDULER] Prochaine exécution programmée: 16/01/2024 09:00:00
⏳ [SCHEDULER] Délai: 720 minutes
✅ [SCHEDULER] Scheduler configuré pour s'exécuter quotidiennement à 9h00
```

Quand les rappels sont envoyés (9h00) :
```
🚀 [SCHEDULER] Démarrage de l'envoi automatique des rappels...
📅 [SCHEDULER] Date: 2024-01-16T09:00:00.000Z
📧 Envoi de rappels pour 3 jours d'inactivité : 5 enrollment(s) trouvé(s)
✅ Rappel envoyé à user@example.com pour le cours "..." (3 jours d'inactivité)
...
✅ [SCHEDULER] Rappels terminés en 2.45s
📊 [SCHEDULER] Résultats: 12 succès, 0 échecs, 3 ignorés
```

## 🎮 Contrôle Manuel (Admin)

### Démarrer le Scheduler

```bash
POST /api/admin/reminders/scheduler/start
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "runImmediately": true  // Optionnel: exécuter immédiatement
}
```

### Arrêter le Scheduler

```bash
POST /api/admin/reminders/scheduler/stop
Authorization: Bearer <admin_token>
```

### Forcer l'Envoi Immédiat

```bash
# Option 1: Via le scheduler avec exécution immédiate
POST /api/admin/reminders/scheduler/start
{
  "runImmediately": true
}

# Option 2: Via l'endpoint direct
POST /api/admin/reminders/send-all
```

## 🔍 Vérification

### Vérifier que le Scheduler Fonctionne

1. **Vérifier les logs au démarrage du serveur** :
   ```
   ✅ Scheduler des rappels de cours initialisé
   🔄 [SCHEDULER] Démarrage du scheduler automatique des rappels...
   ```

2. **Vérifier les rappels envoyés** :
   ```sql
   SELECT * FROM course_reminder_logs 
   ORDER BY sent_at DESC 
   LIMIT 10;
   ```

3. **Vérifier le statut via API** :
   ```bash
   GET /api/admin/reminders/scheduler/status
   ```

## ⚠️ Points Importants

### Le Scheduler est Automatique

- ✅ **Aucune configuration cron nécessaire**
- ✅ **Aucune intervention manuelle requise**
- ✅ **Fonctionne dès que le serveur est démarré**

### Conditions pour Recevoir un Rappel

Un étudiant recevra un rappel si :
1. ✅ Il a un enrollment actif (`is_active = TRUE`)
2. ✅ Le cours n'est pas terminé (`completed_at IS NULL`)
3. ✅ La progression est entre 0% et 100%
4. ✅ L'inactivité correspond à une période configurée (3, 7, ou 14 jours)
5. ✅ L'utilisateur est actif et vérifié (`is_active = TRUE`, `is_email_verified = TRUE`)
6. ✅ Aucun rappel n'a été envoyé récemment (évite les doublons)

### Éviter les Doublons

Le système évite automatiquement d'envoyer plusieurs fois le même rappel :
- Vérifie si un rappel a déjà été envoyé dans les 24 dernières heures
- Enregistre tous les rappels dans `course_reminder_logs`

## 🚀 Déploiement

### En Production

Le scheduler fonctionne automatiquement en production. Assurez-vous que :
1. ✅ Le serveur reste actif 24/7 (ou utilisez un service comme PM2)
2. ✅ La configuration email est correcte
3. ✅ `REMINDER_SCHEDULER_ENABLED` n'est pas défini à `false`

### Avec PM2 (Recommandé)

```bash
# Démarrer le serveur avec PM2
pm2 start src/server.js --name mdsc-api

# Voir les logs
pm2 logs mdsc-api

# Redémarrer
pm2 restart mdsc-api
```

## 📝 Résumé

**Le système envoie automatiquement les rappels tous les jours à 9h00** sans aucune intervention manuelle. Il suffit de :
1. ✅ Démarrer le serveur
2. ✅ Laisser le scheduler fonctionner
3. ✅ Les étudiants recevront automatiquement leurs rappels

**C'est tout ! 🎉**

