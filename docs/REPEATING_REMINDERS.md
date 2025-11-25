# Système de Rappels Répétitifs

## 📋 Fonctionnement

Le système envoie des rappels selon le schéma suivant :

### 1. Premier Rappel : 3 jours d'inactivité
- ✅ Envoyé **une seule fois** quand l'étudiant n'a pas accédé au cours depuis 3 jours
- 📧 Email de rappel envoyé

### 2. Deuxième Rappel : 7 jours d'inactivité
- ✅ Envoyé **une seule fois** quand l'étudiant n'a pas accédé au cours depuis 7 jours
- 📧 Email de rappel envoyé

### 3. Troisième Rappel : 14 jours d'inactivité
- ✅ Envoyé **une seule fois** quand l'étudiant n'a pas accédé au cours depuis 14 jours
- 📧 Email de rappel envoyé
- 🎯 **C'est le premier rappel à 14 jours**

### 4. Rappels Répétitifs : Tous les 14 jours (infini)
- ✅ Après le premier rappel à 14 jours, les rappels continuent **tous les 14 jours**
- 📧 Email de rappel envoyé à : 28 jours, 42 jours, 56 jours, 70 jours, etc.
- ♾️ **Continue indéfiniment** jusqu'à ce que l'étudiant reprenne le cours ou le termine

## 📅 Exemple Concret

Si un étudiant s'inscrit le **1er janvier** et devient inactif :

| Date | Jours d'inactivité | Rappel | Type |
|------|-------------------|--------|------|
| 4 janvier | 3 jours | ✅ Envoyé | Premier rappel |
| 8 janvier | 7 jours | ✅ Envoyé | Deuxième rappel |
| 15 janvier | 14 jours | ✅ Envoyé | Troisième rappel (premier à 14j) |
| 29 janvier | 28 jours | ✅ Envoyé | Rappel répétitif (14j après le premier) |
| 12 février | 42 jours | ✅ Envoyé | Rappel répétitif (14j après le précédent) |
| 26 février | 56 jours | ✅ Envoyé | Rappel répétitif (14j après le précédent) |
| 12 mars | 70 jours | ✅ Envoyé | Rappel répétitif (14j après le précédent) |
| ... | ... | ✅ Continue | Indéfiniment |

## 🔧 Logique Technique

### Détection des Rappels Répétitifs

Le système détecte les enrollments pour les rappels répétitifs si :
1. ✅ L'étudiant a **déjà reçu un rappel à 14 jours** (enregistré dans `course_reminder_logs`)
2. ✅ L'inactivité est **>= 28 jours** (14 jours après le premier rappel)
3. ✅ **Au moins 14 jours** se sont écoulés depuis le dernier rappel à 14 jours
4. ✅ Le nombre de jours depuis le dernier rappel est un **multiple de 14** (14, 28, 42, etc.)

### Protection Anti-Doublon

- **Rappels normaux (3, 7, 14 jours)** : Vérifie les 24 dernières heures
- **Rappels répétitifs** : Vérifie qu'au moins 14 jours se sont écoulés depuis le dernier rappel à 14 jours

## 📊 Enregistrement dans la Base de Données

Tous les rappels (normaux et répétitifs) sont enregistrés dans `course_reminder_logs` avec :
- `reminder_days = 3` pour le premier rappel
- `reminder_days = 7` pour le deuxième rappel
- `reminder_days = 14` pour tous les rappels à 14 jours (premier et répétitifs)

Cela permet de :
- ✅ Suivre tous les rappels envoyés
- ✅ Vérifier quand le dernier rappel à 14 jours a été envoyé
- ✅ Calculer le prochain rappel répétitif

## 🎯 Arrêt des Rappels

Les rappels s'arrêtent automatiquement si :
- ✅ L'étudiant **reprend le cours** (met à jour `last_accessed_at`)
- ✅ L'étudiant **termine le cours** (`completed_at` est défini)
- ✅ L'enrollment est **désactivé** (`is_active = FALSE`)

## 🔍 Vérification

### Voir les rappels envoyés pour un enrollment

```sql
SELECT 
  crl.*,
  u.email,
  c.title as course_title
FROM course_reminder_logs crl
INNER JOIN enrollments e ON crl.enrollment_id = e.id
INNER JOIN users u ON e.user_id = u.id
INNER JOIN courses c ON e.course_id = c.id
WHERE crl.enrollment_id = ENROLLMENT_ID
ORDER BY crl.sent_at DESC;
```

### Voir les enrollments qui recevront un rappel répétitif

```sql
SELECT 
  e.id,
  u.email,
  c.title,
  DATEDIFF(NOW(), COALESCE(e.last_accessed_at, e.enrolled_at)) as days_inactive,
  MAX(crl.sent_at) as last_reminder_14d
FROM enrollments e
INNER JOIN users u ON e.user_id = u.id
INNER JOIN courses c ON e.course_id = c.id
LEFT JOIN course_reminder_logs crl ON e.id = crl.enrollment_id AND crl.reminder_days = 14
WHERE e.is_active = TRUE
  AND e.completed_at IS NULL
  AND e.progress_percentage > 0
  AND e.progress_percentage < 100
  AND crl.sent_at IS NOT NULL
  AND DATEDIFF(NOW(), crl.sent_at) >= 14
  AND MOD(DATEDIFF(NOW(), crl.sent_at), 14) = 0
GROUP BY e.id;
```

## ✅ Résumé

- **3 jours** : Premier rappel (une fois)
- **7 jours** : Deuxième rappel (une fois)
- **14 jours** : Troisième rappel (une fois, premier à 14j)
- **28, 42, 56, 70... jours** : Rappels répétitifs (tous les 14 jours, indéfiniment)

Le système continue automatiquement à envoyer des rappels tous les 14 jours jusqu'à ce que l'étudiant reprenne ou termine son cours ! 🎯

