import { createServer as httpServer, request, type Server } from "node:http";
import { once } from "node:events";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createHttpEndpoint } from "../src/http";
import { createServer } from "../src/server";

let upstream: Server;
let endpoint: Server;
let baseUrl: string;
let url: URL;
async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  return `http://127.0.0.1:${address.port}`;
}
beforeAll(async () => {
  upstream = httpServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ identity: req.headers.authorization, path: req.url }));
  });
  baseUrl = `${await listen(upstream)}/api/v1`;
  endpoint = createHttpEndpoint({ baseUrl, workspace: "demo" });
  url = new URL(`${await listen(endpoint)}/mcp`);
});
afterAll(async () => {
  endpoint.closeAllConnections();
  upstream.closeAllConnections();
  await Promise.all([
    new Promise<void>((resolve) => endpoint.close(() => resolve())),
    new Promise<void>((resolve) => upstream.close(() => resolve())),
  ]);
});
describe("MCP transports", () => {
  it("serves Streamable HTTP with per-caller credentials and no session identity reuse", async () => {
    for (const token of ["first-agent", "second-agent"]) {
      const peer = new Client({ name: "http-test", version: "1" });
      await peer.connect(
        new StreamableHTTPClientTransport(url, {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
        }),
      );
      const result = await peer.callTool({ name: "list_projects", arguments: {} });
      expect(JSON.parse((result.content as { text: string }[])[0]!.text)).toEqual({
        identity: `Bearer ${token}`,
        path: "/api/v1/orgs/demo/projects",
      });
      await peer.close();
    }
  });
  it("rejects unauthenticated, cross-origin and foreign Host HTTP requests", async () => {
    expect((await fetch(url, { method: "POST" })).status).toBe(401);
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: { Origin: "https://evil.example", Authorization: "Bearer secret" },
        })
      ).status,
    ).toBe(403);
    expect(
      await new Promise<number | undefined>((resolve, reject) => {
        const req = request(
          url,
          { method: "POST", headers: { Host: "evil.example", Authorization: "Bearer secret" } },
          (res) => {
            res.resume();
            resolve(res.statusCode);
          },
        );
        req.on("error", reject);
        req.end();
      }),
    ).toBe(403);
  });
  it("connects a real child process over stdio", async () => {
    const peer = new Client({ name: "stdio-test", version: "1" });
    const env = Object.fromEntries(
      Object.entries(process.env).filter((row): row is [string, string] => row[1] !== undefined),
    );
    await peer.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: ["dist/cli.js"],
        env: {
          ...env,
          PLENERA_URL: baseUrl,
          PLENERA_WORKSPACE: "demo",
          PLENERA_TOKEN: "stdio-agent",
        },
        stderr: "pipe",
      }),
    );
    try {
      expect((await peer.listTools()).tools.map((tool) => tool.name)).toContain("next_task");
      const result = await peer.callTool({ name: "list_projects", arguments: {} });
      expect(JSON.parse((result.content as { text: string }[])[0]!.text).identity).toBe(
        "Bearer stdio-agent",
      );
    } finally {
      await peer.close();
    }
  });
  it("refuses non-HTTPS remote API URLs and embedded credentials", () => {
    for (const url of ["http://remote.example/api/v1", "https://user:secret@example.com/api/v1"])
      expect(() => createServer({ baseUrl: url, workspace: "demo", token: "secret" })).toThrow();
  });
});
