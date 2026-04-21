FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG API_URL=https://api.production.com/api
ARG EVENTS_API_URL=https://events.production.com
ARG CHATBOT_URL=https://chatbot.production.com
ARG KEYCLOAK_URL=https://keycloak.production.com
ARG JITSI_DOMAIN=meet.production.com
ARG JITSI_SCRIPT_URL=https://meet.production.com/external_api.js

RUN sed -i "s|https://api.production.com/api|${API_URL}|g" src/environments/environment.prod.ts && \
    sed -i "s|https://events.production.com|${EVENTS_API_URL}|g" src/environments/environment.prod.ts && \
    sed -i "s|https://chatbot.production.com|${CHATBOT_URL}|g" src/environments/environment.prod.ts && \
    sed -i "s|https://keycloak.production.com|${KEYCLOAK_URL}|g" src/environments/environment.prod.ts && \
    sed -i "s|meet.production.com|${JITSI_DOMAIN}|g" src/environments/environment.prod.ts && \
    sed -i "s|https://meet.production.com/external_api.js|${JITSI_SCRIPT_URL}|g" src/environments/environment.prod.ts

RUN npm run build -- --configuration production

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
