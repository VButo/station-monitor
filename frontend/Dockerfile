# Frontend Dockerfile (Next.js 15)
# Internal app port stays 3000; docker-compose maps host 3001 -> container 3000

FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy the rest of the app and build
COPY frontend/ ./
RUN npm run build

# Production image
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only
COPY frontend/package*.json ./
RUN npm ci --omit=dev

# Copy build artifacts and needed assets/config
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
ENV PORT=3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
