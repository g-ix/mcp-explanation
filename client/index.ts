// client/index.ts

import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({
  name: "abcd-ai-app",
  version: "1.0.0",
});

const transport = new StdioClientTransport({
  command: "npx",
  args: ["tsx", "mcp-server/abcd-mcp-server.ts"],
});

await client.connect(transport);

/**
 * Step 1:
 * AI app discovers available MCP tools.
 */
const tools = await client.listTools();

console.log("Available MCP tools:");
console.log(tools.tools.map((tool) => tool.name));

/**
 * Step 2:
 * Call GitHub tool.
 */
const latestIssueResult = await client.callTool({
  name: "github_get_latest_issue",
  arguments: {
    owner: "OWNER_NAME",
    repo: "abcd",
  },
});

const latestIssueContent = latestIssueResult.content as { text: string }[];
const latestIssue = JSON.parse(latestIssueContent[0].text);

console.log("Latest issue:", latestIssue?.title);

if (!latestIssue) {
  console.log("No open issues found.");
  process.exit(0);
}

/**
 * Step 3:
 * Call Postgres tool.
 */
const customerResult = await client.callTool({
  name: "postgres_find_customer_by_github_username",
  arguments: {
    githubUsername: latestIssue.user.login,
  },
});

const customerContent = customerResult.content as { text: string }[];
const customer = JSON.parse(customerContent[0].text);

console.log("Customer:", customer);

/**
 * Step 4:
 * Call Slack tool.
 */
await client.callTool({
  name: "slack_send_support_message",
  arguments: {
    text: `
New GitHub issue found.

Issue: ${latestIssue.title}
Author: ${latestIssue.user.login}
URL: ${latestIssue.html_url}

Customer:
${customer ? `${customer.name} | ${customer.email} | ${customer.plan}` : "No customer found"}
    `,
  },
});

console.log("Flow completed.");

await client.close();
