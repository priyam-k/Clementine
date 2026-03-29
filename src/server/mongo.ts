import { MongoClient, type Db, type Collection } from "mongodb";
import type { WireJob, WireTask } from "../lib/shared-types";

// ─── MongoDB Atlas client (singleton) ────────────────────────────────────────

let client: MongoClient | null = null;
let db: Db | null = null;
let connecting: Promise<Db | null> | null = null;

const DB_NAME = "clementine";

async function getDb(): Promise<Db | null> {
  if (db) return db;
  if (connecting) return connecting;

  const MONGODB_URI = process.env.MONGODB_URI ?? "";
  if (!MONGODB_URI) {
    console.warn("[mongo] MONGODB_URI not set — logging disabled");
    return null;
  }

  connecting = (async () => {
    try {
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      db = client.db(DB_NAME);
      console.log("[mongo] Connected to MongoDB Atlas");
      return db;
    } catch (err) {
      console.error("[mongo] Connection failed:", err);
      await client?.close().catch(() => {});
      client = null;
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

async function collection(name: string): Promise<Collection | null> {
  const database = await getDb();
  return database ? database.collection(name) : null;
}

// ─── Logging helpers (fire-and-forget, never block the main flow) ────────────

export async function logWorkerEvent(event: {
  type: "connect" | "disconnect" | "join" | "leave";
  workerId?: string;
  workerName: string;
  device: string;
  sessionCode: string;
  socketId: string;
  isHost?: boolean;
}) {
  try {
    const col = await collection("worker_events");
    if (!col) return;
    await col.insertOne({ ...event, timestamp: new Date() });
  } catch (err) {
    console.error("[mongo] logWorkerEvent error:", err);
  }
}

export async function logJobEvent(event: {
  type: "created" | "started" | "completed" | "failed";
  jobId: string;
  title: string;
  jobType: string;
  sessionCode: string;
  taskCount?: number;
  durationMs?: number;
  workerCount?: number;
  result?: Record<string, unknown>;
}) {
  try {
    const col = await collection("job_events");
    if (!col) return;
    await col.insertOne({ ...event, timestamp: new Date() });
  } catch (err) {
    console.error("[mongo] logJobEvent error:", err);
  }
}

export async function logTaskResult(event: {
  taskId: string;
  jobId: string;
  title: string;
  jobType: string;
  sessionCode: string;
  workerId: string;
  workerName: string;
  status: string;
  durationMs: number;
  output?: Record<string, unknown>;
}) {
  try {
    const col = await collection("task_results");
    if (!col) return;
    await col.insertOne({ ...event, timestamp: new Date() });
  } catch (err) {
    console.error("[mongo] logTaskResult error:", err);
  }
}

export async function logSessionEvent(event: {
  type: "created" | "ended";
  sessionCode: string;
  hostName: string;
}) {
  try {
    const col = await collection("session_events");
    if (!col) return;
    await col.insertOne({ ...event, timestamp: new Date() });
  } catch (err) {
    console.error("[mongo] logSessionEvent error:", err);
  }
}

export async function persistJobSnapshot(job: WireJob & { sessionCode: string }) {
  try {
    const col = await collection("jobs");
    if (!col) return;
    await col.updateOne(
      { id: job.id },
      {
        $set: {
          ...job,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAtDate: new Date(job.createdAt),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("[mongo] persistJobSnapshot error:", err);
  }
}

export async function persistTaskSnapshots(tasks: Array<WireTask & { sessionCode: string; jobType: string }>) {
  try {
    const col = await collection("tasks");
    if (!col || tasks.length === 0) return;

    await Promise.all(
      tasks.map((task) =>
        col.updateOne(
          { id: task.id },
          {
            $set: {
              ...task,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        )
      )
    );
  } catch (err) {
    console.error("[mongo] persistTaskSnapshots error:", err);
  }
}

export async function exportSessionData(sessionCode: string) {
  const database = await getDb();
  if (!database) return null;

  const [jobs, tasks, workerEvents, jobEvents, taskResults, sessionEvents] = await Promise.all([
    database.collection("jobs").find({ sessionCode }).sort({ updatedAt: 1 }).toArray(),
    database.collection("tasks").find({ sessionCode }).sort({ updatedAt: 1 }).toArray(),
    database.collection("worker_events").find({ sessionCode }).sort({ timestamp: 1 }).toArray(),
    database.collection("job_events").find({ sessionCode }).sort({ timestamp: 1 }).toArray(),
    database.collection("task_results").find({ sessionCode }).sort({ timestamp: 1 }).toArray(),
    database.collection("session_events").find({ sessionCode }).sort({ timestamp: 1 }).toArray(),
  ]);

  return {
    sessionCode,
    exportedAt: new Date().toISOString(),
    jobs,
    tasks,
    workerEvents,
    jobEvents,
    taskResults,
    sessionEvents,
  };
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
