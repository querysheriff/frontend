FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM caddy:2-alpine

# Caddy doesn't need low-port capability, container runs on :3000.
RUN setcap -r /usr/bin/caddy

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/build /srv

USER 1000:1000

EXPOSE 3000
