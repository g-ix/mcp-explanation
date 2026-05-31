# mcp-explanation

## Before you go through the repo

One thing to note for MCP that I have understood. The code exists (similar to no MCP implementation). But the difference is:

**WITH MCP**, AI code exists on the server side (which handles 3rd party APIs - I mean not related to your project, for example: Google API, Slack API, GitHub API, etc.). And your REPO calls only existing functions (as per your code on the server that internally calls Google API, Slack API, and so on).

**Without MCP**, both the 3rd Party API code and your repo code are on the client side. That's pretty much the gist of MCP.

As I understand it, it's called a **protocol** because it **centralizes** what you do with AI. Similar to *http* or *https*, the **'connection or communication'** layer is MCP.

---

This is a tiny, end-to-end example of the **Model Context Protocol (MCP)** built with TypeScript.
It contains a working **MCP server** that exposes three real-world tools (GitHub, Postgres, Slack) and an **MCP client** ("AI app") that discovers those tools and chains them together into a small workflow.

The goal is **learning**: read the code, run it, and understand *what MCP actually is* and *how a client and a server communicate*.

---

## What is MCP?

**MCP (Model Context Protocol)** is an open standard that defines *how an AI application talks to external tools, data, and services.* Think of it as **"USB-C for AI apps"** — a single, standard plug so that any MCP-compatible app can connect to any MCP-compatible tool server without custom glue code for each one.

Without MCP, every AI app writes bespoke integrations for GitHub, Slack, your database, etc. With MCP, those integrations live behind a **server** that speaks a standard protocol, and any **client** can connect to it.

### The core pieces

| Term | What it is | In this repo |
|------|-----------|--------------|
| **Host / AI app** | The application a user interacts with (e.g. an AI assistant). It embeds one or more clients. | `client/index.ts` |
| **MCP Client** | The component inside the host that opens a connection to one server and speaks MCP. | The `Client` instance in `client/index.ts` |
| **MCP Server** | A program that exposes capabilities (tools, resources, prompts) over MCP. | `mcp-server/abcd-mcp-server.ts` |
| **Tool** | A named, typed function the server offers that the client can call. | `github_get_latest_issue`, `postgres_find_customer_by_github_username`, `slack_send_support_message` |
| **Transport** | How bytes move between client and server. | **stdio** (the client launches the server as a child process and they talk over stdin/stdout) |

> MCP servers can expose three kinds of capabilities: **tools** (functions to call),
> **resources** (readable data/context), and **prompts** (reusable prompt templates).
> This example focuses on **tools**, the most common starting point.

### How a client and server communicate

MCP messages are **JSON-RPC 2.0** under the hood. The flow is always:

1. **Connect** — client and server open a transport and perform a handshake (exchange protocol version + capabilities).
2. **Discover** — the client asks "what can you do?" (`listTools`) and the server replies with tool names + input schemas.
3. **Call** — the client invokes a tool by name with arguments (`callTool`); the server runs the tool and returns structured `content` back.

In this repo, the transport is **stdio**: the client *spawns the server as a subprocess* and they exchange JSON-RPC messages over the process's stdin/stdout pipes. (MCP also supports an HTTP-based transport for remote servers — not used here.)

---

## What this example does

```
AI App (client/index.ts)
  │
  │  MCP (JSON-RPC over stdio)
  ▼
MCP Server (mcp-server/abcd-mcp-server.ts)
  │
  ├─► GitHub API   (get latest open issue)
  ├─► Postgres DB  (look up the customer who filed it)
  └─► Slack API    (post a support alert)
```

When you run the client, it performs these steps in order:

1. **Discover tools** — calls `listTools()` and prints the available tool names.
2. **GitHub** — calls `github_get_latest_issue` to fetch the most recent open issue in a repo.
3. **Postgres** — takes the issue author's GitHub username and calls `postgres_find_customer_by_github_username` to find the matching customer row.
4. **Slack** — calls `slack_send_support_message` to post a summary (issue + customer details) into a Slack channel.

The interesting part is that the **client never imports the GitHub, Postgres, or Slack SDKs.** It only knows how to speak MCP. All the integration logic lives in the server, behind standard tools.

---

## Repository layout

```
mcp-explanation/
├── package.json                  # deps + npm scripts (npm run client / server / typecheck)
├── tsconfig.json                 # TypeScript config (ESM + Node types)
├── .env.example                  # copy to .env and fill in your credentials
├── client/
│   └── index.ts                  # the MCP client ("AI app") — discovers & calls tools
└── mcp-server/
    └── abcd-mcp-server.ts         # the MCP server — defines the 3 tools
```

---

## Prerequisites

- **Node.js 18+** (developed on Node 24). No global installs needed beyond Node.
- To run the *full* workflow against live services, you need:
  - A **GitHub token** (`GITHUB_TOKEN`) with access to the repo you query.
  - A reachable **Postgres** database (`POSTGRES_URL`) containing a `customers` table.
  - A **Slack bot token** (`SLACK_TOKEN`) and a channel (`SLACK_CHANNEL`).

You can still run the client and watch the **tool-discovery handshake** succeed even with dummy credentials — it will only fail once it tries to hit a real API.

---

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create your environment file**

   ```bash
   cp .env.example .env
   ```

   Then edit `.env`:

   ```bash
   GITHUB_TOKEN=ghp_your_real_token
   POSTGRES_URL=postgresql://user:password@host:5432/dbname
   SLACK_TOKEN=xoxb-your-slack-token
   SLACK_CHANNEL=#support
   ```

   > `.env` is gitignored. **Never commit real secrets.** (The original `.env` in the
   > first commit was intentional for the walkthrough — don't do that in real projects.)

3. **(Optional) Set up the Postgres table** the second tool expects:

   ```sql
   CREATE TABLE customers (
     id              SERIAL PRIMARY KEY,
     name            TEXT,
     email           TEXT,
     plan            TEXT,
     status          TEXT,
     github_username TEXT
   );
   ```

4. **Point the client at a real repo.** In `client/index.ts`, the GitHub call is hardcoded to `owner: "OWNER_NAME", repo: "abcd"`. Change these to a repo your token can read (one with at least one open issue).

---

## Running it

The client is the entry point. **You do not start the server yourself** — the client launches it automatically as a subprocess over the stdio transport.

```bash
npm run client
```

Expected output (with valid credentials and a repo that has an open issue):

```
Available MCP tools:
[
  'github_get_latest_issue',
  'postgres_find_customer_by_github_username',
  'slack_send_support_message'
]
Latest issue: <title of the newest open issue>
Customer: { id: ..., name: ..., email: ..., plan: ..., status: ... }
Flow completed.
```

### Other scripts

```bash
npm run server      # run the server standalone (it waits for a client on stdin/stdout)
npm run typecheck   # type-check the project with tsc (no emit)
```

> Running `npm run server` on its own will appear to "do nothing" — that's correct. An
> MCP stdio server sits quietly waiting for a client to send JSON-RPC messages on its
> stdin. It's normally launched *by* a client, as the client script does.

---

## Code walkthrough

### The server — `mcp-server/abcd-mcp-server.ts`

```ts
const server = new McpServer({ name: "abcd-mcp-server", version: "1.0.0" });
```

Creates the MCP server. Then each capability is registered with `server.tool(...)`:

```ts
server.tool(
  "github_get_latest_issue",          // 1. tool name (how the client calls it)
  { owner: z.string(), repo: z.string() }, // 2. input schema (Zod) — validated + advertised
  async ({ owner, repo }) => {        // 3. handler — runs when the client calls the tool
    const response = await github.issues.listForRepo({ owner, repo, /* ... */ });
    return { content: [{ type: "text", text: JSON.stringify(response.data[0] ?? null) }] };
  }
);
```

Three things to notice:

- **The Zod schema is the contract.** The SDK both *validates* incoming arguments against it and *advertises* it to clients during discovery, so the client knows exactly what arguments each tool expects.
- **Tools return `content`** — an array of typed blocks (here, `text`). The server serializes results to JSON strings; the client parses them back.
- The three tools wrap **GitHub** (`@octokit/rest`), **Postgres** (`pg`), and **Slack** (`@slack/web-api`) respectively. This is where all the real integration code lives.

Finally, the server attaches a transport and starts listening:

```ts
const transport = new StdioServerTransport();
await server.connect(transport);
```

### The client — `client/index.ts`

```ts
const client = new Client({ name: "abcd-ai-app", version: "1.0.0" });

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "mcp-server/abcd-mcp-server.ts"], // <-- launches the server as a subprocess
});

await client.connect(transport);
```

The client **spawns the server itself** and connects over stdio. Then it follows the MCP flow:

```ts
const tools = await client.listTools();          // DISCOVER

const result = await client.callTool({           // CALL
  name: "github_get_latest_issue",
  arguments: { owner: "OWNER_NAME", repo: "abcd" },
});

const issue = JSON.parse((result.content as { text: string }[])[0].text);
```

It chains the three tools together — GitHub issue → Postgres customer → Slack message — using the output of one tool as input to the next. That orchestration ("which tool to call next, with what arguments") is exactly the role an AI model plays in a real AI app; here it's hardcoded so the mechanics are easy to follow.

---

## Key dependencies

| Package | Role |
|---------|------|
| `@modelcontextprotocol/sdk` | The MCP client + server SDK (transports, JSON-RPC, tool registration) |
| `zod` | Defines and validates tool input schemas |
| `@octokit/rest` | GitHub API client (used by tool 1) |
| `pg` | Postgres client (used by tool 2) |
| `@slack/web-api` | Slack API client (used by tool 3) |
| `dotenv` | Loads credentials from `.env` |
| `tsx` | Runs the TypeScript files directly, no build step |

---

## Learn more

- MCP documentation & spec: https://modelcontextprotocol.io
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
