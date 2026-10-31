# ==========================================
# Stage 1: Build TypeScript artifacts
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps --strict-ssl=false

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ==========================================
# Stage 2: Minimal Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps --strict-ssl=false

COPY --from=builder /app/dist ./dist

# Create uploads directory with non-root node user permissions
RUN mkdir -p uploads && chown -R node:node /app

USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
