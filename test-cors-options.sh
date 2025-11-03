#!/bin/bash

# Script de test CORS pour la pré-requête OPTIONS
# Usage: ./test-cors-options.sh

echo "🔵 Test de la pré-requête OPTIONS (CORS Preflight)"
echo "=================================================="
echo ""

API_URL="https://mdsc-api.onrender.com"
ORIGIN="https://mdcs.drwintech.com"

echo "📍 API URL: $API_URL"
echo "🌐 Origin: $ORIGIN"
echo ""

echo "🔵 Test OPTIONS pour /api/auth/forgot-password:"
echo "------------------------------------------------"
curl -i -X OPTIONS "$API_URL/api/auth/forgot-password" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -H "Access-Control-Request-Headers: Authorization"

echo ""
echo ""
echo "🔵 Test OPTIONS pour /api/auth/register:"
echo "------------------------------------------------"
curl -i -X OPTIONS "$API_URL/api/auth/register" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"

echo ""
echo ""
echo "✅ Si vous voyez HTTP/2 204 avec les en-têtes CORS, c'est bon !"
echo "❌ Si vous voyez 403 ou 'Not allowed by CORS', il y a un problème."

