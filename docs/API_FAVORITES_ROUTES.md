# Routes API pour les Favoris de Cours

## 📍 Routes disponibles

Le router `courseRoutes` est monté sur `/api/courses` dans `server.js`, donc toutes les routes ci-dessous sont préfixées par `/api/courses`.

### 1. Ajouter un cours aux favoris

**Endpoint :** `POST /api/courses/:courseId/favorite`

**Authentification :** Requis (token JWT)

**Paramètres :**

- `courseId` (dans l'URL) : ID du cours à ajouter aux favoris

**Réponse succès (200) :**

```json
{
  "success": true,
  "message": "Cours ajouté aux favoris avec succès"
}
```

**Réponses d'erreur :**

- `400` : Le cours est déjà dans les favoris
- `401` : Non authentifié
- `404` : Cours non trouvé
- `500` : Erreur serveur

---

### 2. Retirer un cours des favoris

**Endpoint :** `DELETE /api/courses/:courseId/favorite`

**Authentification :** Requis (token JWT)

**Paramètres :**

- `courseId` (dans l'URL) : ID du cours à retirer des favoris

**Réponse succès (200) :**

```json
{
  "success": true,
  "message": "Cours retiré des favoris avec succès"
}
```

**Réponses d'erreur :**

- `401` : Non authentifié
- `404` : Le cours n'est pas dans les favoris
- `500` : Erreur serveur

---

### 3. Récupérer la liste des cours favoris

**Endpoint :** `GET /api/courses/favorites`

**Authentification :** Requis (token JWT)

**Paramètres de requête (optionnels) :**

- `page` : Numéro de page (défaut: 1)
- `limit` : Nombre d'éléments par page (défaut: 10, max: 100)
- `search` : Recherche dans le titre/description
- `category` : Filtrer par catégorie (ID)
- `difficulty` : Filtrer par difficulté
- `sort` : Trier par (`created_at`, `title`, `average_rating`, `enrollment_count`, `price`)
- `order` : Ordre de tri (`ASC` ou `DESC`, défaut: `DESC`)

**Exemple de requête :**

```
GET /api/courses/favorites?page=1&limit=20&search=javascript&sort=title&order=ASC
```

**Réponse succès (200) :**

```json
{
  "success": true,
  "count": 45,
  "courses": [
    {
      "id": 1,
      "title": "Introduction à JavaScript",
      "slug": "introduction-javascript",
      "description": "...",
      "thumbnail_url": "/uploads/...",
      "is_favorite": true,
      "metrics": {
        "average_rating": 4.5,
        "review_count": 25,
        "enrollment_count": 150
      },
      "category": {
        "id": 1,
        "name": "Développement",
        "color": "#3b82f6"
      },
      "instructor": {
        "id": 5,
        "first_name": "Jean",
        "last_name": "Dupont"
      }
    }
  ],
  "data": {
    "courses": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

**Note :** La réponse inclut à la fois `count` et `courses` au niveau racine (pour compatibilité frontend) et `data` avec pagination complète.

---

### 4. Vérifier le statut favori d'un cours

**Endpoint :** `GET /api/courses/slug/:slug`

**Authentification :** Optionnel (mais nécessaire pour obtenir `is_favorite`)

**Réponse :**

```json
{
  "success": true,
  "data": {
    "course": {
      "id": 1,
      "title": "...",
      "is_favorite": true,  // Seulement si l'utilisateur est connecté
      ...
    }
  }
}
```

---

## 🔐 Authentification

Toutes les routes de favoris nécessitent un token JWT valide dans le header :

```
Authorization: Bearer <token>
```

---

## 📝 Exemples d'utilisation

### JavaScript/Fetch

```javascript
// Ajouter aux favoris
const addToFavorites = async (courseId) => {
  const response = await fetch(`/api/courses/${courseId}/favorite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return response.json();
};

// Retirer des favoris
const removeFromFavorites = async (courseId) => {
  const response = await fetch(`/api/courses/${courseId}/favorite`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return response.json();
};

// Récupérer les favoris
const getFavorites = async (filters = {}) => {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/courses/favorites?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();

  // Format de réponse : { success, count, courses, data }
  return {
    count: data.count || 0,
    courses: data.courses || [],
    pagination: data.data?.pagination,
  };
};
```

### Axios

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: "/api/courses",
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// Ajouter aux favoris
await api.post(`/${courseId}/favorite`);

// Retirer des favoris
await api.delete(`/${courseId}/favorite`);

// Récupérer les favoris
await api.get("/favorites", { params: { page: 1, limit: 20 } });
```

---

## 🎨 Exemples d'implémentation Frontend (React/Next.js)

### Service API pour les favoris

```typescript
// services/favoriteService.ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface FavoriteCourse {
  id: number;
  title: string;
  slug: string;
  description: string;
  thumbnail_url: string;
  is_favorite: boolean;
  metrics: {
    average_rating: number;
    review_count: number;
    enrollment_count: number;
  };
  category: {
    id: number;
    name: string;
    color: string;
  } | null;
  instructor: {
    id: number;
    first_name: string;
    last_name: string;
  } | null;
}

export interface FavoritesResponse {
  success: boolean;
  count: number;
  courses: FavoriteCourse[];
  data: {
    courses: FavoriteCourse[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export const favoriteService = {
  // Récupérer les cours favoris
  async getFavorites(
    filters: {
      page?: number;
      limit?: number;
      search?: string;
      category?: number;
      difficulty?: string;
      sort?: string;
      order?: "ASC" | "DESC";
    } = {}
  ): Promise<FavoritesResponse> {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams();

    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());
    if (filters.search) params.append("search", filters.search);
    if (filters.category)
      params.append("category", filters.category.toString());
    if (filters.difficulty) params.append("difficulty", filters.difficulty);
    if (filters.sort) params.append("sort", filters.sort);
    if (filters.order) params.append("order", filters.order);

    const response = await fetch(
      `${API_BASE_URL}/courses/favorites?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Erreur lors de la récupération des favoris");
    }

    return response.json();
  },

  // Ajouter un cours aux favoris
  async addToFavorites(
    courseId: number
  ): Promise<{ success: boolean; message: string }> {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_BASE_URL}/courses/${courseId}/favorite`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erreur lors de l'ajout aux favoris");
    }

    return response.json();
  },

  // Retirer un cours des favoris
  async removeFromFavorites(
    courseId: number
  ): Promise<{ success: boolean; message: string }> {
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${API_BASE_URL}/courses/${courseId}/favorite`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erreur lors du retrait des favoris");
    }

    return response.json();
  },
};
```

### Hook React personnalisé

```typescript
// hooks/useFavorites.ts
import { useState, useEffect } from "react";
import { favoriteService, FavoriteCourse } from "../services/favoriteService";

interface UseFavoritesOptions {
  page?: number;
  limit?: number;
  search?: string;
  category?: number;
  difficulty?: string;
  sort?: string;
  order?: "ASC" | "DESC";
  autoFetch?: boolean;
}

export const useFavorites = (options: UseFavoritesOptions = {}) => {
  const { autoFetch = true, ...filters } = options;

  const [favorites, setFavorites] = useState<FavoriteCourse[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await favoriteService.getFavorites(filters);

      setFavorites(response.courses);
      setCount(response.count);
      setPagination(response.data?.pagination);
    } catch (err: any) {
      setError(err.message);
      setFavorites([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchFavorites();
    }
  }, [
    filters.page,
    filters.limit,
    filters.search,
    filters.category,
    filters.difficulty,
    filters.sort,
    filters.order,
  ]);

  const addToFavorites = async (courseId: number) => {
    try {
      await favoriteService.addToFavorites(courseId);
      await fetchFavorites(); // Rafraîchir la liste
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const removeFromFavorites = async (courseId: number) => {
    try {
      await favoriteService.removeFromFavorites(courseId);
      await fetchFavorites(); // Rafraîchir la liste
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return {
    favorites,
    count,
    loading,
    error,
    pagination,
    refetch: fetchFavorites,
    addToFavorites,
    removeFromFavorites,
  };
};
```

### Composant React pour afficher les favoris

```tsx
// components/FavoritesPage.tsx
import { useFavorites } from "../hooks/useFavorites";
import { useState } from "react";

export const FavoritesPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { favorites, count, loading, error, pagination, removeFromFavorites } =
    useFavorites({
      page,
      limit: 12,
      search,
    });

  const handleRemoveFavorite = async (courseId: number) => {
    const result = await removeFromFavorites(courseId);
    if (result.success) {
      // Optionnel : afficher une notification de succès
      console.log("Cours retiré des favoris");
    } else {
      // Afficher une erreur
      console.error(result.error);
    }
  };

  if (loading) {
    return <div>Chargement des favoris...</div>;
  }

  if (error) {
    return <div>Erreur : {error}</div>;
  }

  return (
    <div>
      <h1>Mes cours favoris ({count})</h1>

      <input
        type="text"
        placeholder="Rechercher dans les favoris..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {count === 0 ? (
        <div>
          <p>Aucun cours favori pour le moment.</p>
          <p>
            Ajoutez des cours à vos favoris depuis la page de détail d'un cours.
          </p>
        </div>
      ) : (
        <>
          <div className="courses-grid">
            {favorites.map((course) => (
              <div key={course.id} className="course-card">
                <img src={course.thumbnail_url} alt={course.title} />
                <h3>{course.title}</h3>
                <p>{course.description}</p>
                <button onClick={() => handleRemoveFavorite(course.id)}>
                  Retirer des favoris
                </button>
              </div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Précédent
              </button>
              <span>
                Page {page} sur {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
```

### Utilisation dans un composant de détail de cours

```tsx
// components/CourseDetail.tsx
import { useState, useEffect } from "react";
import { favoriteService } from "../services/favoriteService";

export const CourseDetail = ({ courseId }: { courseId: number }) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  // Vérifier le statut favori au chargement
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      try {
        // Récupérer le cours avec son statut favori
        const token = localStorage.getItem("token");
        const response = await fetch(`/api/courses/slug/${courseSlug}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setIsFavorite(data.data?.course?.is_favorite || false);
      } catch (error) {
        console.error(
          "Erreur lors de la vérification du statut favori:",
          error
        );
      }
    };

    checkFavoriteStatus();
  }, [courseId]);

  const toggleFavorite = async () => {
    setLoading(true);
    try {
      if (isFavorite) {
        await favoriteService.removeFromFavorites(courseId);
        setIsFavorite(false);
      } else {
        await favoriteService.addToFavorites(courseId);
        setIsFavorite(true);
      }
    } catch (error: any) {
      console.error("Erreur:", error.message);
      // Afficher une notification d'erreur
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Détail du cours</h1>
      <button onClick={toggleFavorite} disabled={loading}>
        {isFavorite ? "❤️ Retirer des favoris" : "🤍 Ajouter aux favoris"}
      </button>
    </div>
  );
};
```

---

## ⚠️ Notes importantes

1. **Routes corrigées** : Les routes ont été corrigées pour éviter la redondance `/api/courses/courses/...`. Elles sont maintenant :

   - ✅ `/api/courses/:courseId/favorite` (au lieu de `/api/courses/courses/:courseId/favorite`)
   - ✅ `/api/courses/favorites` (au lieu de `/api/courses/courses/favorites`)

2. **Base de données** : Les favoris sont stockés dans la table `course_favorites` avec une contrainte unique sur `(user_id, course_id)`.

3. **Vérification automatique** : Le statut favori (`is_favorite`) est automatiquement inclus dans la réponse de `GET /api/courses/slug/:slug` si l'utilisateur est connecté.

---

## 🔗 Fichiers concernés

- Routes : `src/routes/courseRoutes.js`
- Contrôleur : `src/controllers/courseController.js`
- Base de données : Table `course_favorites` (définie dans `database/courses_schema.sql`)
