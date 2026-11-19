import { createServer as createHttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type Config } from "./server";

export function createHttpEndpoint(config: Omit<Config, "token">) {
  // Validate deployment configuration before accepting requests.
  void createServer({ ...config, token: "validate-config" }).close();
  return createHttpServer(async (req, res) => {
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    const host = (req.headers.host ?? "").replace(/:\d+$/, "");
    if (req.headers.origin || !["127.0.0.1", "localhost", "[::1]"].includes(host)) {
      res.writeHead(403).end();
      return;
    }
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) {
      res.writeHead(401, { "WWW-Authenticate": "Bearer" }).end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" }).end();
      return;
    }
    const server = createServer({ ...config, token });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(500).end();
    }
  });
}
