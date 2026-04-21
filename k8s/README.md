# Kubernetes quickstart (k3s)

Cette base applique tes choix:
- Ingress: oui
- Autoscaling: oui (min 1, max 3)
- Demarrage simple: 1 replica par service
- Auto-reparation: oui (Deployments + probes)
- Infra via Helm: postgres, kafka, keycloak, jitsi
- Observabilite: Prometheus + Grafana + Loki

## 1) Build images

Exemple:

```bash
# Frontend
docker build -t ghcr.io/your-org/healthapp-frontend:latest ./frontend

# FHIR
docker build -t ghcr.io/your-org/healthapp-fhir:latest ./backend/fhir

# Events
docker build -t ghcr.io/your-org/healthapp-events:latest ./backend/events

# Chat-bot
docker build -t ghcr.io/your-org/healthapp-chat-bot:latest ./backend/chat-bot
```

Push ensuite vers ton registry.

Alternative avec scripts fournis:

```bash
./k8s/scripts/build-all-images.sh
./k8s/scripts/push-all-images-local-registry.sh
```

Par defaut, le script push utilise `localhost:5001`.

## 2) Installer k3s (serveur)

```bash
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes
```

## 3) Installer ingress-nginx (si absent)

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller
```

## 4) Installer Helm infra + monitoring

```bash
./k8s/scripts/install-helm-infra.sh
```

## 5) Appliquer les apps

1. Copier `k8s/base/app-secrets.example.yaml` vers un vrai secret:

```bash
cp k8s/base/app-secrets.example.yaml k8s/base/app-secrets.yaml
# Editer les mots de passe et URLs
kubectl apply -f k8s/base/app-secrets.yaml
```

2. Appliquer le socle:

```bash
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/app-configmap.yaml
kubectl apply -f k8s/base/deployments.yaml
kubectl apply -f k8s/base/services.yaml
kubectl apply -f k8s/base/hpa.yaml
kubectl apply -f k8s/base/ingress.yaml
```

## 6) Verification

```bash
kubectl get pods -n healthapp
kubectl get hpa -n healthapp
kubectl get ingress -n healthapp
kubectl describe pod -n healthapp <pod-name>
```

## 7) Auto-reparation (ce qui est deja fait)

- Deployments: recreent automatiquement les pods qui crashent.
- Liveness probe: si l'app ne repond plus, kubelet redemarre le conteneur.
- Readiness probe: retire un pod du trafic s'il n'est pas pret.

## 8) Notes debutant

- HA reelle (resilience node): ajouter au moins 2 replicas + plusieurs nodes.
- Avec 1 replica, un crash est auto-repare, mais il peut y avoir une courte indisponibilite.
- HPA scale seulement si `metrics-server` fonctionne (k3s l'inclut generalement).
