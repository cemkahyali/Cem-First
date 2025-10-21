# syntax=docker/dockerfile:1
FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=7000

EXPOSE 7000

CMD ["node", "src/index.js"]
