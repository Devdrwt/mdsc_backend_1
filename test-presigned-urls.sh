#!/bin/bash
# Script de test rapide des nouvelles routes MinIO

echo "================================================================"
echo "  🧪 TEST - Routes Upload Direct MinIO"
echo "================================================================"
echo ""

# Remplacer par votre token réel
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # À REMPLACER

echo "1️⃣  Test: Génération URL pré-signée"
echo "---------------------------------------------------------------"
curl -X POST https://backendmooc.mdscbenin.org/api/media/upload/presigned-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-video.mp4",
    "fileType": "video/mp4",
    "contentType": "video/mp4"
  }' | jq '.'

echo ""
echo ""
echo "2️⃣  Si la commande ci-dessus retourne:"
echo "     {
       \"success\": true,
       \"data\": {
         \"uploadUrl\": \"https://...\",
         \"objectName\": \"modules/...\",
         \"bucket\": \"videos-mdsc\",
         \"publicUrl\": \"https://...\"
       }
     }"
echo ""
echo "✅ La nouvelle API fonctionne !"
echo ""
echo "================================================================"
