import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import {createServer} from 'http';

import {initRedis, Redis} from './lib/redis';
import {createSocketServer} from './lib/socket';
import { container } from './container';

/**
 * @file server.js
 * @description Application entry point. Initializes Redis, configures the Express HTTP server,
 * sets up Socket.io namespaces, resolves dependencies via a central DI container, 
 * binds WebSocket handlers, and mounts API routers.
 */

const app = express();
const PORT = 3000;



// ====== INIT FUNCTION ======
const start = async () => {
  try {
    // 1. Pre-middleware Health Check
    // Fast path for load balancers/Kubernetes probes to check if the process is alive.
    app.get('/health', (req, res) => res.json({ok: true}))

    // 2. Initialize Infrastructure Layer
    // Connect to Redis first, as subsequent services (Sockets/Container) depend on it.
    await initRedis();

    // 3. Express setup
    app.use(cookieParser());
    app.use(express.json());
    app.use(cors({
      origin: true, // must match the Origin header sent by the browser (protocol + host + port)
      credentials: true
    }));
    // Serve static files (e.g., user profile pictures) from the 'avatars' directory
    app.use('/avatars', express.static('avatars'));

    // API-specific health check
    app.get('/api/health', (req, res) => res.json({ ok: true }));

    // 4. Server & WebSocket Layer Initialization
    // We wrap the Express app in a native HTTP server so Socket.io can share the same port.
    const httpserver = createServer(app);
    // Initialize Socket.io with distinct namespaces for feature isolation
    const {io, gameNs, friendNs, chatNs} = createSocketServer(httpserver, Redis);

    // 5. Dependency Injection (DI) Container Setup
    // Inject core instances (Socket.io namespaces and Redis) into the central container.
    // This resolves all controllers, services, and repositories asynchronously.
    await container.initialize(io, gameNs, friendNs, chatNs, Redis);

    // 6. WebSocket Event Binding
    // Delegate connection events to their respective socket handlers resolved from the container.
    gameNs.on('connection', socket => container.gameSocketHandler.onConnection(socket));
    friendNs.on('connection', socket => container.friendSocketHandler.onConnection(socket));
    chatNs.on('connection', socket => container.chatSocketHandler.onConnection(socket));

    // 7. REST API Routing
    app.use('/api/auth', container.authRouter);
    app.use('/api/user', container.userRouter);
    app.use('/api/game', container.gameRouter);
    app.use('/api/friendship', container.friendRouter);
    app.use('/api/chat', container.chatRouter);
    app.use('/api/tournament', container.tournamentRouter);

    // 8. Start HTTP & WebSocket Server
    // Binding to '0.0.0.0' allows the server to accept connections from outside its local network 
    // (essential for Docker containers and cloud deployments).
    httpserver.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });

  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
};

start();