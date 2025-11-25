# Dépannage FedaPay - Le système ne se déclenche pas

## 🔍 Diagnostic du Problème

### Problème Identifié

Les clés FedaPay dans la base de données semblent **incomplètes** (35 caractères au lieu de 100+ caractères requis).

### Vérification

```sql
-- Vérifier la longueur des clés
SELECT 
  id, 
  provider_name, 
  LENGTH(public_key) as public_key_length, 
  LENGTH(secret_key) as secret_key_length,
  LEFT(public_key, 30) as public_key_start,
  LEFT(secret_key, 30) as secret_key_start
FROM payment_providers 
WHERE provider_name = 'fedapay';
```

**Résultat attendu :**
- `public_key_length` : **100+ caractères** (format: `pk_sandbox_...` ou `pk_live_...`)
- `secret_key_length` : **100+ caractères** (format: `sk_sandbox_...` ou `sk_live_...`)

**Si les clés font moins de 50 caractères**, elles sont incomplètes et doivent être reconfigurées.

## ✅ Solutions

### Solution 1 : Reconfigurer FedaPay dans l'Interface Admin

1. **Accéder à l'interface admin** : `/dashboard/admin/settings` ou `/dashboard/admin/payment-providers`
2. **Trouver la configuration FedaPay**
3. **⚠️ IMPORTANT : Copier les clés COMPLÈTES** depuis votre compte FedaPay :
   - **Clé publique** : Doit commencer par `pk_sandbox_` ou `pk_live_` et faire **100+ caractères** (pas seulement 30-35 caractères !)
   - **Clé secrète** : Doit commencer par `sk_sandbox_` ou `sk_live_` et faire **100+ caractères** (pas seulement 30-35 caractères !)
   
   **Exemple de clé complète :**
   ```
   pk_live_abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890
   ```
   (Les vraies clés sont encore plus longues, généralement 100-200 caractères)
   
4. **Vérifier la longueur** : Avant de sauvegarder, comptez les caractères. Si c'est moins de 50 caractères, la clé est incomplète.
5. **Sauvegarder** la configuration
6. **Vérifier les logs** : Après sauvegarde, vérifiez les logs du serveur pour confirmer que les clés ont été enregistrées correctement

### Solution 2 : Vérifier les Variables d'Environnement

Si la configuration DB échoue, le système utilise les variables d'environnement :

```env
FEDAPAY_PUBLIC_KEY=pk_sandbox_votre_cle_publique_complete_ici
FEDAPAY_SECRET_KEY=sk_sandbox_votre_cle_secrete_complete_ici
FEDAPAY_SANDBOX=true
FEDAPAY_CURRENCY=XOF
```

**Important :** Les clés doivent être **complètes** (100+ caractères).

### Solution 3 : Vérifier que FedaPay est Actif

```sql
-- Vérifier que FedaPay est actif
SELECT id, provider_name, is_active, is_sandbox 
FROM payment_providers 
WHERE provider_name = 'fedapay';
```

Le champ `is_active` doit être `1` (TRUE).

### Solution 4 : Vérifier les Logs du Serveur

Lors d'une tentative de paiement, vérifiez les logs :

```
[Payment][Fedapay] 🚀 Starting Fedapay flow
[Payment][Fedapay] ✅ Configuration chargée depuis la base de données
[Fedapay] ✅ Clés déjà configurées, validation...
[Fedapay] 📋 Configuration actuelle: { publicKeyLength: ..., secretKeyLength: ... }
```

**Si vous voyez :**
- `❌ ATTENTION: Les clés semblent incomplètes!` → Les clés sont trop courtes
- `❌ Clé publique Fedapay incomplète` → Reconfigurer avec les clés complètes
- `❌ Clé secrète Fedapay incomplète` → Reconfigurer avec les clés complètes

## 🔧 Correction Manuelle dans la Base de Données

Si vous avez les clés complètes, vous pouvez les mettre à jour directement :

```sql
-- ATTENTION : Remplacez les valeurs par vos vraies clés complètes
UPDATE payment_providers 
SET 
  public_key = 'pk_sandbox_VOTRE_CLE_PUBLIQUE_COMPLETE_ICI',
  secret_key = 'sk_sandbox_VOTRE_CLE_SECRETE_COMPLETE_ICI',
  is_active = 1,
  is_sandbox = 1
WHERE provider_name = 'fedapay';
```

**Important :**
- Les clés doivent être **complètes** (copiez depuis votre compte FedaPay)
- Ne tronquez pas les clés
- Vérifiez que les clés commencent par `pk_sandbox_` ou `pk_live_` pour la clé publique
- Vérifiez que les clés commencent par `sk_sandbox_` ou `sk_live_` pour la clé secrète

## 🧪 Test de la Configuration

Après avoir reconfiguré, testez :

1. **Vérifier la configuration** :
```sql
SELECT 
  provider_name,
  is_active,
  LENGTH(public_key) as public_key_length,
  LENGTH(secret_key) as secret_key_length,
  LEFT(public_key, 20) as public_key_start,
  LEFT(secret_key, 20) as secret_key_start
FROM payment_providers 
WHERE provider_name = 'fedapay';
```

2. **Tester un paiement** :
   - Accéder à un cours payant
   - Sélectionner FedaPay comme méthode de paiement
   - Vérifier les logs du serveur pour les erreurs

## 📝 Checklist de Vérification

- [ ] Les clés FedaPay font **100+ caractères** chacune
- [ ] La clé publique commence par `pk_sandbox_` ou `pk_live_`
- [ ] La clé secrète commence par `sk_sandbox_` ou `sk_live_`
- [ ] Le provider est **actif** (`is_active = 1`)
- [ ] L'environnement est correct (`is_sandbox = 1` pour sandbox)
- [ ] Le SDK FedaPay est chargé côté frontend (vérifier la console du navigateur)
- [ ] Le bouton `#fedapay-pay-btn` existe dans le DOM

## 🐛 Problèmes Courants

### 1. Clés Tronquées
**Symptôme :** Les clés font moins de 50 caractères
**Solution :** Reconfigurer avec les clés complètes depuis votre compte FedaPay

### 2. SDK Non Chargé
**Symptôme :** `SDK Fedapay non chargé` dans les logs
**Solution :** Vérifier que le script FedaPay est chargé dans `layout.tsx`

### 3. Bouton Non Trouvé
**Symptôme :** `Le bouton #fedapay-pay-btn n'existe pas dans le DOM`
**Solution :** Vérifier que le bouton est rendu dans le composant PaymentForm

### 4. Configuration Non Chargée
**Symptôme :** `Utilisation des variables d'environnement (config DB non disponible)`
**Solution :** Vérifier que la configuration existe dans la DB et que `is_active = 1`

## 📞 Support

Si le problème persiste après avoir vérifié tous les points ci-dessus, contactez le support avec :
- Les logs du serveur
- Les logs de la console du navigateur
- La longueur des clés (sans afficher les clés complètes)
- Le statut de la configuration dans la DB

