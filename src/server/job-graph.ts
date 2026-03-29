// ─── Job Orchestration Graph ──────────────────────────────────────────────────
// LangGraph state machine for the full job lifecycle:
//   decompose → schedule → execute → reduce → END
//
// The graph is compiled once per server start (singleton).
// Call runJobGraph() from socket-handlers instead of the old inline IIFE.

import { StateGraph, END } from "@langchain/langgraph";
import type { Server as IOServer } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "../lib/shared-types";
import { JobGraphState } from "./graph-state";
import type { GraphJobContext } from "./graph-state";
import {
  makeDecomposeNode,
  makeScheduleNode,
  makeExecuteNode,
  makeReduceNode,
} from "./graph-nodes";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;

function buildJobGraph(io: IO) {
  return new StateGraph(JobGraphState)
    .addNode("decompose", makeDecomposeNode(io))
    .addNode("schedule",  makeScheduleNode(io))
    .addNode("execute",   makeExecuteNode())
    .addNode("reduce",    makeReduceNode(io))
    .addEdge("__start__", "decompose")
    .addEdge("decompose",  "schedule")
    .addEdge("schedule",   "execute")
    .addEdge("execute",    "reduce")
    .addEdge("reduce",     END)
    .compile();
}

let _compiledGraph: ReturnType<typeof buildJobGraph> | null = null;

function getJobGraph(io: IO) {
  if (!_compiledGraph) _compiledGraph = buildJobGraph(io);
  return _compiledGraph;
}

export async function runJobGraph(
  io: IO,
  ctx: GraphJobContext,
  command: string
): Promise<void> {
  const graph = getJobGraph(io);
  await graph.invoke({ ctx, command });
}
