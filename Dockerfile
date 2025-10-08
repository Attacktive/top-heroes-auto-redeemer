FROM node:slim

ARG BUILD_TIME
ARG GIT_TAG

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

RUN npm ci --omit=dev

RUN addgroup --system appuser && adduser --system --group appuser
USER appuser

ENV BUILD_TIME=${BUILD_TIME}
ENV GIT_TAG=${GIT_TAG}

CMD ["npm", "run", "start"]
