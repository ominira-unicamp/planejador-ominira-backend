# Stage 1: Builder
FROM node:25-alpine AS builder

# Provide placeholder DATABASE_URL for prisma as it needs it to generate
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build

# Stage 2: Production
FROM node:25-alpine

WORKDIR /usr/app

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/prisma.config.ts ./

RUN npm ci --omit=dev

CMD ["sh", "-c", "npm run prisma:deploy && npm start"]
