# TicketHub Web UI

React 19 + Vite single-page app for the TicketHub microservices.

| Screen | Calls |
|---|---|
| **Events**: cards with live availability, booking form (with a "simulate payment failure" demo switch) and the saga steps of the result | `GET /events`, `POST /bookings` |
| **My bookings**: bookings by email; expand one for event details, refs, saga log, and cancel / retry cancel (with a "simulate refund failure" demo switch) | `GET /bookings?customerEmail=`, `GET /bookings/:id/details`, `GET /bookings/:id/saga`, `POST /bookings/:id/cancel` |
| **Create event** | `POST /events` |
| Header: health dots for both services (the tooltip shows which pod answered) | `GET /health/ready` |

## How it connects to the services

The browser calls only its own origin:

| Browser path | Forwarded to |
|---|---|
| `/event-api/*` | Event Service (`EVENT_SERVICE_URL`, default `http://event-service:8081`) |
| `/booking-api/*` | Booking Service (`BOOKING_SERVICE_URL`, default `http://booking-service:8082`) |

In Kubernetes, nginx does the forwarding ([nginx/default.conf.template](nginx/default.conf.template)). The URLs come from the `frontend-config` ConfigMap and resolve through cluster DNS. In development, the Vite dev server does it ([vite.config.js](vite.config.js)). Because everything is same-origin, the services need no CORS configuration.

## Run locally (dev server)

Start the services (with `docker compose`, or the minikube tunnels), then:

```bash
npm install
npm run dev                       # services on localhost:8081 / 8082
# or point at other URLs, e.g. the minikube tunnels:
EVENT_URL=http://127.0.0.1:56614 BOOKING_URL=http://127.0.0.1:56615 npm run dev
```

PowerShell: `$env:EVENT_URL="http://127.0.0.1:56614"; $env:BOOKING_URL="http://127.0.0.1:56615"; npm run dev`

Open http://localhost:5173.

## Deploy to minikube

`deploy-minikube.sh` / `deploy-minikube.ps1` in the repository root build `tickethub/frontend:1.0.0` and apply `k8s/frontend.yaml`. That manifest has a ConfigMap, a Deployment with 2 replicas and probes on `/healthz`, and a NodePort Service on 30080. To deploy it alone:

```bash
eval $(minikube docker-env)       # PowerShell: & minikube -p minikube docker-env --shell powershell | Invoke-Expression
docker build -t tickethub/frontend:1.0.0 .
kubectl apply -f k8s/
minikube service frontend -n tickethub --url
```
