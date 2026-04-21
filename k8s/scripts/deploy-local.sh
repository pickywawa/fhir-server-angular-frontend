#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
NAMESPACE="${NAMESPACE:-healthapp}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-180s}"
PORT_FORWARD_DIR="${ROOT_DIR}/.k8s-port-forward"
APPLY_HPA="${APPLY_HPA:-auto}"

fail() {
  echo "Error: $1" >&2
  exit 1
}

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name"
    exit 1
  fi
}

check_cluster() {
  local current_context

  echo "==> Verifying Kubernetes cluster access"
  current_context="$(kubectl config current-context 2>/dev/null || true)"
  if [[ -z "$current_context" ]]; then
    fail "No kubectl context is configured. Start your local cluster first, then set KUBECONFIG or select a context with 'kubectl config use-context ...'."
  fi

  echo "Using context: $current_context"
  if ! kubectl cluster-info >/dev/null 2>&1; then
    fail "kubectl context '$current_context' is set, but the cluster is unreachable. Verify the cluster is running and that your KUBECONFIG points to the correct server."
  fi

  kubectl get nodes
}

check_infra_dependencies() {
  local missing=()

  echo "==> Checking required infrastructure services"

  kubectl get ns "$NAMESPACE" >/dev/null 2>&1 || missing+=("namespace/${NAMESPACE}")
  kubectl get svc postgresql -n "$NAMESPACE" >/dev/null 2>&1 || missing+=("svc/postgresql")
  kubectl get svc postgresql-events -n "$NAMESPACE" >/dev/null 2>&1 || missing+=("svc/postgresql-events")
  kubectl get svc kafka -n "$NAMESPACE" >/dev/null 2>&1 || missing+=("svc/kafka")

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "Missing dependencies:"
    for item in "${missing[@]}"; do
      echo "- ${item}"
    done
    fail "Infrastructure is not ready. Run './k8s/scripts/install-helm-infra.sh' first, then rerun this script."
  fi
}

should_apply_hpa() {
  case "$APPLY_HPA" in
    1|true|TRUE|yes|YES)
      return 0
      ;;
    0|false|FALSE|no|NO)
      return 1
      ;;
    auto|AUTO|"")
      kubectl get apiservice v1beta1.metrics.k8s.io >/dev/null 2>&1 || \
      kubectl get apiservice v1.metrics.k8s.io >/dev/null 2>&1
      ;;
    *)
      fail "Invalid APPLY_HPA value '${APPLY_HPA}'. Use auto|true|false."
      ;;
  esac
}

apply_resources() {
  echo "==> Applying Kubernetes resources"
  kubectl apply -f "$ROOT_DIR/k8s/base/namespace.yaml"
  kubectl apply -f "$ROOT_DIR/k8s/base/app-configmap.yaml"
  kubectl apply -f "$ROOT_DIR/k8s/base/app-secrets.yaml"
  kubectl apply -f "$ROOT_DIR/k8s/base/services.yaml"
  kubectl apply -f "$ROOT_DIR/k8s/base/deployments.yaml"

  if should_apply_hpa; then
    kubectl apply -f "$ROOT_DIR/k8s/base/hpa.yaml"
  else
    echo "==> Skipping HPA apply (metrics API unavailable or APPLY_HPA=false)"
  fi

  kubectl apply -f "$ROOT_DIR/k8s/base/ingress.yaml"
}

show_debug_state() {
  echo "==> Current pod state"
  kubectl get pods -n "$NAMESPACE" -o wide || true
  echo "==> Recent events"
  kubectl get events -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp | tail -n 20 || true
}

wait_for_rollout() {
  local deployment_name="$1"

  echo "==> Waiting for deployment/${deployment_name}"
  if ! kubectl rollout status "deployment/${deployment_name}" -n "$NAMESPACE" --timeout="$WAIT_TIMEOUT"; then
    show_debug_state
    echo "Rollout failed for deployment/${deployment_name}"
    exit 1
  fi
}

start_port_forward() {
  local name="$1"
  local local_port="$2"
  local service_port="$3"
  local service_name="$4"
  local log_file="$PORT_FORWARD_DIR/${name}.log"
  local pid_file="$PORT_FORWARD_DIR/${name}.pid"

  if [[ -f "$pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$pid_file")"
    if kill -0 "$existing_pid" >/dev/null 2>&1; then
      echo "Port-forward ${name} already running with PID ${existing_pid}"
      return
    fi
    rm -f "$pid_file"
  fi

  echo "==> Starting port-forward ${name} on localhost:${local_port}"
  kubectl port-forward -n "$NAMESPACE" "svc/${service_name}" "${local_port}:${service_port}" >"$log_file" 2>&1 &
  echo $! >"$pid_file"

  sleep 1
  if ! kill -0 "$(cat "$pid_file")" >/dev/null 2>&1; then
    rm -f "$pid_file"
    fail "Port-forward ${name} failed to start. Check ${log_file}."
  fi
}

start_port_forwards() {
  echo "==> Starting local port-forwards"
  mkdir -p "$PORT_FORWARD_DIR"
  start_port_forward frontend 8080 80 frontend
  start_port_forward fhir-api 8081 8081 fhir-api
  start_port_forward events-api 8091 8091 events-api
  start_port_forward chat-bot 8090 8090 chat-bot
}

print_access_info() {
  echo ""
  echo "Deployment complete."
  echo "Local access:"
  echo "- Frontend: http://localhost:8080"
  echo "- FHIR API: http://localhost:8081"
  echo "- Events API: http://localhost:8091"
  echo "- Chat-bot: http://localhost:8090"
  echo ""
  echo "Port-forward logs: $PORT_FORWARD_DIR"
  echo "Running pods:"
  kubectl get pods -n "$NAMESPACE"
}

require_command kubectl

check_cluster
check_infra_dependencies
apply_resources
wait_for_rollout frontend
wait_for_rollout fhir-api
wait_for_rollout events-api
wait_for_rollout chat-bot
start_port_forwards
print_access_info