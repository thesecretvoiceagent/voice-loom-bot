# BeyondCode web app (Vite SPA + server.js password gate)
# Deploy as a separate Railway service from repo root (not /orchestrator).

FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY postcss.config.js tailwind.config.ts components.json ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY server.js ./
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "server.js"]
