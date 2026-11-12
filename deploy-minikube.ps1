# PowerShell equivalent of deploy-minikube.sh (Windows).
# Build both TicketHub images inside minikube and deploy everything.
# Run from the folder that contains event-service\ and booking-service\:
#   powershell -ExecutionPolicy Bypass -File .\deploy-minikube.ps1
$ErrorActionPreference = 'Stop'

function Invoke-Checked([scriptblock]$cmd) {
    & $cmd
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $cmd" }
}

minikube status *> $null
if ($LASTEXITCODE -ne 0) { Invoke-Checked { minikube start --driver=docker --container-runtime=docker --cpus=4 --memory=4096 } }
Invoke-Checked { minikube addons enable metrics-server }
Invoke-Checked { minikube addons enable dashboard }

# Point this shell's docker CLI at minikube's Docker daemon (no registry needed)
$dockerEnv = & minikube -p minikube docker-env --shell powershell
if ($LASTEXITCODE -ne 0) { throw 'minikube docker-env failed (the cluster must use --container-runtime=docker; run "minikube delete" and retry)' }
$dockerEnv | Invoke-Expression

Invoke-Checked { docker build -t tickethub/event-service:1.0.0 .\event-service }
Invoke-Checked { docker build -t tickethub/booking-service:1.0.0 .\booking-service }

Invoke-Checked { kubectl apply -f event-service\k8s\ }
Invoke-Checked { kubectl apply -f booking-service\k8s\ }

Write-Host 'Waiting for pods to become ready...'
Invoke-Checked { kubectl wait --for=condition=available --timeout=300s -n tickethub `
    deployment/event-db deployment/booking-db deployment/event-service deployment/booking-service }

kubectl get all -n tickethub
Write-Host ''
# With the docker driver on Windows, "minikube service --url" keeps a tunnel open in the
# foreground, so open each one in its own terminal window and leave it running.
Write-Host "Event Service URL:   run 'minikube service event-service -n tickethub --url' in a new terminal"
Write-Host "Booking Service URL: run 'minikube service booking-service -n tickethub --url' in a new terminal"
Write-Host 'Dashboard:           minikube dashboard'
