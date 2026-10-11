FROM node:24.21.0-bookworm-slim
RUN npm install --global pnpm@12.11.2
WORKDIR /app
COPY --chown=node:node . .
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=development
USER node
CMD ["pnpm","--filter","@gfos/api","start"]

