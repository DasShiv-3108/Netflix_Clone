
FROM node:20-alpine as builder 

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY . .

FROM gcr.io/distroless/nodejs20

WORKDIR /app

COPY --from=builder /app /app

CMD ["server.js"]
