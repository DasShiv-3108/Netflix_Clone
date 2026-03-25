
FROM node:20-alpine AS builder 

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY . .

FROM gcr.io/distroless/nodejs20-debian13:debug

WORKDIR /app

COPY --from=builder /app /app

CMD ["server.js"]
