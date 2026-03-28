# Clementine

**Distributed local compute orchestration.** Transform idle home devices into a private compute cluster.

---

## Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:3000** — the host dashboard.

Workers join at **http://\<your-local-ip\>:3000/join** on any device on the same network.

---

## How It Works

1. **Host** opens `/host` — a session is created with a unique code (e.g. `CLMT-4829`)
2. **Workers** scan QR or navigate to `/join` and enter the session code
3. Host submits a job via the command input or voice ("Hey Clementine, …")
4. Clementine decomposes the job into subtasks and distributes them to idle workers
5. Workers execute tasks in the browser and report progress in real time
6. Host dashboard shows live worker status, task progress, and final results

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (custom Node + Socket.IO + Next.js) |
| `npm run build` | Production build |
| `npm run start` | Start production server |

---

## Architecture

```
server.ts                    Custom Node.js server (HTTP + Socket.IO + Next.js)

src/
  server/
    types.ts                 Server-side domain types
    store.ts                 In-memory state (sessions, workers, jobs, tasks)
    decomposer.ts            Job → subtask decomposition per jobType
    scheduler.ts             Assigns queued tasks to idle workers
    reducer.ts               Aggregates task outputs into final result
    socket-handlers.ts       All Socket.IO event handling

  hooks/
    useSocket.ts             Socket.IO client singleton
    useHostSession.ts        React hook — host dashboard state
    useWorkerSession.ts      React hook — worker node state + task execution

  lib/
    shared-types.ts          Wire types shared by server and client
    types.ts                 Component prop types (Pass 1)

  app/
    page.tsx                 Landing page
    host/page.tsx            Host dashboard (live-wired)
    join/page.tsx            Worker join page (live-wired)

  components/
    host/                    Dashboard components
    join/                    Worker node components
    layout/                  Sidebar
    ui/                      Badge, ProgressBar
```

---

## Job Types

| Type | Description | Status |
|------|-------------|--------|
| `mock-compute` | Synthetic distributed workload | ✅ Implemented |
| `llm-analysis` | LLM/semantic analysis pipeline | ✅ Decomposition + mock execution |
| `batch-inference` | Batch model inference sharding | ✅ Decomposition + mock execution |
| `blender-render` | Frame-chunked 3D render | 🔲 Decomposition only (GPU workers future) |

Job type is auto-detected from the command text. Keywords like "render", "neural", "classify", "analyze" route to the appropriate decomposer.

---

## Voice Commands

The host dashboard supports browser speech recognition:

- Click the mic button in the **Voice Command** card
- Say **"Hey Clementine, \<your task\>"**
- Edit the transcript if needed
- Click **Dispatch Task** — or it auto-dispatches

After dispatch, the browser speaks a confirmation via text-to-speech.

Requires Chrome or Edge (or any browser with `webkitSpeechRecognition` support).

---

## Socket Events

### Client → Server
| Event | Payload |
|-------|---------|
| `host:register` | `{ sessionCode? }` |
| `worker:join` | `{ sessionCode, name, device }` |
| `job:submit` | `{ command }` |
| `task:progress` | `{ taskId, progress }` |
| `task:complete` | `{ taskId, output }` |

### Server → Client
| Event | Payload |
|-------|---------|
| `session:state` | `{ session, workers, jobs }` |
| `workers:update` | `WireWorker[]` |
| `job:created` | `WireJob` |
| `job:update` | `WireJob` |
| `job:complete` | `{ job, result }` |
| `task:assigned` | `WireTask` |

---

## Pass 2 Status

- [x] Custom server (Node.js + Socket.IO + Next.js)
- [x] Session creation and worker registration
- [x] Real-time worker join → host dashboard update
- [x] Job submission with type detection
- [x] Job decomposition (mock-compute, llm-analysis, batch-inference, blender-render)
- [x] Task scheduler (greedy, idle-worker assignment)
- [x] Browser-side task execution (mock compute with progress)
- [x] Result reducer with metrics
- [x] Live progress on host dashboard
- [x] Voice command input (SpeechRecognition API)
- [x] TTS job confirmation
- [x] Worker disconnect / task requeue

## Pass 3 Ideas

- Real task payloads (file processing, API calls, GPU inference)
- Native worker clients (Electron, CLI)
- Persistent sessions (Redis)
- GPU capability detection and routing
- Authenticated sessions
