# Plenera MCP

Tools for projects, statuses, issue search/query, assigned work, issue creation/updates, self-assignment, comments and relations. Uses the generated Plenera API client and your API permissions; actions retain your agent identity.

For the managed OAuth connection, add `https://app.plenera.io/mcp` to your client. See the [Plenera agent setup guide](https://app.plenera.io/docs/agents).

For the local CLI, create a key in **Settings → Agents** or use a personal API token. Store it in your client's secret store and set your installation's `/api/v1` URL and workspace slug.

```json
{
  "mcpServers": {
    "plenera": {
      "command": "npx",
      "args": ["-y", "@plenera/mcp@1.0.0"],
      "env": {
        "PLENERA_URL": "https://app.plenera.io/api/v1",
        "PLENERA_WORKSPACE": "your-workspace",
        "PLENERA_TOKEN": "<agent-key-from-secret-store>"
      }
    }
  }
}
```

The snippet works with Claude Code, Cursor and clients accepting `mcpServers`. In Codex, use the equivalent `[mcp_servers.plenera]` entry in `~/.codex/config.toml` with `command = "npx"`, `args = ["-y", "@plenera/mcp@1.0.0"]`, and pass the same environment variables through your secret environment. Do not commit credentials.

## Next assigned task

`next_task` returns the caller's highest-priority **unstarted** assignment, or
`issue: null` when none is ready. It uses the same order as the agent queue:
urgent, high, medium, low, then no priority; board rank; due date (undated last);
and id. It respects guest project access and does not claim or change the issue.
Use a named agent key or personal credential, rather than a legacy workspace key.
The API equivalent is `GET /orgs/{org}/agents/next`. Agent queue cursors are opaque
and bound to the agent/workspace; keep them unchanged when loading another page.

## Source installation and publishing

Node.js 22 or later is required.

```sh
git clone https://github.com/Plenera-io/mcp.git
cd mcp
npm ci
npm run build
```

Use `node` with the absolute path to `dist/cli.js` in your MCP client. To check a release, run `npm run typecheck`, `npm test`, and `npm pack`. The tarball includes the CLI, bundled API client, and skill.

Run `npm run generate:api` to regenerate the API types from the [public Plenera OpenAPI contract](https://app.plenera.io/api/v1/openapi.json). When changing a tool contract shared with the hosted MCP service, coordinate the corresponding change in the Plenera app and run the transport tests.

## Releases

Update the package version and lockfile with `npm version <version> --no-git-tag-version`, then merge the version change into `main`. Push the matching stable tag, such as `v1.0.1`, on that commit. The [Publish to npm workflow](.github/workflows/publish.yml) checks the tag, installs the locked dependencies, tests the build, and publishes its tarball using npm Trusted Publishing.

Run the workflow manually from `main` to verify the build and npm's GitHub OIDC connection without publishing a package version.

## Streamable HTTP

Set `PLENERA_URL` and `PLENERA_WORKSPACE`, then run `node dist/cli.js --http` from a source checkout or `plenera-mcp --http` from an installed package. It listens on `127.0.0.1:3100/mcp` (`PORT` overrides). Each HTTP caller supplies its own `Authorization: Bearer <Plenera-key>`; no shared process token is used. The server is stateless and accepts POST only. Expose through a TLS reverse proxy if needed, retaining a loopback Host header; browser Origin requests are refused. Do not expose an unencrypted public listener. Upstream URLs must use HTTPS except loopback development.

## Agent skill

Copy `skills/plenera` to your client's skill directory (Codex: `~/.codex/skills/plenera`; Claude Code: `~/.claude/skills/plenera`; Cursor: `.cursor/skills/plenera`). Configure the MCP connection first. Read the included `SKILL.md` for pagination, idempotency and completion evidence.

Errors retain the API status, request ID and retry guidance. No automatic retries are performed. Keep a stable idempotency key when retrying an identical POST; read state after an uncertain write. Never share a key across tenants or print it in task comments.

Issue tools accept `descriptionMarkdown` for native Markdown authoring. Do not
also send `description`; editor JSON and plain legacy strings remain supported.
Read results include canonical `descriptionMarkdown`. The `comment` tool's body
is Markdown, and comment results include both editor JSON and `bodyMarkdown`.

Agents can receive work without polling: owners/admins configure a public HTTPS
endpoint in Settings → Agents → Wake-ups (or POST `/orgs/{org}/agents/{id}/endpoint`).
Save the returned signing secret once. Assignment and structured comment mentions
produce `agent.assigned` / `agent.mentioned` events with bounded Markdown context,
recent comments, linked PRs and stable delivery ids. Verify `Plenera-Signature`
against the raw body and a recent timestamp, and deduplicate event ids before
starting work. The existing webhook queue handles retry/backoff and public-address
pinning; redirects are not followed. Read delivery status through the endpoint
GET route as that agent or an owner/admin. Pausing an endpoint, disabling its agent
or deleting/moving the source issue prevents queued delivery. Destinations for
agents are included independently of ordinary webhook quotas.

## Sessions and human steering

After assignment, call `start_session` with the issue and an idempotency key.
Use `session_activity` for steps, messages, PR links and optional reported USD
cost. Call `update_session` periodically as a heartbeat, with `needs_input` when
blocked, and `done` or `failed` to finish. `get_session` reads activity and supports
before/after activity cursors. Human replies arrive as signed `agent.session.reply`
events carrying the same session id and reply text; acknowledge by heartbeating
or updating that session rather than creating a second one. Polling is unnecessary
when a wake-up endpoint is connected.

Sessions appear live on the issue, including their activity, PR links and reported
cost. Queued/working sessions without progress for five minutes show Stale.
The issue must be assigned to the agent before starting, and every session read
rechecks project visibility. Only the owning agent reports progress; humans can
steer it with replies. A saved reply explicitly reports when no active destination
was available, so it cannot silently pretend to have notified a disconnected runner.
