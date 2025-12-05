# Backend Dockerfile (Node + TypeScript)
# Internal app port stays 4000; docker-compose maps host 4001 -> container 4000

FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (includes dev deps for TypeScript build)
COPY backend/package*.json ./
RUN npm ci

# Copy source and build to dist/
COPY backend/ ./
RUN npm run build

# Production image with only runtime deps + built code
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy compiled app
COPY --from=builder /app/dist ./dist

EXPOSE 4000
ENV PORT=4000
CMD ["node", "dist/index.js"]
