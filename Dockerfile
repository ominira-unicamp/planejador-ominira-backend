FROM node:25-alpine AS builder

ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/package.json
COPY packages/api-core/package.json packages/api-core/package.json
COPY packages/data/package.json packages/data/package.json
COPY packages/app/package.json packages/app/package.json
COPY packages/injection/package.json packages/injection/package.json

RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build

FROM builder AS runtime

RUN npm prune --omit=dev --ignore-scripts

FROM runtime AS data

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@pomi/data"]

FROM runtime AS app

EXPOSE 3001
CMD ["npm", "run", "start", "--workspace", "@pomi/app"]

FROM builder AS migrate

CMD ["npm", "run", "prisma:deploy"]
