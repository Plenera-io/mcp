import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";
import { createHttpEndpoint } from "./http";

const baseUrl = process.env.PLENERA_URL ?? "";
const workspace = process.env.PLENERA_WORKSPACE ?? "";
async function main() {
  if (!process.argv.includes("--http")) {
    const server = createServer({ baseUrl, workspace, token: process.env.PLENERA_TOKEN ?? "" });
    await server.connect(new StdioServerTransport());
    return;
  }
  // Loopback only. Each caller supplies its own API key.
  const port = Number(process.env.PORT ?? 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  const endpoint = createHttpEndpoint({ baseUrl, workspace });
  endpoint.listen(port, "127.0.0.1");
  endpoint.on("error", () => {
    process.stderr.write("Plenera MCP listener failed.\n");
    process.exitCode = 1;
  });
}
main().catch(() => {
  process.stderr.write(
    "Plenera MCP could not start. Set PLENERA_URL, PLENERA_WORKSPACE and (for stdio) PLENERA_TOKEN.\n",
  );
  process.exitCode = 1;
});
