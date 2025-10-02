FROM node:slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

RUN npm ci --omit=dev

RUN addgroup --system appuser && adduser --system --group appuser
USER appuser

CMD ["npm", "run", "start"]
