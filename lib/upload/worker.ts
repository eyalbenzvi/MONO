/**
 * The upload worker: a module Web Worker webpack emits as its own
 * same-origin chunk (lib/upload/run.ts starts it with
 * `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`),
 * so the CSP's script-src 'self' covers it and no blob worker is needed.
 * Thin on purpose: one request in, one result out (lib/upload/decode.ts
 * handle), the ink and tone buffers handed back without a copy.
 */
import { handle, transferables, type UploadRequest } from "./decode";

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<{ id: number; req: UploadRequest }>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

scope.onmessage = (e) => {
  const { id, req } = e.data;
  void handle(req).then((res) => scope.postMessage({ id, res }, transferables(res)));
};
