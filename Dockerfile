FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL=https://api-reforma.noxumlab.com
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/server.js ./
COPY --from=build /app/server ./server
COPY --from=build /app/scripts/diagnose-product-import.mjs ./scripts/diagnose-product-import.mjs
COPY --from=build /app/src/utils/documentAnalysis.js ./src/utils/documentAnalysis.js

ENV NODE_ENV=production

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3001}/api/health || exit 1

CMD ["npm", "start"]
