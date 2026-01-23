FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Prefer deterministic installs when lockfile exists
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# Prisma client must be generated before Next.js build (build imports server code)
RUN npx prisma generate

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Run migrations at container start (non-interactive), then start Next
CMD ["sh","-lc","npx prisma migrate deploy && npm start"]
