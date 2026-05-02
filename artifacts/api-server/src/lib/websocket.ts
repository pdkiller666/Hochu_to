import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { verifyAccessToken } from "./auth-token.js";
import { logger } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WsEvent = "NEW_MESSAGE" | "NEW_NOTIFICATION";

interface AuthenticatedSocket extends WebSocket {
  userId?: number;
  isAlive: boolean;
}

// ─── In-memory registry ───────────────────────────────────────────────────────
// userId → Set of sockets (one user can have multiple tabs open)
// TODO: Replace Map with Redis Pub/Sub for horizontal scaling

const clients = new Map<number, Set<AuthenticatedSocket>>();

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Heartbeat: ping every 30s, terminate sockets that don't respond
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((raw) => {
      const socket = raw as AuthenticatedSocket;
      if (!socket.isAlive) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeatInterval));

  wss.on("connection", (raw: WebSocket) => {
    const socket = raw as AuthenticatedSocket;
    socket.isAlive = true;

    // Auth timeout: client must send { type: "auth", token: "..." } within 5s
    const authTimeout = setTimeout(() => {
      logger.warn("WS: auth timeout — closing socket");
      socket.close(1008, "Auth timeout");
    }, 5_000);

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (data) => {
      let msg: unknown;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (
        msg !== null &&
        typeof msg === "object" &&
        (msg as Record<string, unknown>).type === "auth" &&
        typeof (msg as Record<string, unknown>).token === "string"
      ) {
        const token = (msg as Record<string, unknown>).token as string;
        const payload = verifyAccessToken(token);

        if (!payload) {
          clearTimeout(authTimeout);
          socket.close(1008, "Invalid token");
          return;
        }

        clearTimeout(authTimeout);
        socket.userId = payload.userId;

        if (!clients.has(payload.userId)) {
          clients.set(payload.userId, new Set());
        }
        clients.get(payload.userId)!.add(socket);

        socket.send(JSON.stringify({ type: "authenticated", userId: payload.userId }));
        logger.info({ userId: payload.userId }, "WS: client authenticated");
      }
    });

    socket.on("close", () => {
      if (socket.userId != null) {
        const set = clients.get(socket.userId);
        if (set) {
          set.delete(socket);
          if (set.size === 0) clients.delete(socket.userId);
        }
      }
      clearTimeout(authTimeout);
    });

    socket.on("error", (err) => {
      logger.warn({ err }, "WS: socket error");
    });
  });

  logger.info("WS: WebSocket server initialized at /ws");
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

export function broadcastToUser(userId: number, event: WsEvent, payload: unknown): void {
  const sockets = clients.get(userId);
  if (!sockets || sockets.size === 0) return;

  const message = JSON.stringify({ type: event, payload });
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  }
}
