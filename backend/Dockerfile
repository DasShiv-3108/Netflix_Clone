
FROM node:20-alpine3.23 AS builder 

WORKDIR /app

RUN apk update && apk upgrade zlib

COPY package*.json ./

RUN npm install --only=production

COPY . .

FROM gcr.io/distroless/nodejs20-debian13:latest

WORKDIR /app

COPY --from=builder /app /app

CMD ["server.js"]
