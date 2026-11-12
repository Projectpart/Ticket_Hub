# TicketHub – Event Ticket Booking System

TicketHub is an event ticket booking system built as microservices (SEZG583 Scalable Services assignment).
This repository is the **umbrella**: it holds the architecture overview, the Postman collection and the
minikube deployment scripts. Each microservice lives in its **own repository** and can be developed,
tested and deployed independently:

| Service | Repository | Port / NodePort | Database |
|---|---|---|---|
| Event Service | https://github.com/Projectpart/tickethub-event-service | 8081 / 30081 | `event_db` (PostgreSQL 16) |
| Booking Service | https://github.com/Projectpart/tickethub-booking-service | 8082 / 30082 | `booking_db` (PostgreSQL 16) |
| Web UI (React) | [`frontend/`](frontend/) in this repo | 8080 / 30080 | – |

## Architecture

```
                 ┌──────────────────────────── minikube, namespace "tickethub" ───────────────────────────┐
  Client /       │                                                                                         │
  Postman ──────►│  booking-service (2–5 pods, HPA)  ── REST/JSON ──►  event-service (2–5 pods, HPA)      │
                 │   • Saga orchestrator              http://event-service:8081  • inventory, reservations │
                 │   • simulated Payment/Notification                                                       │
                 │          │                                              │                                │
                 │          ▼                                              ▼                                │
                 │   booking-db (PostgreSQL, PVC)                  event-db (PostgreSQL, PVC)              │
                 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Database per service:** no shared tables and no cross-database foreign keys. `bookings.event_id` is just a reference.
- **Communication:** synchronous REST/JSON. The Booking Service calls the Event Service through Kubernetes DNS. The client uses a 3 s timeout and up to 3 attempts with exponential back-off (200/400/800 ms). Errors are classified as BUSINESS (4xx, never retried) or UNAVAILABLE (network, timeout, 5xx, retried).
- **Payment and Notification** are conceptual supporting capabilities, simulated inside the Booking Service.

### Business capabilities → services

| Capability | Service | Commands | Queries |
|---|---|---|---|
| Event management | Event | `createEvent` | `listEvents`, `getEvent` |
| Ticket inventory | Event | `reserveTickets`, `releaseTickets` (compensation) | `getAvailability`, `getReservation` |
| Booking management | Booking | `createBooking` (saga), `cancelBooking` (saga) | `getBooking`, `listBookings`, `getBookingDetails` (API composition), `getSagaLog` |
| Payment (simulated) | Booking | `charge`, `refund` | – |
| Notification (simulated) | Booking | `send` | – |

### Distributed transactions: orchestration-based Saga

**CREATE_BOOKING:** T1 create a PENDING booking → T2 reserve tickets (Event Service) → T3 charge payment → T4 CONFIRM (pivot) → T5 notify.

| Failure | HTTP | Compensation |
|---|---|---|
| T2 rejected (sold out / unknown event) | 409 / 404 | none, booking FAILED |
| T2 Event Service unavailable | 503 | defensive ticket release, FAILED |
| T3 payment declined | 402 | COMPENSATING → release tickets → FAILED |
| T4 confirm fails | 500 | refund + release → FAILED |
| compensation itself fails | – | stays COMPENSATING, retried by the recovery job |

**CANCEL_BOOKING (forward recovery):** an atomic compare-and-set CONFIRMED → CANCELLING, then release tickets → refund (idempotent, deterministic `refund_ref`) → CANCELLED → notify. Nothing is rolled back after the release. If a step fails, the API returns 202 and the booking stays CANCELLING. A retry or the 30 s **recovery job** completes only the missing steps, so there is never a double refund or a double restore of inventory.

**Concurrency safety:** the Event Service locks the event row with `SELECT … FOR UPDATE`. Reservations are idempotent on `bookingId`, and database CHECK constraints keep inventory between 0 and `total_tickets`. Every saga step is recorded in `saga_steps` (`GET /api/v1/bookings/:id/saga`).

## Contents of this repository

```
.
├── README.md
├── deploy-minikube.sh                    # Linux/macOS/Git Bash
├── deploy-minikube.ps1                   # Windows PowerShell
├── frontend/                             # React web UI (Vite) + nginx proxy, Dockerfile, k8s/
└── postman/TicketHub.postman_collection.json
```

## Deploy everything to minikube

Clone the umbrella and both service repositories side by side:

```bash
git clone https://github.com/Projectpart/Ticket_Hub.git
cd Ticket_Hub
git clone https://github.com/Projectpart/tickethub-event-service.git   event-service
git clone https://github.com/Projectpart/tickethub-booking-service.git booking-service
```

Then run `./deploy-minikube.sh` (bash) or `powershell -ExecutionPolicy Bypass -File .\deploy-minikube.ps1` (Windows).
The script starts minikube (docker driver, Docker runtime), enables `metrics-server` and `dashboard`, builds both images into minikube's Docker daemon, applies both `k8s/` folders and waits for all four deployments.

Get the service URLs. On Windows with the docker driver, keep each command running in its own terminal:

```bash
minikube service event-service   -n tickethub --url
minikube service booking-service -n tickethub --url
minikube service frontend        -n tickethub --url   # web UI
```

## Web UI

The React frontend is in [`frontend/`](frontend/README.md). It shows events with live availability and lets you book tickets, including a simulated payment failure. It also shows each booking with its event details (API composition) and saga log, and can cancel a booking, including a simulated refund failure followed by a retry.

The browser only talks to the frontend's own origin, so the services need no CORS. Calls under `/event-api/*` and `/booking-api/*` are forwarded to the services: by nginx over cluster DNS in Kubernetes, and by the Vite dev server locally.

## Test with Postman / Newman

```bash
npx newman run postman/TicketHub.postman_collection.json \
  --env-var eventUrl=<event-service URL> --env-var bookingUrl=<booking-service URL>
```

The collection runs five folders in order:
1. Event Service
2. Booking happy path
3. Saga failures and compensation
4. Cancellation saga
5. Cancellation failure and recovery

Every request checks its status code, and the key requests also assert inventory and saga-log contents.

Kubernetes dashboard: `minikube dashboard`, then select the `tickethub` namespace.
