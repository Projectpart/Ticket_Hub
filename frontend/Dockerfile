# ---- TicketHub Frontend (React, served by nginx) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

# Unprivileged nginx image: runs as a non-root user and listens on 8080
FROM nginxinc/nginx-unprivileged:alpine
ENV EVENT_SERVICE_URL=http://event-service:8081 \
    BOOKING_SERVICE_URL=http://booking-service:8082
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:8080/healthz || exit 1
