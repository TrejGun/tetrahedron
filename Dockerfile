# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json tsconfig.build.json .swcrc ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM gcr.io/distroless/nodejs24-debian13:nonroot
WORKDIR /app
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA
COPY --from=build --chown=nonroot:nonroot /app/dist ./dist
COPY --from=build --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=build --chown=nonroot:nonroot /app/package.json ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER nonroot
CMD ["dist/main.js"]
