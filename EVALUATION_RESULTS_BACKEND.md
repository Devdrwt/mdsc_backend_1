# Backend - Support du Récapitulatif des Résultats d'Évaluation

## Modifications apportées

Le backend a été mis à jour pour retourner toutes les informations nécessaires au récapitulatif détaillé des résultats d'évaluation finale, comme implémenté côté frontend.

## Endpoints modifiés

### 1. `POST /api/evaluations/:id/submit` (submitEvaluation)
### 2. `POST /api/enrollments/:enrollmentId/evaluations/submit` (submitEvaluationAttempt)

## Structure de la réponse API

### Avant (ancienne structure)
```json
{
  "success": true,
  "data": {
    "attempt_id": 123,
    "score": 80,
    "total_points": 100,
    "percentage": 80,
    "passed": true,
    "correct_answers": 8,
    "total_questions": 10
  }
}
```

### Après (nouvelle structure)
```json
{
  "success": true,
  "data": {
    "attempt_id": 123,
    "score": 80,
    "total_points": 100,
    "percentage": 80,
    "passed": true,
    "is_passed": true,
    "correct_answers": 8,
    "total_questions": 10,
    "question_results": [
      {
        "question_id": 1,
        "question_text": "Quelle est la capitale de la France ?",
        "question_type": "multiple_choice",
        "points": 10,
        "order_index": 0,
        "student_answer": "Paris",
        "correct_answer": "Paris",
        "is_correct": true,
        "points_earned": 10,
        "points_lost": 0
      },
      {
        "question_id": 2,
        "question_text": "Quel est le résultat de 2 + 2 ?",
        "question_type": "multiple_choice",
        "points": 10,
        "order_index": 1,
        "student_answer": "3",
        "correct_answer": "4",
        "is_correct": false,
        "points_earned": 0,
        "points_lost": 10
      }
    ],
    "summary": {
      "total_questions": 10,
      "correct_questions": 8,
      "incorrect_questions": 2,
      "total_points": 100,
      "earned_points": 80,
      "lost_points": 20
    }
  }
}
```

## Champs détaillés

### `question_results[]` - Détails par question

Chaque objet dans `question_results` contient :

- `question_id` (number) : ID de la question
- `question_text` (string) : Texte de la question
- `question_type` (string) : Type de question (`multiple_choice`, `true_false`, `short_answer`)
- `points` (number) : Points totaux de la question
- `order_index` (number) : Ordre d'affichage de la question
- `student_answer` (string|null) : Réponse de l'étudiant
- `correct_answer` (string|null) : Bonne(s) réponse(s) (peut être multiple, séparées par virgule)
- `is_correct` (boolean) : Indique si la réponse est correcte
- `points_earned` (number) : Points obtenus pour cette question (0 si incorrecte)
- `points_lost` (number) : Points perdus pour cette question (0 si correcte)

### `summary` - Statistiques globales

- `total_questions` (number) : Nombre total de questions
- `correct_questions` (number) : Nombre de questions correctes
- `incorrect_questions` (number) : Nombre de questions incorrectes
- `total_points` (number) : Points totaux possibles
- `earned_points` (number) : Points obtenus
- `lost_points` (number) : Points perdus

## Utilisation côté Frontend

Le frontend peut maintenant utiliser ces données pour :

1. **Séparer les questions validées et ratées** :
   ```typescript
   const validatedQuestions = question_results.filter(q => q.is_correct);
   const failedQuestions = question_results.filter(q => !q.is_correct);
   ```

2. **Afficher le récapitulatif détaillé** :
   - Questions validées avec réponse de l'étudiant (en vert)
   - Questions ratées avec réponse de l'étudiant (en rouge) et bonne réponse (en vert)
   - Points obtenus/perdus par question

3. **Afficher les statistiques** :
   - Utiliser `summary` pour afficher les totaux
   - Calculer les pourcentages si nécessaire

## Exemple d'utilisation Frontend

```typescript
interface QuestionResult {
  question_id: number;
  question_text: string;
  question_type: string;
  points: number;
  order_index: number;
  student_answer: string | null;
  correct_answer: string | null;
  is_correct: boolean;
  points_earned: number;
  points_lost: number;
}

interface EvaluationResult {
  attempt_id: number;
  score: number;
  total_points: number;
  percentage: number;
  passed: boolean;
  question_results: QuestionResult[];
  summary: {
    total_questions: number;
    correct_questions: number;
    incorrect_questions: number;
    total_points: number;
    earned_points: number;
    lost_points: number;
  };
}

// Utilisation
const result: EvaluationResult = response.data;

// Séparer les questions
const validated = result.question_results.filter(q => q.is_correct);
const failed = result.question_results.filter(q => !q.is_correct);

// Afficher le récapitulatif
console.log(`Questions validées : ${validated.length}`);
console.log(`Questions ratées : ${failed.length}`);
console.log(`Points obtenus : ${result.summary.earned_points} / ${result.summary.total_points}`);
```

## Notes importantes

1. **Questions sans réponse** : Si une question n'a pas de réponse (`student_answer === null`), elle est considérée comme incorrecte.

2. **Questions à réponse courte** : Pour les questions de type `short_answer`, la comparaison est faite de manière flexible (normalisation des accents, ponctuation, etc.).

3. **Questions à choix multiples** : Pour les QCM, `correct_answer` peut contenir plusieurs réponses séparées par des virgules si plusieurs réponses sont correctes.

4. **Ordre des questions** : Les questions sont retournées dans l'ordre défini par `order_index`.

## Compatibilité

Ces modifications sont **rétrocompatibles** :
- Les champs existants (`score`, `total_points`, `percentage`, etc.) sont toujours présents
- Les nouveaux champs (`question_results`, `summary`) sont ajoutés en plus
- Le frontend peut utiliser les nouveaux champs s'ils sont disponibles, sinon utiliser les anciens

