import { computeFractalTile } from "@/lib/fractal-compute";
import type { FractalTileInput, FractalTileOutput } from "@/lib/shared-types";

interface WorkerRequest {
  input: FractalTileInput;
}

interface WorkerResponse {
  output: FractalTileOutput;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const output = computeFractalTile(event.data.input);
  const response: WorkerResponse = { output };
  self.postMessage(response);
};
