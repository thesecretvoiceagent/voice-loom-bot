# BeyondCode web app (Vite SPA + server.js password gate)
# Deploy as a separate Railway service from repo root (not /orchestrator).

FROM node:22-slim AS builder
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY postcss.config.js tailwind.config.ts components.json ./
COPY public ./public
COPY src ./src
RUN test -n "$VITE_SUPABASE_URL" \
  && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" \
  && test -n "$VITE_SUPABASE_PROJECT_ID" \
  && npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# package.json required: server.js uses ESM import syntax ("type": "module")
COPY package.json ./
COPY server.js ./
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "server.js"]
