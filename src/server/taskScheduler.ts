import type { Server as IOServer, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../lib/shared-types";

export interface Worker {
  id: string;
  socketId: string;
  lat: number;
  lon: number;
  carbonIntensity: number;
  activeTasks: number;
}

export interface Task {
  id: string;
  payload: unknown;
}

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;
type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

const DEFAULT_CARBON_INTENSITY = 250;

export async function fetchCarbonIntensity(lat: number, lon: number): Promise<number> {
  const token = process.env.ELECTRICITY_MAPS_TOKEN;
  if (!token) return DEFAULT_CARBON_INTENSITY;

  try {
    const response = await fetch(
      `https://api.electricitymap.org/v3/carbon-intensity/latest?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
      {
        headers: {
          "auth-token": token,
        },
      }
    );

    if (!response.ok) {
      return DEFAULT_CARBON_INTENSITY;
    }

    const data: unknown = await response.json();
    const carbonIntensity =
      typeof data === "object" &&
      data !== null &&
      "carbonIntensity" in data &&
      typeof data.carbonIntensity === "number"
        ? data.carbonIntensity
        : undefined;

    return typeof carbonIntensity === "number" ? carbonIntensity : DEFAULT_CARBON_INTENSITY;
  } catch {
    return DEFAULT_CARBON_INTENSITY;
  }
}

export async function handleWorkerJoin(args: {
  io: IO;
  socket: Sock;
  sessionCode: string;
  state: Map<string, Worker>;
  workerId: string;
  lat: number;
  lon: number;
}): Promise<Worker> {
  const carbonIntensity = await fetchCarbonIntensity(args.lat, args.lon);
  const worker: Worker = {
    id: args.workerId,
    socketId: args.socket.id,
    lat: args.lat,
    lon: args.lon,
    carbonIntensity,
    activeTasks: 0,
  };

  args.state.set(args.socket.id, worker);
  return worker;
}

export function scheduleTasks(
  pendingTasks: Task[],
  availableWorkers: Worker[]
): Array<{ task: Task; worker: Worker; suitabilityScore: number }> {
  if (pendingTasks.length === 0 || availableWorkers.length === 0) {
    return [];
  }

  const queuePressure = pendingTasks.length / availableWorkers.length;
  const queuePressureWeight = Math.min(queuePressure / 10, 1);
  const maxCarbonIntensity = Math.max(
    1,
    ...availableWorkers.map((worker) => worker.carbonIntensity)
  );
  const maxActiveTasks = Math.max(
    1,
    ...availableWorkers.map((worker) => worker.activeTasks)
  );

  const scoredWorkers = availableWorkers
    .map((worker) => {
      const carbonScore = 1 - worker.carbonIntensity / maxCarbonIntensity;
      const loadScore = 1 - worker.activeTasks / maxActiveTasks;
      const suitabilityScore =
        carbonScore * (1 - queuePressureWeight) +
        loadScore * queuePressureWeight;

      return {
        ...worker,
        suitabilityScore,
      };
    })
    .sort((a, b) => b.suitabilityScore - a.suitabilityScore);

  const workingCopy = scoredWorkers.map((worker) => ({ ...worker }));
  const scheduledWorkerIds = new Set<string>();
  const assignments: Array<{ task: Task; worker: Worker; suitabilityScore: number }> = [];

  for (const task of pendingTasks) {
    const candidate = workingCopy.find((worker) => !scheduledWorkerIds.has(worker.id));
    if (!candidate) {
      break;
    }

    assignments.push({
      task,
      worker: {
        id: candidate.id,
        socketId: candidate.socketId,
        lat: candidate.lat,
        lon: candidate.lon,
        carbonIntensity: candidate.carbonIntensity,
        activeTasks: candidate.activeTasks,
      },
      suitabilityScore: candidate.suitabilityScore,
    });

    candidate.activeTasks += 1;
    scheduledWorkerIds.add(candidate.id);
  }

  return assignments;
}
