# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# If you transpile (TypeScript), build now:
# RUN npm run build
# For pure JS apps, skip build.

# ---- runtime stage ----
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev
# Copy app (or built dist if you compile TS)
COPY --from=build /app ./

# Run as non-root user for safety
RUN addgroup -S app && adduser -S app -G app
USER app

# Your server must listen on PORT (default 3000)
ENV PORT=3000
EXPOSE 3000

# Optional healthcheck (adjust path)
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["npm","run","start"]
