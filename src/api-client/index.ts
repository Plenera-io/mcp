import createClient, { type Client } from "openapi-fetch";
import type { paths as publicPaths } from "./generated";

// The public contract includes /api/v1 in its paths. The client base URL already includes it.
type paths = {
  [Path in keyof publicPaths as Path extends `/api/v1${infer RelativePath}`
    ? RelativePath
    : never]: publicPaths[Path];
};

export type { paths };

export type PleneraClient = Client<paths>;

export function createPleneraClient(options?: {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
}): PleneraClient {
  const client = createClient<paths>({
    baseUrl: options?.baseUrl ?? "/api/v1",
    credentials: "include",
    fetch: options?.fetch,
    headers: options?.token
      ? { Authorization: `Bearer ${options.token}` }
      : { "X-Plenera-Client": "web" },
  });
  client.use({
    onRequest({ request }) {
      if (!options?.token) request.headers.set("X-Plenera-Client", "web");
      if (request.method !== "GET" && request.method !== "HEAD") {
        if (!request.headers.has("Idempotency-Key")) {
          request.headers.set("Idempotency-Key", crypto.randomUUID());
        }
        if (!request.headers.has("X-Client-Mutation-Id")) {
          request.headers.set("X-Client-Mutation-Id", crypto.randomUUID());
        }
      }
      return request;
    },
  });
  return client;
}
