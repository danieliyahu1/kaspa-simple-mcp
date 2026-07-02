#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";
import {
  getBalance,
  getTransaction,
  getFeeEstimate,
  getAddressUtxos,
  getAddressTransactions,
  getAddressTransactionCount,
  getAddressUtxoCount,
  getBalancesBatch,
  KaspaClientError,
  type UtxoResponse,
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
  "get_address_utxos",
  {
    address: z.string().describe("Kaspa mainnet address"),
  },
  async ({ address }) => {
    try {
      const utxos = await getAddressUtxos(address);
      const totalSompi = utxos.reduce((sum, u) => sum + BigInt(u.utxoEntry.amount), 0n);
      const utxoList = utxos.map((u) => ({
        txId: u.outpoint.transactionId,
        index: u.outpoint.index,
        amount: sompiToKas(Number(u.utxoEntry.amount)),
        daaScore: Number(u.utxoEntry.blockDaaScore),
        isCoinbase: u.utxoEntry.isCoinbase,
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                address,
                totalUtxos: utxos.length,
                totalKas: sompiToKas(Number(totalSompi)),
                utxos: utxoList,
              },
              null,
              2,
            ),
          },
        ],
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

server.tool(
  "get_address_transactions",
  {
    address: z.string().describe("Kaspa mainnet address"),
    limit: z.number().min(1).max(500).default(50).describe("Number of transactions (max 500)"),
    offset: z.number().min(0).default(0).describe("Offset for pagination"),
  },
  async ({ address, limit = 50, offset = 0 }) => {
    try {
      const txs = await getAddressTransactions(address, limit, offset);
      const result = txs.map((tx) => ({
        txId: tx.transaction_id,
        status: tx.is_accepted ? "confirmed" : "pending",
        timestamp: tx.block_time ?? null,
        outputs: tx.outputs.slice(0, 3).map((o) => ({
          recipient: o.script_public_key_address,
          amount: sompiToKas(o.amount),
        })),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ address, count: txs.length, transactions: result }, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_address_transaction_count",
  {
    address: z.string().describe("Kaspa mainnet address"),
  },
  async ({ address }) => {
    try {
      const data = await getAddressTransactionCount(address);
      return {
        content: [{ type: "text", text: JSON.stringify({ address, totalTransactions: data.total }) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_address_utxo_count",
  {
    address: z.string().describe("Kaspa mainnet address"),
  },
  async ({ address }) => {
    try {
      const data = await getAddressUtxoCount(address);
      return {
        content: [{ type: "text", text: JSON.stringify({ address, totalUtxos: data.count }) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_balances_batch",
  {
    addresses: z.array(z.string()).min(1).max(100).describe("Array of Kaspa mainnet addresses"),
  },
  async ({ addresses }) => {
    try {
      const entries = await getBalancesBatch(addresses);
      const result = entries.map((e) => ({
        address: e.address,
        balance: sompiToKas(e.balance),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
