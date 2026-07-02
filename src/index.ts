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
  getAddressBalanceHistory,
  getUtxosBatch,
  getAddressTransactionsPage,
  getAddressesActive,
  getAddressName,
  getTopAddresses,
  getAddressDistribution,
  getActiveAddressesCount,
  getActiveAddressesCountHistory,
  getAddressNames,
  searchTransactions,
  getTransactionsAcceptance,
  calculateTransactionMass,
  getTransactionCount,
  getTransactionCountHistory,
  KaspaClientError,
  type UtxoResponse,
  type SearchTransactionResult,
  type TxAcceptanceResult,
  type TxMassResult,
  type TransactionCountResult,
} from "./kaspa-client.js";
import { sompiToKas } from "./conversion.js";

const server = new McpServer({
  name: "kaspa-simple-mcp",
  version: "0.6.0",
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

server.tool(
  "get_address_balance_history",
  {
    address: z.string().describe("Kaspa mainnet address"),
    dayOrMonth: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).describe("UTC day (YYYY-MM-DD) or month (YYYY-MM)"),
  },
  async ({ address, dayOrMonth }) => {
    try {
      const entries = await getAddressBalanceHistory(address, dayOrMonth);
      const history = entries.map((e) => ({
        timestamp: new Date(e.timestamp).toISOString(),
        amount: sompiToKas(e.amount),
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ address, dayOrMonth, history }, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_utxos_batch",
  {
    addresses: z.array(z.string()).min(1).max(100).describe("Array of Kaspa mainnet addresses"),
  },
  async ({ addresses }) => {
    try {
      const utxos = await getUtxosBatch(addresses);
      const grouped: Record<string, { totalUtxos: number; totalKas: string; utxos: unknown[] }> = {};
      for (const u of utxos) {
        const addr = u.address ?? "unknown";
        if (!grouped[addr]) {
          grouped[addr] = { totalUtxos: 0, totalKas: "0", utxos: [] };
        }
        grouped[addr].totalUtxos++;
        grouped[addr].utxos.push({
          txId: u.outpoint.transactionId,
          index: u.outpoint.index,
          amount: sompiToKas(Number(u.utxoEntry.amount)),
          daaScore: Number(u.utxoEntry.blockDaaScore),
          isCoinbase: u.utxoEntry.isCoinbase,
        });
      }
      for (const addr of Object.keys(grouped)) {
        const totalSompi = utxos
          .filter((u) => (u.address ?? "unknown") === addr)
          .reduce((sum, u) => sum + BigInt(u.utxoEntry.amount), 0n);
        grouped[addr].totalKas = sompiToKas(Number(totalSompi));
      }
      return {
        content: [{ type: "text", text: JSON.stringify(grouped, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_address_transactions_page",
  {
    address: z.string().describe("Kaspa mainnet address"),
    limit: z.number().min(1).max(500).default(50).describe("Max records per page (max 500)"),
    before: z.number().min(0).optional().describe("Only include transactions with block time before this epoch-millis"),
    after: z.number().min(0).optional().describe("Only include transactions with block time after this epoch-millis"),
  },
  async ({ address, limit = 50, before, after }) => {
    try {
      const { transactions, nextBefore, nextAfter } = await getAddressTransactionsPage(
        address, limit, before ?? 0, after ?? 0,
      );
      const result = transactions.map((tx) => ({
        txId: tx.transaction_id,
        status: tx.is_accepted ? "confirmed" : "pending",
        timestamp: tx.block_time ?? null,
        outputs: tx.outputs.slice(0, 3).map((o) => ({
          recipient: o.script_public_key_address,
          amount: sompiToKas(o.amount),
        })),
      }));
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { address, limit, count: result.length, transactions: result, nextBefore: nextBefore ?? null, nextAfter: nextAfter ?? null },
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
  "get_addresses_active",
  {
    addresses: z.array(z.string()).min(1).max(100).describe("Array of Kaspa mainnet addresses"),
  },
  async ({ addresses }) => {
    try {
      const entries = await getAddressesActive(addresses);
      const results = entries.map((e) => ({
        address: e.address,
        active: e.active,
        lastTxBlockTime: e.lastTxBlockTime ? new Date(e.lastTxBlockTime).toISOString() : null,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ results }, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_address_name",
  {
    address: z.string().describe("Kaspa mainnet address"),
  },
  async ({ address }) => {
    try {
      const data = await getAddressName(address);
      if (!data) {
        return {
          content: [{ type: "text", text: JSON.stringify({ address, name: null }) }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify({ address, name: data.name }) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_top_addresses",
  {},
  async () => {
    try {
      const data = await getTopAddresses();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_address_distribution",
  {},
  async () => {
    try {
      const data = await getAddressDistribution();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_active_addresses_count",
  {},
  async () => {
    try {
      const data = await getActiveAddressesCount();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_active_addresses_count_history",
  {
    dayOrMonth: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).describe("UTC day (YYYY-MM-DD) or month (YYYY-MM)"),
  },
  async ({ dayOrMonth }) => {
    try {
      const entries = await getActiveAddressesCountHistory(dayOrMonth);
      return {
        content: [{ type: "text", text: JSON.stringify({ dayOrMonth, count: entries.length, entries }, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

server.tool(
  "get_address_names",
  {},
  async () => {
    try {
      const data = await getAddressNames();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

// --- Transaction Search ---

server.tool(
  "search_transactions",
  {
    transactionIds: z.array(z.string()).optional().describe("Array of transaction IDs to search for"),
    acceptingBlueScoreGte: z.number().int().min(0).optional().describe("Minimum accepting blue score"),
    acceptingBlueScoreLt: z.number().int().min(0).optional().describe("Maximum accepting blue score (exclusive)"),
    resolvePreviousOutpoints: z.enum(["no", "light", "full"]).optional().describe("Resolve previous outpoint details"),
    acceptance: z.enum(["accepted", "rejected"]).optional().describe("Filter by acceptance status"),
  },
  async ({ transactionIds, acceptingBlueScoreGte, acceptingBlueScoreLt, resolvePreviousOutpoints, acceptance }) => {
    try {
      const body: { transactionIds?: string[]; acceptingBlueScores?: { gte: number; lt: number } } = {};
      if (transactionIds && transactionIds.length > 0) body.transactionIds = transactionIds;
      if (acceptingBlueScoreGte !== undefined || acceptingBlueScoreLt !== undefined) {
        body.acceptingBlueScores = {
          gte: acceptingBlueScoreGte ?? 0,
          lt: acceptingBlueScoreLt ?? 0,
        };
      }
      const results = await searchTransactions(
        body,
        { resolvePreviousOutpoints, acceptance },
      );
      const formatted = results.map((tx) => ({
        txId: tx.transaction_id,
        hash: tx.hash,
        isAccepted: tx.is_accepted,
        blockTime: tx.block_time ? new Date(tx.block_time).toISOString() : null,
        blockHash: tx.block_hash,
        mass: tx.mass,
        version: tx.version,
        acceptingBlockBlueScore: tx.accepting_block_blue_score,
        inputs: tx.inputs ? tx.inputs.map((i) => ({
          txId: i.transaction_id,
          index: i.index,
          previousOutpointHash: i.previous_outpoint_hash,
          previousOutpointIndex: i.previous_outpoint_index,
          previousOutpointAddress: i.previous_outpoint_address ?? null,
          previousOutpointAmount: i.previous_outpoint_amount != null ? sompiToKas(i.previous_outpoint_amount) : null,
          signatureScript: i.signature_script ?? null,
        })) : [],
        outputs: tx.outputs ? tx.outputs.map((o) => ({
          recipient: o.script_public_key_address,
          amount: sompiToKas(o.amount),
          scriptType: o.script_public_key_type,
        })) : [],
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ count: formatted.length, transactions: formatted }, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

// --- Transaction Acceptance ---

server.tool(
  "get_transactions_acceptance",
  {
    transactionIds: z.array(z.string()).min(1).max(200).describe("Array of transaction IDs to check acceptance for"),
  },
  async ({ transactionIds }) => {
    try {
      const results = await getTransactionsAcceptance(transactionIds);
      const formatted = results.map((r) => ({
        txId: r.transactionId,
        accepted: r.accepted,
        acceptingBlockHash: r.acceptingBlockHash ?? null,
        acceptingBlueScore: r.acceptingBlueScore ?? null,
        acceptingTimestamp: r.acceptingTimestamp ? new Date(r.acceptingTimestamp).toISOString() : null,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ results: formatted }, null, 2) }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

// --- Calculate Transaction Mass ---

server.tool(
  "calculate_transaction_mass",
  {
    version: z.number().int().describe("Transaction version"),
    inputs: z.array(z.object({
      previousOutpoint: z.object({
        transactionId: z.string(),
        index: z.number().int(),
      }),
      signatureScript: z.string(),
      sequence: z.number().int(),
      sigOpCount: z.number().int(),
    })).describe("Transaction inputs"),
    outputs: z.array(z.object({
      amount: z.number().int(),
      scriptPublicKey: z.object({
        version: z.number().int(),
        scriptPublicKey: z.string(),
      }),
    })).describe("Transaction outputs"),
    lockTime: z.number().int().optional().describe("Lock time (default 0)"),
    subnetworkId: z.string().optional().describe("Subnetwork ID"),
  },
  async ({ version, inputs, outputs, lockTime, subnetworkId }) => {
    try {
      const result = await calculateTransactionMass({
        version,
        inputs,
        outputs,
        lockTime,
        subnetworkId,
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            mass: result.mass,
            storageMass: result.storage_mass,
            computeMass: result.compute_mass,
          }, null, 2),
        }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

// --- Transaction Count ---

server.tool(
  "get_transaction_count",
  {},
  async () => {
    try {
      const data = await getTransactionCount();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            timestamp: new Date(data.timestamp).toISOString(),
            dateTime: data.dateTime,
            coinbase: data.coinbase,
            regular: data.regular,
            total: data.coinbase + data.regular,
          }, null, 2),
        }],
      };
    } catch (err) {
      return formatError(err);
    }
  },
);

// --- Transaction Count History ---

server.tool(
  "get_transaction_count_history",
  {
    dayOrMonth: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).describe("UTC day (YYYY-MM-DD) or month (YYYY-MM)"),
  },
  async ({ dayOrMonth }) => {
    try {
      const entries = await getTransactionCountHistory(dayOrMonth);
      const formatted = entries.map((e) => ({
        timestamp: new Date(e.timestamp).toISOString(),
        dateTime: e.dateTime,
        coinbase: e.coinbase,
        regular: e.regular,
        total: e.coinbase + e.regular,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify({ dayOrMonth, count: formatted.length, entries: formatted }, null, 2) }],
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
