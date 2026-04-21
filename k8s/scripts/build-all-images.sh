#!/usr/bin/env bash
set -euo pipefail

# Build all application images locally.
# Output images:
# - healthapp-frontend:latest
# - healthapp-fhir:latest
# - healthapp-events:latest
# - healthapp-chat-bot:latest

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

sanitize_proxy_env() {
  # Docker build automatically forwards proxy env vars when present.
  # If local proxy DNS is stale, builds fail pulling base images.
  if [[ "${KEEP_PROXY:-0}" != "1" ]]; then
    unset http_proxy https_proxy no_proxy all_proxy
    unset HTTP_PROXY HTTPS_PROXY NO_PROXY ALL_PROXY
  fi
}

FRONTEND_IMAGE="healthapp-frontend:latest"
FHIR_IMAGE="healthapp-fhir:latest"
EVENTS_IMAGE="healthapp-events:latest"
CHATBOT_IMAGE="healthapp-chat-bot:latest"

# Optional build args for frontend production environment injection.
API_URL="${API_URL:-https://api.production.com/api}"
EVENTS_API_URL="${EVENTS_API_URL:-https://events.production.com}"
CHATBOT_URL="${CHATBOT_URL:-https://chatbot.production.com}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://keycloak.production.com}"
JITSI_DOMAIN="${JITSI_DOMAIN:-meet.production.com}"
JITSI_SCRIPT_URL="${JITSI_SCRIPT_URL:-https://meet.production.com/external_api.js}"

sanitize_proxy_env

echo "==> Building frontend image: $FRONTEND_IMAGE"
docker build \
  -t "$FRONTEND_IMAGE" \
  --build-arg API_URL="$API_URL" \
  --build-arg EVENTS_API_URL="$EVENTS_API_URL" \
  --build-arg CHATBOT_URL="$CHATBOT_URL" \
  --build-arg KEYCLOAK_URL="$KEYCLOAK_URL" \
  --build-arg JITSI_DOMAIN="$JITSI_DOMAIN" \
  --build-arg JITSI_SCRIPT_URL="$JITSI_SCRIPT_URL" \
  "$ROOT_DIR/frontend"

echo "==> Building fhir image: $FHIR_IMAGE"
docker build -t "$FHIR_IMAGE" "$ROOT_DIR/backend/fhir"

echo "==> Building events image: $EVENTS_IMAGE"
docker build -t "$EVENTS_IMAGE" "$ROOT_DIR/backend/events"

echo "==> Building chat-bot image: $CHATBOT_IMAGE"
docker build -t "$CHATBOT_IMAGE" "$ROOT_DIR/backend/chat-bot"

echo ""
echo "Build complete."
echo "Built images:"
echo "- $FRONTEND_IMAGE"
echo "- $FHIR_IMAGE"
echo "- $EVENTS_IMAGE"
echo "- $CHATBOT_IMAGE"
