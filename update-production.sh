#!/bin/bash
# Script de mise à jour complète en production
# À exécuter sur le serveur: bash update-production.sh

set -e

echo "================================================================"
echo "  🚀 MISE À JOUR COMPLÈTE PRODUCTION"
echo "================================================================"
echo ""

BACKEND_PATH="/home/admin/mdsc_backend_1"

# Vérifier qu'on est bien sur le serveur
if [ ! -d "$BACKEND_PATH" ]; then
    echo "❌ ERREUR: Ce script doit être exécuté sur le serveur!"
    echo "   Répertoire $BACKEND_PATH introuvable"
    exit 1
fi

cd $BACKEND_PATH

echo "1️⃣  GIT - Mise à jour du code..."
git fetch origin production
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/production)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "   📥 Mise à jour nécessaire"
    echo "   Local:  $LOCAL"
    echo "   Remote: $REMOTE"
    git reset --hard origin/production
    echo "   ✅ Code mis à jour"
else
    echo "   ✅ Code déjà à jour"
fi
git log -1 --oneline
echo ""

echo "2️⃣  BASE DE DONNÉES - Correction de user_files..."
node database/fix_user_files_table.js
echo ""

echo "3️⃣  DÉPENDANCES - npm install..."
npm install --production
echo "   ✅ Dépendances installées"
echo ""

echo "4️⃣  LOGS - Nettoyage..."
echo "   Rotation des logs..."
sudo journalctl --rotate
echo "   Vidage des anciens logs..."
sudo journalctl --vacuum-time=1s
echo "   ✅ Logs vidés"
echo ""

echo "5️⃣  SERVICE - Redémarrage..."
sudo systemctl restart deploy-backend.service
echo "   ✅ Service redémarré"
echo ""

echo "6️⃣  ATTENTE - Démarrage du service (10 secondes)..."
sleep 10
echo ""

echo "7️⃣  VÉRIFICATION - Statut du service..."
if sudo systemctl is-active --quiet deploy-backend.service; then
    echo "   ✅ Service ACTIF"
else
    echo "   ❌ Service INACTIF!"
    sudo systemctl status deploy-backend.service --no-pager
    exit 1
fi
echo ""

echo "8️⃣  VÉRIFICATION - Port 5000..."
if sudo netstat -tlnp | grep -q ":5000"; then
    echo "   ✅ Port 5000 ouvert"
    sudo netstat -tlnp | grep ":5000"
else
    echo "   ❌ Port 5000 fermé!"
fi
echo ""

echo "9️⃣  LOGS - Dernières lignes..."
sudo journalctl -u deploy-backend.service -n 30 --no-pager
echo ""

echo "================================================================"
echo "  ✅ MISE À JOUR TERMINÉE!"
echo "================================================================"
echo ""
echo "📋 POUR TESTER:"
echo ""
echo "1. Surveiller les logs:"
echo "   sudo journalctl -u deploy-backend.service -f"
echo ""
echo "2. Ou filtrer sur MINIO:"
echo "   sudo journalctl -u deploy-backend.service -f | grep MINIO"
echo ""
echo "3. Uploader une vidéo sur: https://mooc.mdscbenin.org"
echo ""
echo "4. Vous devriez voir:"
echo "   🚀 [MINIO] ========== DÉBUT UPLOAD =========="
echo "   📤 [MINIO] Upload vers: ..."
echo "   ✅ [MINIO] Upload terminé avec succès"
echo "   🏁 [MINIO] ========== FIN UPLOAD =========="
echo ""
echo "================================================================"
