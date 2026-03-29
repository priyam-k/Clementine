import type { Server as IOServer } from "socket.io";
import { END, START, StateGraph } from "@langchain/langgraph";
import type { ServerToClientEvents, ClientToServerEvents } from "../lib/shared-types";
import { JobGraphState, type JobGraphStateType } from "./graph-state";
import {
  makeDecomposeNode,
  makeExecuteNode,
  makeReduceNode,
  makeScheduleNode,
} from "./graph-nodes";

type IO = IOServer<ClientToServerEvents, ServerToClientEvents>;

export async function runJobGraph(
  io: IO,
  initialState: JobGraphStateType
): Promise<JobGraphStateType> {
  const graph = new StateGraph(JobGraphState)
    .addNode("decompose", makeDecomposeNode(io))
    .addNode("schedule", makeScheduleNode(io))
    .addNode("execute", makeExecuteNode())
    .addNode("reduce", makeReduceNode(io))
    .addEdge(START, "decompose")
    .addEdge("decompose", "schedule")
    .addEdge("schedule", "execute")
    .addEdge("execute", "reduce")
    .addEdge("reduce", END)
    .compile();

  return graph.invoke(initialState);
}
