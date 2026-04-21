#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="healthapp"
MON_NAMESPACE="monitoring"

fail() {
  echo "Error: $1" >&2
  exit 1
}

install_helm_if_missing() {
  if command -v helm >/dev/null 2>&1; then
    echo "==> Helm already installed: $(helm version --short 2>/dev/null || echo unknown version)"
    return
  fi

  echo "==> Helm not found. Installing Helm..."

  if command -v brew >/dev/null 2>&1; then
    brew install helm
  else
    if ! command -v curl >/dev/null 2>&1; then
      fail "Helm is missing and curl is not available to install it."
    fi

    local tmp_dir
    tmp_dir="$(mktemp -d)"
    curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 -o "$tmp_dir/get-helm-3"
    chmod +x "$tmp_dir/get-helm-3"

    if [[ -w /usr/local/bin ]]; then
      HELM_INSTALL_DIR=/usr/local/bin "$tmp_dir/get-helm-3"
    else
      mkdir -p "$HOME/.local/bin"
      HELM_INSTALL_DIR="$HOME/.local/bin" "$tmp_dir/get-helm-3"
      export PATH="$HOME/.local/bin:$PATH"
    fi

    rm -rf "$tmp_dir"
  fi

  command -v helm >/dev/null 2>&1 || fail "Helm installation failed."
  echo "==> Helm installed: $(helm version --short 2>/dev/null || echo unknown version)"
}

install_helm_if_missing

kubectl get ns "$NAMESPACE" >/dev/null 2>&1 || kubectl create ns "$NAMESPACE"
kubectl get ns "$MON_NAMESPACE" >/dev/null 2>&1 || kubectl create ns "$MON_NAMESPACE"

helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add jitsi https://jitsi-contrib.github.io/jitsi-helm/
helm repo update

# PostgreSQL (FHIR)
helm upgrade --install postgresql bitnami/postgresql \
  -n "$NAMESPACE" \
  -f k8s/helm/postgresql-values.yaml

# PostgreSQL (events)
helm upgrade --install postgresql-events bitnami/postgresql \
  -n "$NAMESPACE" \
  -f k8s/helm/postgresql-events-values.yaml

# Kafka (simple)
helm upgrade --install kafka bitnami/kafka \
  -n "$NAMESPACE" \
  -f k8s/helm/kafka-values.yaml

# Keycloak
helm upgrade --install keycloak bitnami/keycloak \
  -n "$NAMESPACE" \
  -f k8s/helm/keycloak-values.yaml

# Jitsi (community chart)
helm upgrade --install jitsi jitsi/jitsi-meet \
  -n "$NAMESPACE" \
  -f k8s/helm/jitsi-values.yaml

# Monitoring: Prometheus + Grafana
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n "$MON_NAMESPACE" \
  -f k8s/helm/kube-prometheus-stack-values.yaml

# Logs: Loki
helm upgrade --install loki grafana/loki \
  -n "$MON_NAMESPACE" \
  -f k8s/helm/loki-values.yaml

echo "Infra Helm install complete."
