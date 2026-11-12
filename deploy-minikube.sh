#!/usr/bin/env bash
# Build both TicketHub images inside minikube and deploy everything.
# Run from the folder that contains event-service/ and booking-service/.
# Windows users: see deploy-minikube.ps1 (or run this from Git Bash).
set -euo pipefail

minikube status >/dev/null 2>&1 || minikube start --driver=docker --container-runtime=docker --cpus=4 --memory=4096
minikube addons enable metrics-server
minikube addons enable dashboard

# Use minikube's Docker daemon so the images are available to the cluster without a registry
eval "$(minikube docker-env --shell bash)"

docker build -t tickethub/event-service:1.0.0   ./event-service
docker build -t tickethub/booking-service:1.0.0 ./booking-service

kubectl apply -f event-service/k8s/
kubectl apply -f booking-service/k8s/

echo "Waiting for pods to become ready..."
kubectl wait --for=condition=available --timeout=300s -n tickethub \
  deployment/event-db deployment/booking-db deployment/event-service deployment/booking-service

kubectl get all -n tickethub
echo
DRIVER=$(minikube profile list -o json 2>/dev/null | grep -o '"Driver":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*|Darwin*) TUNNEL_NEEDED=$([ "$DRIVER" = "docker" ] && echo yes || echo no) ;;
  *) TUNNEL_NEEDED=no ;;
esac
if [ "$TUNNEL_NEEDED" = "yes" ]; then
  # With the docker driver on Windows/macOS, "minikube service --url" keeps a tunnel open,
  # so run each in its own terminal and leave it running:
  echo "Event Service URL:   run 'minikube service event-service -n tickethub --url' in a separate terminal"
  echo "Booking Service URL: run 'minikube service booking-service -n tickethub --url' in a separate terminal"
else
  echo "Event Service URL:   $(minikube service event-service -n tickethub --url)"
  echo "Booking Service URL: $(minikube service booking-service -n tickethub --url)"
fi
echo "Dashboard:           minikube dashboard"
