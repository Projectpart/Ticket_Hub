# TicketHub – Demo recording guide

This is a step-by-step script for recording a 10–12 minute demonstration of TicketHub on Windows (PowerShell).
Each part lists the commands to run and what to explain while they run.

---

## Part 0 – Preparation (do not record)

### 0.1 Screen recorder
```powershell
winget install OBSProject.OBSStudio
```
In OBS: **Sources → + → Display Capture**, then **Settings → Output → Recording format: mp4** and **Video → 1920×1080**. Check that the microphone shows in the Audio Mixer.
(Alternative: the Windows 11 Snipping Tool records the screen with **Win + Shift + R**.)

### 0.2 Check that everything is running
```powershell
docker version --format '{{.Server.Version}}'   # Docker Desktop must be running
minikube status                                  # host/kubelet/apiserver: Running
kubectl get pods -n tickethub                    # all pods 1/1 Running
```
If minikube is stopped, run `minikube start`. If nothing is deployed yet, run `.\deploy-minikube.ps1` from the repository root.

### 0.3 Reset the demo data (clean start)
```powershell
# Empty both databases (each service owns its own DB)
kubectl exec -n tickethub deploy/event-db   -- psql -U event_user   -d event_db   -c "TRUNCATE ticket_reservations, events RESTART IDENTITY CASCADE;"
kubectl exec -n tickethub deploy/booking-db -- psql -U booking_user -d booking_db -c "TRUNCATE saga_steps, bookings RESTART IDENTITY CASCADE;"

# Restart the Event Service so it re-seeds the 3 demo events
kubectl rollout restart deployment/event-service -n tickethub
kubectl rollout status  deployment/event-service -n tickethub
```

### 0.4 Open the service tunnels (3 terminals, keep them open)
With the Docker driver on Windows, each `minikube service` command must keep running:
```powershell
minikube service event-service   -n tickethub --url   # terminal A
minikube service booking-service -n tickethub --url   # terminal B
minikube service frontend        -n tickethub --url   # terminal C
```
In the **main demo terminal**, store the printed URLs:
```powershell
$E = "http://127.0.0.1:<event-port>"
$B = "http://127.0.0.1:<booking-port>"
$F = "http://127.0.0.1:<frontend-port>"
cd T:\Ticket_Hub
```

### 0.5 Prepare the windows
- **Terminal:** font size 16–18, cleared with `cls`.
- **Browser tabs:**
  1. GitHub `Projectpart/Ticket_Hub`
  2. `tickethub-event-service`
  3. `tickethub-booking-service`
  4. the Web UI (`$F`)
  5. the dashboard. Run `minikube dashboard` in a 4th terminal, then set the namespace dropdown to **tickethub**.
- **Postman:** **Import → `postman\TicketHub.postman_collection.json`**. On the collection's **Variables** tab, set **Current value** of `eventUrl` = `$E` and `bookingUrl` = `$B`. Save.
- **VS Code:** open the project folder.
- **Do Not Disturb:** turn it on so notifications don't pop up.

Start recording.

---

## Part 1 – Introduction and architecture (≈1 min)

**Show:** the umbrella README on GitHub, at the architecture diagram and tables.

**Explain:**
- TicketHub is an event ticket booking system built as microservices.
- Business capabilities: event management, ticket inventory, booking, payment, notification.
- Two services are implemented:
  - **Event Service:** events and ticket inventory (create events, availability, reserve and release tickets).
  - **Booking Service:** create, cancel and query bookings. It is also the **Saga orchestrator** for the distributed transaction.
- Payment and Notification are simulated inside the Booking Service.
- **Database per service:** each service has its own PostgreSQL, with no shared tables.
- Communication is synchronous **REST/JSON**. Inside Kubernetes the Booking Service calls `http://event-service:8081` through cluster DNS.

Point at the commands and queries table and the saga failure table.

---

## Part 2 – Separate repositories and code (≈1.5 min)

**Show:** both service repositories on GitHub, then VS Code.

**Explain:** each service is its own Git repository, with its own code, tests, Dockerfile and Kubernetes manifests, so it can be developed, tested and deployed independently.

| File | Point to make |
|---|---|
| `event-service/src/eventRepository.js` → `reserveTickets` | One DB transaction. `SELECT … FOR UPDATE` locks the event row, so two customers can never buy the same last ticket. `bookingId` is an idempotency key, so a retry never reserves twice. |
| `booking-service/src/saga/bookingSagaOrchestrator.js` (header comment) | CREATE_BOOKING saga T1–T5: pending booking, reserve, payment, confirm, notify. A payment failure triggers the compensation that releases the tickets. Cancellation uses forward recovery, and a recovery job finishes interrupted sagas. |
| `booking-service/src/clients/eventServiceClient.js` | 3 s timeout and exponential back-off retries, but only for transient errors. Business errors (sold out) are never retried. |

---

## Part 3 – Automated tests (≈1 min)

```powershell
cd T:\Ticket_Hub\booking-service
npm test
```
**Explain:** these unit tests cover every saga path with in-memory fakes: happy path, sold out, payment failure, timeout, failed compensation with recovery, refund failure, and two simultaneous cancels. They check that a refund never happens twice and inventory is restored only once.

Optional (needs the local event DB):
```powershell
cd T:\Ticket_Hub\event-service
docker compose up -d event-db
$env:DB_HOST="localhost"; $env:DB_PORT="5433"; npm run test:integration
```
**Explain:** concurrency tests against real PostgreSQL. 20 simultaneous requests for the last 5 tickets give exactly 5 successes and no overselling.

---

## Part 4 – Docker containers (≈45 s)

**Show:** `booking-service/Dockerfile`. It is based on `node:22-alpine`, runs as a non-root user and has a HEALTHCHECK.

```powershell
cd T:\Ticket_Hub
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
docker images tickethub/*
```
**Explain:** each service has its own image, built directly inside minikube's Docker daemon (no registry needed).

---

## Part 5 – Deploy to minikube (≈1.5 min)

```powershell
cd T:\Ticket_Hub
powershell -ExecutionPolicy Bypass -File .\deploy-minikube.ps1
```
**Explain each step while it runs:**
1. `minikube start`: a local single-node Kubernetes cluster (skipped if already running).
2. `addons enable metrics-server / dashboard`: CPU metrics for the autoscaler, and the web dashboard.
3. `docker-env` + `docker build`: images are built inside the cluster's Docker.
4. `kubectl apply -f …/k8s/` creates, per service:
   - **Namespace** `tickethub`.
   - **Secret**: DB credentials.
   - **PersistentVolumeClaim**: 1 Gi, so data survives pod restarts.
   - **PostgreSQL Deployment + ClusterIP Service**: reachable only inside the cluster.
   - **ConfigMap**: configuration.
   - **Deployment with 2 replicas**: rolling updates with zero downtime, readiness and liveness probes, CPU and memory limits.
   - **NodePort Service**: 30081 / 30082 / 30080.
   - **HorizontalPodAutoscaler**: 2–5 pods at 70 % CPU.
5. `kubectl wait`: waits until every deployment is available.

If everything is already deployed, `kubectl apply` reports `unchanged`. Kubernetes is declarative: it compares the desired state with the cluster and only changes what differs.

---

## Part 6 – Inspect with kubectl (≈1 min)

```powershell
kubectl get all -n tickethub
kubectl get hpa -n tickethub
kubectl top pods -n tickethub
kubectl describe deployment booking-service -n tickethub | Select-String -Pattern "Replicas|Strategy|Image|Liveness|Readiness|Limits|Requests"
```
**Explain:**
- The pods are 2× Event Service, 2× Booking Service, 2× frontend, and one PostgreSQL per service.
- The application Services are NodePorts and the databases are ClusterIP.
- The HPAs read live CPU from metrics-server.
- Each deployment has a RollingUpdate strategy, probes and resource limits.

**Self-healing:**
```powershell
kubectl delete pod -n tickethub -l app=event-service --wait=false
kubectl get pods -n tickethub -l app=event-service -w
```
**Explain:** the desired state is 2 replicas, so Kubernetes immediately creates replacement pods. Press **Ctrl+C** once they are `1/1 Running`.

---

## Part 7 – Kubernetes dashboard (≈1.5 min)

Namespace: **tickethub**.

| Screen | Point out |
|---|---|
| Workloads (overview) | Everything green, plus the CPU and memory graphs |
| Deployments | Pods 2/2 and 1/1, images `tickethub/*:1.0.0` |
| Pods → a `booking-service-…` pod | Status, restarts, labels, probes. Then **Logs** (≡ icon): JSON lines, each with the pod name |
| Services | NodePorts 30081/30082/30080 vs. ClusterIP for the databases |
| Config Maps / Secrets | Configuration kept separate from the code |
| Persistent Volume Claims | 1 Gi per database |
| Horizontal Pod Autoscalers | min 2, max 5, target 70 % CPU |

---

## Part 8 – API calls with Postman (≈2.5 min)

Postman → **TicketHub collection → Run → Run TicketHub**, then open the key requests:

| Folder | What it shows |
|---|---|
| 1. Event Service | Health, list events, create an event with 5 tickets, get it, availability, and a validation error (400 listing the problems). |
| 2. Booking happy path | Create a booking for 2 tickets → **201 CONFIRMED**. Then get, **details** (API composition: booking plus event data from the Event Service), saga log, availability **3**. |
| 3. Saga failures | Payment failure → **402**, and the saga shows `RELEASE_TICKETS COMPENSATED` (tickets were reserved, payment failed, compensation released them). Availability is still 3. 4 tickets → **409 INSUFFICIENT_TICKETS**. Unknown event → **404**. Bad request → **400**. |
| 4. Cancellation | Cancel → 200 and availability back to **5**. Cancel again → 200 (idempotent). Cancel the FAILED booking → **409**. List bookings by email. |
| 5. Failure and recovery | Cancel with `simulateRefundFailure` → **202 REFUND_PENDING**, booking **CANCELLING**. Tickets are already released, so nothing is rolled back; only the missing step is retried. Retry → **200 CANCELLED** with a refund ref. The saga log shows `REFUND_PAYMENT FAILED` then `SUCCESS`. A third cancel issues no second refund. |

End on the runner summary (all tests passed). The same run from the terminal:
```powershell
npx newman run postman\TicketHub.postman_collection.json --env-var eventUrl=$E --env-var bookingUrl=$B
```

---

## Part 9 – Web UI (≈1.5 min)

Open `$F`.
1. **Header:** live health dots for both services. Hovering shows which pod answered (load balancing).
2. **Events → Book tickets:** name, email, 2 tickets → CONFIRMED, with the saga timeline all SUCCESS.
3. Book again with **"simulate payment failure"** ticked → **402**, and the timeline shows `RELEASE TICKETS – COMPENSATED`. Availability is unchanged.
4. **My bookings:** open a confirmed booking. Show the event details (API composition), payment ref and saga log.
5. Tick **"simulate refund failure"** → **Cancel booking** → **202**, CANCELLING. Then **Retry cancellation** → **200 CANCELLED**, and the refund ref appears.

**Explain:** the browser talks only to the frontend. nginx forwards `/event-api` and `/booking-api` to the services through Kubernetes DNS, so the services need no CORS.

---

## Part 10 – Resilience: Event Service outage (≈1 min)

```powershell
kubectl scale deployment event-service -n tickethub --replicas=0
```
After about 5 s:
```powershell
Invoke-RestMethod "$B/health/ready"
$id = (Invoke-RestMethod "$B/api/v1/bookings")[0].id
Invoke-RestMethod "$B/api/v1/bookings/$id/details" | Select-Object id,status,event,warning
```
**Explain:** the Booking Service stays healthy, because readiness checks only its own database, so the outage does not cascade. The details endpoint degrades gracefully, returning `event: null` and a warning.

Try a booking during the outage:
```powershell
curl.exe -s -X POST "$B/api/v1/bookings" -H "Content-Type: application/json" -d '{\"eventId\":2,\"customerName\":\"Outage\",\"customerEmail\":\"outage@demo.com\",\"quantity\":1}'
```
**Explain:** the result is **503 EVENT_SERVICE_UNAVAILABLE**. The reservation outcome is unknown, so the saga tries a defensive release. That fails too, and the booking stays **COMPENSATING**.

Restore the Event Service:
```powershell
kubectl scale deployment event-service -n tickethub --replicas=2
kubectl rollout status deployment/event-service -n tickethub
```
Wait about 30 s for the recovery job, then show the outage booking's saga log:
```powershell
$o = curl.exe -s "$B/api/v1/bookings?customerEmail=outage@demo.com" | ConvertFrom-Json
(Invoke-RestMethod "$B/api/v1/bookings/$($o[0].id)/saga").steps | Format-Table sagaType,step,status
```
**Explain:** the log reads `RESERVE_TICKETS FAILED` → `RELEASE_TICKETS COMPENSATION_FAILED` → `RECOVERY_STARTED` → `RELEASE_TICKETS COMPENSATED` → `MARK_FAILED`. After the outage, the background recovery job completed the compensation automatically.

---

## Part 11 – Concurrency under load (≈45 s)

In **Git Bash**:
```bash
cd /t/Ticket_Hub/booking-service
bash scripts/concurrent-booking-demo.sh http://127.0.0.1:<event-port> http://127.0.0.1:<booking-port>
```
**Explain:** the script creates an event with 5 tickets and fires 20 bookings at once. Exactly 5 succeed (201), 15 get 409, and availability ends at 0, never negative. The row lock prevents overselling.

---

## Part 12 – Logs and saga trace (≈45 s)

```powershell
kubectl logs -n tickethub -l app=booking-service --prefix --tail=40 | Select-String "SAGA|request"
```
**Explain:**
- Every request is logged as one JSON line with the pod name, and both booking pods appear (load balancing).
- The SAGA lines trace each step of the distributed transaction.
- The same steps are stored in `saga_steps` and served by `/bookings/{id}/saga`.

---

## Part 13 – Wrap-up (≈30 s)

**Show:** the three GitHub repositories.

**Summary:**
- Two independently deployable microservices, each with its own database and repository, communicating over REST.
- Distributed transactions handled by an orchestration-based saga with compensation and recovery.
- Each service runs in its own container, deployed on minikube with replicas, probes, autoscaling and persistent storage, and inspected through the dashboard.

Stop recording.

---

## Tips
- Rehearse once without recording, then repeat step 0.3 before the real take.
- If a tunnel window closes, its URL changes. Re-run that `minikube service … --url` command and update `$E`, `$B`, `$F` and the Postman variables.
- At 1080p, OBS's default settings give about 50–100 MB per 10 minutes.
- Take document screenshots (Win + Shift + S) while recording, so they match the video.
