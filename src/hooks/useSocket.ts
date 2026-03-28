"use client";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/lib/shared-types";

type ClementineSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Module-level singleton — survives React re-renders and Strict Mode double-invocations
let socketInstance: ClementineSocket | null = null;

export function getSocket(): ClementineSocket {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return socketInstance;
}

export function connectSocket(): ClementineSocket {
  const socket = getSocket();
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  if (socketInstance?.connected) {
    socketInstance.disconnect();
  }
}
