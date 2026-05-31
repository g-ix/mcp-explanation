// mcp-server/abcd-mcp-server.ts

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Octokit } from "@octokit/rest";
import { Pool } from "pg";
import { WebClient } from "@slack/web-api";

const server = new McpServer({
  name: "abcd-mcp-server",
  version: "1.0.0",
});

const github = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const postgres = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const slack = new WebClient(process.env.SLACK_TOKEN);

/**
 * Tool 1:
 * Get latest GitHub issue.
 */
server.tool(
  "github_get_latest_issue",
  {
    owner: z.string(),
    repo: z.string(),
  },
  async ({ owner, repo }) => {
    const response = await github.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 1,
      sort: "created",
      direction: "desc",
    });

    const issue = response.data[0];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(issue ?? null),
        },
      ],
    };
  }
);

/**
 * Tool 2:
 * Find customer from Postgres using GitHub username.
 */
server.tool(
  "postgres_find_customer_by_github_username",
  {
    githubUsername: z.string(),
  },
  async ({ githubUsername }) => {
    const result = await postgres.query(
      `
      SELECT id, name, email, plan, status
      FROM customers
      WHERE github_username = $1
      LIMIT 1
      `,
      [githubUsername]
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result.rows[0] ?? null),
        },
      ],
    };
  }
);

/**
 * Tool 3:
 * Send Slack message.
 */
server.tool(
  "slack_send_support_message",
  {
    text: z.string(),
  },
  async ({ text }) => {
    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL!,
      text,
    });

    return {
      content: [
        {
          type: "text",
          text: "Slack message sent successfully.",
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
