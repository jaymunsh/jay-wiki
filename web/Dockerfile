FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_DEPLOYMENT_ID
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache tzdata \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --chown=10001:10001 --from=build /app/.next/standalone ./
COPY --chown=10001:10001 --from=build /app/.next/static ./.next/static
COPY --chown=10001:10001 --from=build /app/public ./public

USER 10001:10001
EXPOSE 3000
CMD ["node", "server.js"]
