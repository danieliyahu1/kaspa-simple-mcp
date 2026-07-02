#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";
import {
  getBalance,
  getTransaction,
  getFeeEstimate,
  KaspaClientError,
} from "./kaspa-client.js";
import { sompiToKas } from "./conversion.js";

const server = new McpServer({
  name: "kaspa-simple-mcp",
  version: "0.1.0",
});

server.tool(
  "get_balance",
  {
    address: z.string().describe("Kaspa mainnet address"),
  },
  async ({ address }) => {
    try {
      const data = await getBalance(address);
      return {
        content: [{ type: "text", text: JSON.stringify({ balance: sompiToKas(data.balance) }) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_transaction",
  {
    txId: z.string().describe("Kaspa transaction ID"),
  },
  async ({ txId }) => {
    try {
      const tx = await getTransaction(txId);
      const totalSompi = tx.outputs.reduce((sum, o) => sum + o.amount, 0);
      const outputs = tx.outputs.slice(0, 5).map((o) => ({
        recipient: o.script_public_key_address,
        amount: sompiToKas(o.amount),
      }));
      const result: Record<string, unknown> = {
        status: tx.is_accepted ? "confirmed" : "pending",
        timestamp: tx.block_time ?? null,
        totalKas: sompiToKas(totalSompi),
        outputs,
      };
      if (tx.outputs.length > 5) {
        result.moreOutputs = tx.outputs.length - 5;
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_fee_estimate",
  {},
  async () => {
    try {
      const data = await getFeeEstimate();
      return {
        content: [
          { type: "text", text: JSON.stringify({ feerate: sompiToKas(data.priorityBucket.feerate) }) },
        ],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

function formatError(err: unknown) {
  const message =
    err instanceof KaspaClientError
      ? err.message
      : err instanceof Error
        ? err.message
        : "Unknown error";
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
