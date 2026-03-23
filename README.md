# 🎬 NetStream — Netflix Clone

> A production-style **3-Tier Dockerized** Netflix replica with a full-featured dark UI, REST API, and MongoDB database — all running with a single command.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCKER NETWORK                            │
│                        (netflix-net)                             │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐   ┌────────────┐  │
│  │    TIER  1       │    │    TIER  2        │   │  TIER  3  │  │
│  │                  │    │                   │   │           │  │
│  │   FRONTEND       │───▶│    BACKEND        │──▶│ DATABASE  │  │
│  │                  │    │                   │   │           │  │
│  │  Nginx + Static  │    │  Node.js/Express  │   │  MongoDB  │  │
│  │  HTML / CSS / JS │    │    REST API        │   │  7.0      │  │
│  │                  │    │                   │   │           │  │
│  │  localhost:3000  │    │  localhost:5000   │   │  :27017   │  │
│  └──────────────────┘    └──────────────────┘   └────────────┘  │
│         ▲                        ▲                               │
│   Nginx proxies                  │                               │
│   /api/* → backend:5000          │                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
netflix-clone/
├── 📄 docker-compose.yml          # Orchestrates all 3 tiers
│
├── 🎨 frontend/
│   ├── 🐳 Dockerfile              # Nginx alpine image  ← Dockerfile #1
│   ├── nginx.conf                 # Static serve + API proxy
│   └── public/
│       ├── index.html             # Netflix-style UI
│       ├── css/
│       │   └── style.css          # Full dark theme styling
│       └── js/
│           └── app.js             # All frontend logic
│
├── ⚙️ backend/
│   ├── 🐳 Dockerfile              # Node.js 20 alpine image  ← Dockerfile #2
│   ├── package.json
│   └── server.js                  # Express REST API
│
└── 🗄️ database/
    └── init/
        └── seed.js                # Auto-seeds 12 movies on startup
                                   # (No Dockerfile — uses official mongo:7.0 image directly)
```

> **Total Dockerfiles: 2** — one for frontend, one for backend.
> Database uses a ready-made official image, so no Dockerfile needed for it.

---

## 🐳 docker-compose.yml — Explained

This is the main file that ties all 3 tiers together. Here's what every section does:

```yaml
version: '3.9'
```
Docker Compose file format version. 3.9 supports all modern features like healthchecks and depends_on conditions.

---

```yaml
networks:
  netflix-net:
    driver: bridge
```
Creates a **private internal network** called `netflix-net`.
All 3 containers are connected to it, so they can talk to each other by **container name** (e.g. backend calls `database:27017` instead of an IP). Nothing outside can reach them unless a port is explicitly exposed.

---

```yaml
volumes:
  mongo_data:
```
Creates a **named volume** for MongoDB data. This means even if you stop or delete the container, your movie data is NOT lost. It lives in Docker's managed storage on your machine.

---

### Service 1 — database (Tier 3)

```yaml
  database:
    image: mongo:7.0                        # Uses official MongoDB image — no Dockerfile needed
    container_name: netflix_db              # Fixed name so other containers can refer to it
    restart: unless-stopped                 # Auto-restarts if it crashes, unless you manually stop it
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin     # Root admin username
      MONGO_INITDB_ROOT_PASSWORD: netflix123
      MONGO_INITDB_DATABASE: netflixdb      # Creates this DB on first run
    ports:
      - "27017:27017"                       # host:container — lets you connect via MongoDB Compass
    volumes:
      - mongo_data:/data/db                 # Persist data across restarts
      - ./database/init/seed.js:/docker-entrypoint-initdb.d/seed.js
      # ↑ Mounts seed.js into a special folder that MongoDB runs automatically on first start
    networks:
      - netflix-net                         # Joins the private network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s                         # Check every 10 seconds
      timeout: 5s                           # Fail if no response in 5s
      retries: 5                            # Try 5 times before marking unhealthy
      # ↑ Backend will NOT start until this healthcheck passes
```

---

### Service 2 — backend (Tier 2)

```yaml
  backend:
    build:
      context: ./backend                    # Build from ./backend folder
      dockerfile: Dockerfile                # Using backend/Dockerfile
    container_name: netflix_api
    restart: unless-stopped
    environment:
      PORT: 5000
      MONGO_URI: mongodb://admin:netflix123@database:27017/netflixdb?authSource=admin
      # ↑ "database" here is the container name — Docker resolves it to the right IP automatically
      JWT_SECRET: netflix_super_secret_key_2024
      NODE_ENV: production
    ports:
      - "5000:5000"                         # Expose API to host machine
    depends_on:
      database:
        condition: service_healthy          # Waits for DB healthcheck to pass before starting
    networks:
      - netflix-net
```

---

### Service 3 — frontend (Tier 1)

```yaml
  frontend:
    build:
      context: ./frontend                   # Build from ./frontend folder
      dockerfile: Dockerfile                # Using frontend/Dockerfile
    container_name: netflix_ui
    restart: unless-stopped
    ports:
      - "3000:80"                           # Browser hits localhost:3000 → Nginx port 80 inside container
    depends_on:
      - backend                             # Starts after backend is up
    networks:
      - netflix-net
```

---

## 🐳 Dockerfile #1 — frontend/Dockerfile

```dockerfile
FROM nginx:alpine               # Tiny Nginx base image (~5MB)

COPY public/ /usr/share/nginx/html/   # Copy all HTML/CSS/JS into Nginx's web root
COPY nginx.conf /etc/nginx/conf.d/default.conf  # Our custom Nginx config

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]    # Start Nginx in foreground
```

**What nginx.conf does:**
- Serves static files (HTML, CSS, JS) at `/`
- Proxies any request to `/api/*` → `http://backend:5000/api/` so the frontend never needs to know the backend's IP

---

## 🐳 Dockerfile #2 — backend/Dockerfile

```dockerfile
FROM node:20-alpine             # Lightweight Node.js base (~50MB vs ~900MB full)

WORKDIR /app                    # All commands run from /app inside container

COPY package*.json ./
RUN npm install --production    # Install only production dependencies (no devDeps)

COPY . .                        # Copy all source files

EXPOSE 5000
CMD ["node", "server.js"]       # Start Express server
```

---

## 🚀 Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

```bash
# 1. Enter the project folder
cd netflix-clone

# 2. Build images and start all containers
docker-compose up --build

# 3. Open in browser
http://localhost:3000
```

> ⏳ First run takes ~1-2 minutes to pull images and seed DB. Subsequent runs are instant.

```bash
# Stop everything
docker-compose down

# Stop and wipe all data
docker-compose down -v
```

---

## 🔑 Login

| Field    | Value               |
|----------|---------------------|
| Email    | `demo@netflix.com`  |
| Password | `demo123`           |

Or click **"Browse as Guest"** to skip login.

---

## 📡 API Reference

Base URL: `http://localhost:5000`

| Method | Endpoint                    | Description             |
|--------|-----------------------------|-------------------------|
| GET    | `/api/health`               | Server health check     |
| GET    | `/api/movies`               | Get all movies          |
| GET    | `/api/movies/featured`      | Get featured hero movie |
| GET    | `/api/movies/:id`           | Get movie by ID         |
| GET    | `/api/categories/trending`  | Trending movies         |
| GET    | `/api/categories/popular`   | Popular movies          |
| GET    | `/api/categories/new`       | New arrivals            |
| GET    | `/api/movies?search=dark`   | Search by title         |
| GET    | `/api/movies?type=series`   | Filter by type          |
| GET    | `/api/movies?genre=Drama`   | Filter by genre         |
| POST   | `/api/auth/login`           | Login                   |

---

## 🔧 Troubleshooting

**Port already in use?**
```bash
# Edit docker-compose.yml and change host ports
ports:
  - "3001:80"    # frontend
  - "5001:5000"  # backend
```

**Database not connecting?**
```bash
docker-compose logs database
# Wait for "Waiting for connections" message
```

**Full reset?**
```bash
docker-compose down -v --rmi all
docker-compose up --build
```

---

## 🛠️ Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Frontend | HTML5, CSS3, Vanilla JS |
| Server   | Nginx Alpine            |
| Backend  | Node.js 20, Express 4   |
| Database | MongoDB 7.0             |
| DevOps   | Docker, Docker Compose  |

---

> Built as a 3-tier Docker architecture learning project.
