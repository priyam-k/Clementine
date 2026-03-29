# Clementine

**Transform idle home devices into a private distributed compute cluster.**

Clementine lets you submit a job — by text or voice — and automatically splits it into parallel subtasks distributed across every device on your local network. No cloud, no fees, no data leaving your home.

---

## How it works

1. **Host** opens the dashboard and starts a session
2. **Workers** join by scanning a QR code or visiting the session URL on any device
3. **Submit a job** — Clementine uses an LLM to decompose it into parallel subtasks
4. **Tasks are distributed** to idle workers and executed in real-time in the browser
5. **Results are aggregated** and synthesized into a final summary by Gemini

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (custom Node.js server) |
| Real-time | Socket.IO |
| LLM Orchestration | LangGraph + LangChain |
| Task Decomposition | K2 (k2think.ai) |
| Result Synthesis | Gemini 2.5 Flash |
| Animations | Framer Motion, Canvas API |
| Database | MongoDB (job history) |
| Styling | Tailwind CSS v4 |

---

## Getting started

### Prerequisites

- Node.js 18+

### Install

```bash
git clone https://github.com/priyam-k/Clementine.git
cd Clementine
npm install
```

### Environment variables

Create `.env.local`:

```env
# Task decomposition (required)
K2_API_KEY=your_k2think_api_key
K2_BASE_URL=https://api.k2think.ai/v1
K2_MODEL=MBZUAI-IFM/K2-Think-v2

# Result synthesis (required)
GEMINI_API_KEY=your_gemini_api_key

# Anthropic fallback for decomposition (optional)
ANTHROPIC_API_KEY=

# Job history persistence (optional)
MONGODB_URI=

# Set this in production to your public domain
# RAILWAY_PUBLIC_DOMAIN=your-app.up.railway.app
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) as the host. Workers join at `http://<your-local-ip>:3000/join` on any device on the same network.

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/host` | Host dashboard — dispatch jobs, monitor workers and tasks live |
| `/host/tasks` | Task inspector — per-task input/output breakdown with job process dump |
| `/host/workers` | Worker list with device telemetry |
| `/join` | Worker join page — scan QR or enter session code |

---

## Voice commands

The host dashboard supports browser speech recognition:

- Click the mic button in the Voice Command card
- Say **"Hey Clementine, \<your task\>"**
- Edit if needed, then dispatch

Requires Chrome or Edge (`webkitSpeechRecognition`).

---

## Deploying

Clementine requires a **persistent Node.js process** — Socket.IO needs long-lived connections and won't work on Vercel or other serverless platforms.

**Recommended: [Railway](https://railway.app)**

1. Connect your GitHub repo on Railway
2. Add all env vars in the Variables tab
3. Set `RAILWAY_PUBLIC_DOMAIN` to your generated `*.up.railway.app` domain
4. Click **Generate Domain** in the Railway service settings for a public URL

---

## Project structure

```
server.ts                    Custom HTTP + Socket.IO + Next.js server entry point

src/
  app/                       Next.js pages + API routes
  components/
    host/                    Dashboard UI (JobCard, WorkerGrid, TaskInspectOverlay, ...)
    join/                    Worker UI
    landing/                 Landing page sections + canvas visualizations
    ui/                      Primitives (ProgressBar, Badge)
  server/                    Server-side logic
    decomposer.ts            Job → subtask splitting
    scheduler.ts             Task → worker assignment
    reducer.ts               Output aggregation
    graph-nodes.ts           LangGraph node implementations
    socket-handlers.ts       All Socket.IO events
  hooks/
    useHostSession.ts        Host dashboard state
    useWorkerSession.ts      Worker state + task execution
  lib/
    shared-types.ts          Wire types shared by server and client
    compute-executors.ts     Real JS computation implementations
```

---

*Built at YHack 2026*
