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

ENV NODE_ENV=production

EXPOSE 3001

CMD ["npm", "start"]
