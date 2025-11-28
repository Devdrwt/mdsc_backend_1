# Différenciation Cours Live vs Cours à la Demande

## 📋 Vue d'ensemble

Ce document détaille toutes les différences entre les cours en **live** et les cours **à la demande (on_demand)** dans le système backend.

## 🔑 Différences Clés

### 1. **Champs Obligatoires**

#### Cours en Live (`course_type = 'live'`)

- ✅ `enrollment_deadline` - **OBLIGATOIRE** (date limite d'inscription)
- ✅ `course_start_date` - **OBLIGATOIRE** (date de début du cours)
- ✅ `course_end_date` - **OBLIGATOIRE** (date de fin du cours)
- ✅ `max_students` - **OBLIGATOIRE** (nombre maximum d'étudiants, doit être > 0)

#### Cours à la Demande (`course_type = 'on_demand'`)

- ❌ `enrollment_deadline` - **OPTIONNEL** (peut être NULL)
- ❌ `course_start_date` - **OPTIONNEL** (peut être NULL)
- ❌ `course_end_date` - **OPTIONNEL** (peut être NULL)
- ❌ `max_students` - **OPTIONNEL** (peut être NULL)

### 2. **Validations lors de la Création**

#### Cours en Live

```javascript
// Dans createCourse (courseController.js)
if (course_type === "live") {
  // Validation des dates obligatoires
  if (!course_start_date || !course_end_date) {
    return res.status(400).json({
      success: false,
      message: "Les dates de début et fin sont obligatoires pour un cours Live",
    });
  }

  // Validation de l'ordre des dates
  if (new Date(course_start_date) >= new Date(course_end_date)) {
    return res.status(400).json({
      success: false,
      message: "La date de fin doit être après la date de début",
    });
  }

  // Validation max_students
  if (!max_students || max_students <= 0) {
    return res.status(400).json({
      success: false,
      message:
        "Le nombre maximum d'étudiants est obligatoire pour un cours Live",
    });
  }
}
```

#### Cours à la Demande

- Aucune validation spéciale pour les dates ou `max_students`
- Ces champs peuvent être `NULL` sans problème

### 3. **Validations lors de la Mise à Jour**

#### Cours en Live

```javascript
// Dans updateCourse (courseController.js)
if (req.body.course_type === "live") {
  const courseStartDate =
    req.body.course_start_date || courses[0].course_start_date;
  const courseEndDate = req.body.course_end_date || courses[0].course_end_date;
  const maxStudents = req.body.max_students || courses[0].max_students;

  // Validation que les dates existent
  if (!courseStartDate || !courseEndDate) {
    return res.status(400).json({
      success: false,
      message: "Les dates de début et fin sont obligatoires pour un cours Live",
    });
  }

  // Validation de l'ordre des dates
  if (new Date(courseStartDate) >= new Date(courseEndDate)) {
    return res.status(400).json({
      success: false,
      message: "La date de fin doit être après la date de début",
    });
  }

  // Validation max_students
  if (!maxStudents || maxStudents <= 0) {
    return res.status(400).json({
      success: false,
      message:
        "Le nombre maximum d'étudiants est obligatoire pour un cours Live",
    });
  }
}
```

#### Cours à la Demande

- Permet de mettre les dates à `NULL`
- Permet de mettre `max_students` à `NULL`

### 4. **Validations lors de la Demande d'Approbation**

#### Cours en Live

```javascript
// Dans requestPublication (courseApprovalController.js)
if (course.course_type === "live") {
  // Validation enrollment_deadline
  if (!course.enrollment_deadline) {
    errors.enrollment_deadline =
      "La date limite d'inscription est obligatoire pour les cours en live";
  }

  // Validation course_start_date
  if (!course.course_start_date) {
    errors.course_start_date =
      "La date de début est obligatoire pour les cours en live";
  }

  // Validation course_end_date
  if (!course.course_end_date) {
    errors.course_end_date =
      "La date de fin est obligatoire pour les cours en live";
  }

  // Validation max_students
  if (!course.max_students || course.max_students <= 0) {
    errors.max_students =
      "Le nombre maximum d'étudiants est obligatoire pour les cours en live";
  }

  // Validation de l'ordre des dates
  if (
    course.enrollment_deadline &&
    course.course_start_date &&
    course.course_end_date
  ) {
    const enrollmentDeadline = new Date(course.enrollment_deadline);
    const startDate = new Date(course.course_start_date);
    const endDate = new Date(course.course_end_date);

    if (enrollmentDeadline >= startDate) {
      errors.enrollment_deadline =
        "La date limite d'inscription doit être antérieure à la date de début du cours";
    }
    if (startDate >= endDate) {
      errors.course_start_date =
        "La date de début doit être antérieure à la date de fin";
    }
  }
}
```

#### Cours à la Demande

- Aucune validation des dates ou `max_students` lors de la demande d'approbation
- Seules les validations communes s'appliquent :
  - Titre (min. 5 caractères)
  - Description (min. 10 caractères)
  - Au moins un module avec des leçons
  - Évaluation finale créée

### 5. **Validations lors de l'Approbation Admin**

#### Cours en Live

```javascript
// Dans approveCourse (courseApprovalController.js)
if (course.course_type === "live") {
  if (
    !course.enrollment_deadline ||
    !course.course_start_date ||
    !course.course_end_date
  ) {
    return res.status(400).json({
      success: false,
      message: "Les dates sont obligatoires pour les cours en live",
      errors: {
        dates: "Les dates sont obligatoires pour les cours en live",
      },
    });
  }
  if (!course.max_students || course.max_students <= 0) {
    return res.status(400).json({
      success: false,
      message:
        "Le nombre maximum d'étudiants est obligatoire pour les cours en live",
      errors: {
        max_students:
          "Le nombre maximum d'étudiants est obligatoire pour les cours en live",
      },
    });
  }
}
```

#### Cours à la Demande

- Aucune validation supplémentaire pour les dates ou `max_students`

### 6. **Stockage en Base de Données**

#### Cours en Live

```sql
-- Les champs sont stockés avec des valeurs
enrollment_deadline: DATETIME NOT NULL
course_start_date: DATETIME NOT NULL
course_end_date: DATETIME NOT NULL
max_students: INT NOT NULL (valeur > 0)
```

#### Cours à la Demande

```sql
-- Les champs peuvent être NULL
enrollment_deadline: DATETIME NULL
course_start_date: DATETIME NULL
course_end_date: DATETIME NULL
max_students: INT NULL
```

### 7. **Fonctionnalités Spécifiques**

#### Cours en Live

- ✅ **Sessions Live** : Intégration avec Jitsi Meet pour les sessions en direct
- ✅ **Calendrier** : Synchronisation avec le calendrier étudiant
- ✅ **Limite d'inscription** : Date limite d'inscription (`enrollment_deadline`)
- ✅ **Capacité limitée** : Nombre maximum d'étudiants (`max_students`)
- ✅ **Période définie** : Dates de début et fin du cours

#### Cours à la Demande

- ✅ **Accès libre** : Pas de limite de temps pour s'inscrire
- ✅ **Capacité illimitée** : Pas de limite sur le nombre d'étudiants
- ✅ **Accès asynchrone** : Les étudiants peuvent suivre le cours à leur rythme
- ✅ **Pas de sessions live** : Pas d'intégration Jitsi Meet

## 📊 Tableau Comparatif

| Caractéristique            | Cours Live           | Cours à la Demande |
| -------------------------- | -------------------- | ------------------ |
| `enrollment_deadline`      | ✅ Obligatoire       | ❌ Optionnel       |
| `course_start_date`        | ✅ Obligatoire       | ❌ Optionnel       |
| `course_end_date`          | ✅ Obligatoire       | ❌ Optionnel       |
| `max_students`             | ✅ Obligatoire (> 0) | ❌ Optionnel       |
| Sessions Live (Jitsi)      | ✅ Oui               | ❌ Non             |
| Synchronisation calendrier | ✅ Oui               | ❌ Non             |
| Accès asynchrone           | ❌ Non               | ✅ Oui             |
| Capacité limitée           | ✅ Oui               | ❌ Non             |

## 🔍 Points de Validation dans le Code

### 1. **Création de cours** (`createCourse`)

- ✅ Validation conditionnelle selon `course_type`
- ✅ Dates obligatoires uniquement pour `live`
- ✅ `max_students` obligatoire uniquement pour `live`

### 2. **Mise à jour de cours** (`updateCourse`)

- ✅ Validation conditionnelle lors du changement de type
- ✅ Vérification que les dates existent si `course_type = 'live'`

### 3. **Demande d'approbation** (`requestPublication`)

- ✅ Validation détaillée avec messages d'erreur spécifiques
- ✅ Validation de l'ordre des dates pour les cours live
- ✅ Messages d'erreur différenciés par champ

### 4. **Approbation admin** (`approveCourse`)

- ✅ Double validation des conditions avant approbation
- ✅ Vérification spécifique pour les cours live

## ✅ Conclusion

Les spécifications backend permettent **clairement de différencier** les cours en live des cours à la demande :

1. **Validations conditionnelles** : Les champs obligatoires sont différents selon le type
2. **Messages d'erreur spécifiques** : Chaque type a ses propres règles de validation
3. **Stockage différencié** : Les cours live stockent des valeurs, les cours à la demande peuvent avoir NULL
4. **Fonctionnalités spécifiques** : Les cours live ont des fonctionnalités supplémentaires (sessions, calendrier)

Le système est **robuste** et **nuancé** pour gérer les deux types de cours de manière distincte.
