import type { AuthRepository } from "./index.js";

export function createBffAuthRepository(options: {
  fetch: typeof fetch;
  origin: string;
  channel?: {
    postMessage: (message: string) => void;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  };
  now?: () => number;
}): AuthRepository;
