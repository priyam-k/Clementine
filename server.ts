import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as IOServer } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "./src/lib/shared-types";
import { setupSocketHandlers } from "./src/server/socket-handlers";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0"; // Listen on all interfaces so workers on LAN can connect
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Request error:", err);
      res.statusCode = 500;
      res.end("Internal server error");
    }
  });

  const io = new IOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  setupSocketHandlers(io, port);

  httpServer.listen(port, () => {
    console.log(`\n🍊 Clementine ready on http://localhost:${port}`);
    console.log(`   Workers can join at http://<your-ip>:${port}/join\n`);
  });
});
