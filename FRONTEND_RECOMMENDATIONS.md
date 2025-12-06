# Recommandations Frontend - Gestion des Questions de Quiz

## Problèmes identifiés et résolus

### 1. Questions sans réponses

Les questions de quiz sans réponses (options vides) ne s'affichent pas correctement dans le frontend.

### 2. Synchronisation des tentatives

Le nombre de tentatives restantes n'était pas correctement synchronisé avec le backend.

## Solutions implémentées côté Backend

### 1. Validation lors de la création/mise à jour

- ✅ Validation ajoutée dans `createModuleQuiz` et `updateModuleQuiz`
- ✅ Les questions QCM doivent avoir au moins 2 réponses
- ✅ Les questions QCM doivent avoir au moins une réponse correcte
- ✅ Les questions Vrai/Faux doivent avoir une réponse correcte définie
- ✅ Les questions à réponse courte doivent avoir une réponse correcte

### 2. Amélioration de la réponse API

L'API retourne maintenant :

- `is_valid`: boolean - Indique si la question est valide
- `has_options`: boolean - Indique si la question a des options
- `invalid_questions_count`: number - Nombre de questions invalides dans le quiz
- Seules les questions valides sont retournées dans `questions[]`

## Recommandations Frontend

### 1. Vérifier les propriétés des questions

```typescript
// Vérifier avant d'afficher une question
if (question.is_valid === false || !question.has_options) {
  console.warn(`Question ${question.id} invalide: pas d'options`);
  // Ne pas afficher cette question ou afficher un message d'erreur
  return null;
}

// Pour les QCM et Vrai/Faux, vérifier qu'il y a des options
if (
  (question.question_type === "multiple_choice" ||
    question.question_type === "true_false") &&
  (!question.options || question.options.length === 0)
) {
  console.error(`Question ${question.id} sans options`);
  return null;
}
```

### 2. Filtrer les questions invalides

```typescript
// Filtrer automatiquement les questions invalides
const validQuestions = quiz.questions.filter(
  (q) =>
    q.is_valid !== false &&
    (q.question_type === "short_answer" || (q.options && q.options.length > 0))
);

// Utiliser validQuestions au lieu de quiz.questions
```

### 3. Afficher un avertissement si des questions sont invalides

```typescript
// Afficher un message si des questions sont invalides
if (quiz.invalid_questions_count > 0) {
  console.warn(
    `⚠️ ${quiz.invalid_questions_count} question(s) invalide(s) dans le quiz ${quiz.id}`
  );
  // Optionnel: afficher un message à l'utilisateur ou à l'admin
}
```

### 4. Validation côté frontend avant soumission

```typescript
// Valider avant de soumettre un quiz
const canSubmitQuiz = (quiz: Quiz) => {
  if (!quiz.questions || quiz.questions.length === 0) {
    return { valid: false, reason: "Aucune question dans le quiz" };
  }

  const invalidQuestions = quiz.questions.filter((q) => !q.is_valid);
  if (invalidQuestions.length > 0) {
    return {
      valid: false,
      reason: `${invalidQuestions.length} question(s) invalide(s)`,
    };
  }

  return { valid: true };
};
```

### 5. Gestion des erreurs dans le composant Quiz

```tsx
// Exemple React/TypeScript
const QuizComponent = ({ quiz }: { quiz: Quiz }) => {
  // Filtrer les questions invalides
  const validQuestions = quiz.questions.filter(
    (q) =>
      q.is_valid !== false &&
      (q.question_type === "short_answer" ||
        (q.options && q.options.length > 0))
  );

  // Afficher un avertissement si nécessaire
  if (quiz.invalid_questions_count > 0) {
    return (
      <Alert severity="warning">
        {quiz.invalid_questions_count} question(s) invalide(s) ont été exclues
        du quiz. Veuillez contacter l'administrateur.
      </Alert>
    );
  }

  if (validQuestions.length === 0) {
    return <Alert severity="error">Aucune question valide dans ce quiz.</Alert>;
  }

  return (
    <div>
      {validQuestions.map((question) => (
        <QuestionComponent key={question.id} question={question} />
      ))}
    </div>
  );
};
```

### 6. TypeScript Types (recommandé)

```typescript
interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false" | "short_answer";
  points: number;
  order_index: number;
  options: string[]; // Vide pour short_answer
  is_valid?: boolean; // Optionnel mais recommandé
  has_options?: boolean; // Optionnel mais recommandé
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  questions: QuizQuestion[];
  questions_count?: number;
  invalid_questions_count?: number;
  // ... autres propriétés
}
```

## Gestion des tentatives de quiz

### Champs disponibles dans la réponse API

L'API retourne maintenant les informations suivantes pour chaque quiz :

```typescript
interface Quiz {
  id: number;
  title: string;
  max_attempts: number; // Nombre maximum de tentatives autorisées
  attempts_count: number; // Nombre de tentatives déjà effectuées
  remaining_attempts: number; // Nombre de tentatives restantes (calculé)
  can_attempt: boolean; // Indique si l'utilisateur peut encore tenter le quiz
  previous_attempts: QuizAttempt[]; // Liste des tentatives précédentes
  // ... autres propriétés
}
```

### Affichage des tentatives restantes

**❌ Incorrect** (ancien code) :

```typescript
// Ne pas utiliser max_attempts directement
<Typography>
  Tentatives : {quiz.max_attempts} sur {quiz.max_attempts} restante(s)
</Typography>
```

**✅ Correct** (nouveau code) :

```typescript
// Utiliser remaining_attempts qui est déjà calculé
<Typography>
  Tentatives : {quiz.attempts_count} sur {quiz.max_attempts}({
    quiz.remaining_attempts
  } restante{quiz.remaining_attempts > 1 ? "s" : ""})
</Typography>
```

### Exemple complet d'affichage

```tsx
const QuizInfo = ({ quiz }: { quiz: Quiz }) => {
  return (
    <div>
      <Typography variant="h6">{quiz.title}</Typography>

      {/* Afficher les tentatives */}
      <Typography>
        Tentatives effectuées : {quiz.attempts_count} / {quiz.max_attempts}
      </Typography>

      {quiz.remaining_attempts > 0 ? (
        <Alert severity="info">
          Il vous reste {quiz.remaining_attempts} tentative
          {quiz.remaining_attempts > 1 ? "s" : ""}
        </Alert>
      ) : (
        <Alert severity="warning">
          Vous avez atteint le nombre maximum de tentatives
        </Alert>
      )}

      {/* Bouton de démarrage */}
      <Button disabled={!quiz.can_attempt} onClick={startQuiz}>
        {quiz.can_attempt ? "Commencer le quiz" : "Tentatives épuisées"}
      </Button>
    </div>
  );
};
```

### Vérification avant de démarrer un quiz

```typescript
function canStartQuiz(quiz: Quiz): boolean {
  // Utiliser can_attempt qui est déjà calculé côté backend
  return quiz.can_attempt === true;

  // Ou vérifier manuellement si nécessaire
  // return quiz.remaining_attempts > 0;
}
```

## Points importants

1. **Toujours vérifier `is_valid` ou `has_options`** avant d'afficher une question
2. **Filtrer les questions invalides** pour éviter les erreurs d'affichage
3. **Afficher un message d'avertissement** si des questions sont invalides
4. **Valider avant soumission** pour éviter d'envoyer des données invalides
5. **Logger les erreurs** pour faciliter le débogage
6. **Utiliser `remaining_attempts`** au lieu de calculer manuellement `max_attempts - attempts_count`
7. **Utiliser `can_attempt`** pour vérifier si l'utilisateur peut démarrer le quiz

## Exemple complet de gestion

```typescript
function processQuizData(quiz: Quiz): ProcessedQuiz {
  // Filtrer les questions invalides
  const validQuestions = quiz.questions.filter((q) => {
    // Vérifier is_valid si disponible
    if (q.is_valid === false) return false;

    // Pour QCM et Vrai/Faux, vérifier qu'il y a des options
    if (
      (q.question_type === "multiple_choice" ||
        q.question_type === "true_false") &&
      (!q.options || q.options.length === 0)
    ) {
      console.warn(`Question ${q.id} sans options`);
      return false;
    }

    return true;
  });

  return {
    ...quiz,
    questions: validQuestions,
    questions_count: validQuestions.length,
    has_invalid_questions: validQuestions.length < quiz.questions.length,
  };
}
```
