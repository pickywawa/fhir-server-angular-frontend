#!/usr/bin/env bash
set -euo pipefail

# Tag and push all local images to the local registry.
# Default registry: localhost:5001

REGISTRY="${REGISTRY:-localhost:5001}"
TAG="${TAG:-latest}"

sanitize_proxy_env() {
  # Docker push may fail if stale proxy variables are exported in shell.
  if [[ "${KEEP_PROXY:-0}" != "1" ]]; then
    unset http_proxy https_proxy no_proxy all_proxy
    unset HTTP_PROXY HTTPS_PROXY NO_PROXY ALL_PROXY
  fi
}

LOCAL_FRONTEND="healthapp-frontend:${TAG}"
LOCAL_FHIR="healthapp-fhir:${TAG}"
LOCAL_EVENTS="healthapp-events:${TAG}"
LOCAL_CHATBOT="healthapp-chat-bot:${TAG}"

REMOTE_FRONTEND="${REGISTRY}/healthapp-frontend:${TAG}"
REMOTE_FHIR="${REGISTRY}/healthapp-fhir:${TAG}"
REMOTE_EVENTS="${REGISTRY}/healthapp-events:${TAG}"
REMOTE_CHATBOT="${REGISTRY}/healthapp-chat-bot:${TAG}"

sanitize_proxy_env

require_image() {
  local image="$1"
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo "Missing local image: $image"
    echo "Run: ./k8s/scripts/build-all-images.sh"
    exit 1
  fi
}

require_image "$LOCAL_FRONTEND"
require_image "$LOCAL_FHIR"
require_image "$LOCAL_EVENTS"
require_image "$LOCAL_CHATBOT"

echo "==> Tagging images for registry $REGISTRY"
docker tag "$LOCAL_FRONTEND" "$REMOTE_FRONTEND"
docker tag "$LOCAL_FHIR" "$REMOTE_FHIR"
docker tag "$LOCAL_EVENTS" "$REMOTE_EVENTS"
docker tag "$LOCAL_CHATBOT" "$REMOTE_CHATBOT"

echo "==> Pushing images"
docker push "$REMOTE_FRONTEND"
docker push "$REMOTE_FHIR"
docker push "$REMOTE_EVENTS"
docker push "$REMOTE_CHATBOT"

echo ""
echo "Push complete."
echo "Pushed images:"
echo "- $REMOTE_FRONTEND"
echo "- $REMOTE_FHIR"
echo "- $REMOTE_EVENTS"
echo "- $REMOTE_CHATBOT"
