import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "dist", "index.js");

function runTests() {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const received = [];
    let buffer = "";
    let nextId = 1;

    proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const parts = buffer.split("\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        if (!part) continue;
        try {
          received.push(JSON.parse(part));
        } catch { console.error("PARSE_FAIL:", part); }
      }
    });

    let stderrBuf = "";
    proc.stderr.on("data", (chunk) => { stderrBuf += chunk.toString(); });

    function send(method, params = {}) {
      const id = nextId++;
      const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      proc.stdin.write(msg + "\n");
      return id;
    }

    function notify(method, params = {}) {
      const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
      proc.stdin.write(msg + "\n");
    }

    function waitFor(id, timeoutMs = 10000) {
      return new Promise((res, rej) => {
        const start = Date.now();
        function check() {
          const found = received.find((r) => r.id === id);
          if (found) return res(found);
          if (Date.now() - start > timeoutMs) return rej(new Error(`Timeout waiting for id=${id}`));
          setTimeout(check, 100);
        }
        check();
      });
    }

    (async () => {
      try {
        // Phase 1: Initialize
        const initId = send("initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0.0" },
        });
        const initResp = await waitFor(initId);
        if (!initResp?.result?.protocolVersion) throw new Error(`initialize failed: ${JSON.stringify(initResp)}`);
        console.log(`PASS initialize (protocol ${initResp.result.protocolVersion})`);

        // Send initialized notification
        notify("notifications/initialized");
        await new Promise((r) => setTimeout(r, 500));

        // Phase 2: tools/list
        const listId = send("tools/list", {});
        const listResp = await waitFor(listId);
        if (!listResp?.result?.tools) throw new Error(`tools/list failed: ${JSON.stringify(listResp)}`);
        const names = listResp.result.tools.map((t) => t.name).sort();
        console.log(`PASS tools/list → ${names.join(", ")}`);

        // Phase 3: get_fee_estimate
        const feeId = send("tools/call", { name: "get_fee_estimate", arguments: {} });
        const feeResp = await waitFor(feeId);
        if (!feeResp?.result?.content?.[0]?.text) throw new Error(`get_fee_estimate failed: ${JSON.stringify(feeResp)}`);
        const feeData = JSON.parse(feeResp.result.content[0].text);
        if (feeData.feerate === undefined) throw new Error(`get_fee_estimate error: ${feeData.error}`);
        console.log(`PASS get_fee_estimate → ${feeData.feerate} KAS/KB`);

        // Phase 4: get_address_transaction_count
        const txnCountId = send("tools/call", {
          name: "get_address_transaction_count",
          arguments: { address: "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j" },
        });
        const txnCountResp = await waitFor(txnCountId);
        if (!txnCountResp?.result?.content?.[0]?.text) throw new Error(`get_address_transaction_count failed: ${JSON.stringify(txnCountResp)}`);
        const txnCountData = JSON.parse(txnCountResp.result.content[0].text);
        if (txnCountData.totalTransactions === undefined) throw new Error(`get_address_transaction_count error: ${txnCountData.error}`);
        console.log(`PASS get_address_transaction_count → ${txnCountData.totalTransactions} txns`);

        // Phase 5: get_address_utxo_count
        const utxoCountId = send("tools/call", {
          name: "get_address_utxo_count",
          arguments: { address: "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j" },
        });
        const utxoCountResp = await waitFor(utxoCountId);
        if (!utxoCountResp?.result?.content?.[0]?.text) throw new Error(`get_address_utxo_count failed: ${JSON.stringify(utxoCountResp)}`);
        const utxoCountData = JSON.parse(utxoCountResp.result.content[0].text);
        if (utxoCountData.totalUtxos === undefined) throw new Error(`get_address_utxo_count error: ${utxoCountData.error}`);
        console.log(`PASS get_address_utxo_count → ${utxoCountData.totalUtxos} utxos`);

        // Phase 6: get_address_transactions
        const txsId = send("tools/call", {
          name: "get_address_transactions",
          arguments: { address: "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j", limit: 3 },
        });
        const txsResp = await waitFor(txsId);
        if (!txsResp?.result?.content?.[0]?.text) throw new Error(`get_address_transactions failed: ${JSON.stringify(txsResp)}`);
        const txsData = JSON.parse(txsResp.result.content[0].text);
        if (!txsData.transactions || !Array.isArray(txsData.transactions)) throw new Error(`get_address_transactions error: ${txsData.error}`);
        console.log(`PASS get_address_transactions → ${txsData.count} txns returned`);

        // Phase 7: get_balances_batch
        const batchId = send("tools/call", {
          name: "get_balances_batch",
          arguments: {
            addresses: [
              "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j",
              "kaspa:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkx9awp4e",
            ],
          },
        });
        const batchResp = await waitFor(batchId);
        if (!batchResp?.result?.content?.[0]?.text) throw new Error(`get_balances_batch failed: ${JSON.stringify(batchResp)}`);
        const batchData = JSON.parse(batchResp.result.content[0].text);
        if (!Array.isArray(batchData) || batchData.length !== 2) throw new Error(`get_balances_batch error: unexpected result`);
        console.log(`PASS get_balances_batch → ${batchData.length} balances returned`);

        // Phase 8: get_balance
        const balId = send("tools/call", {
          name: "get_balance",
          arguments: { address: "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j" },
        });
        const balResp = await waitFor(balId);
        if (!balResp?.result?.content?.[0]?.text) throw new Error(`get_balance failed: ${JSON.stringify(balResp)}`);
        const balData = JSON.parse(balResp.result.content[0].text);
        if (balData.balance === undefined) throw new Error(`get_balance error: ${balData.error}`);
        console.log(`PASS get_balance → ${balData.balance} KAS`);

        // Phase 9: get_address_balance_history
        const balHistId = send("tools/call", {
          name: "get_address_balance_history",
          arguments: { address: "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j", dayOrMonth: "2025-01" },
        });
        const balHistResp = await waitFor(balHistId);
        if (!balHistResp?.result?.content?.[0]?.text) throw new Error(`get_address_balance_history failed: ${JSON.stringify(balHistResp)}`);
        const balHistData = JSON.parse(balHistResp.result.content[0].text);
        if (!balHistData.history || !Array.isArray(balHistData.history)) throw new Error(`get_address_balance_history error: missing history array`);
        console.log(`PASS get_address_balance_history → ${balHistData.history.length} entries`);

        // Phase 10: get_utxos_batch
        const utxoBatchId = send("tools/call", {
          name: "get_utxos_batch",
          arguments: {
            addresses: [
              "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j",
            ],
          },
        });
        const utxoBatchResp = await waitFor(utxoBatchId);
        if (!utxoBatchResp?.result?.content?.[0]?.text) throw new Error(`get_utxos_batch failed: ${JSON.stringify(utxoBatchResp)}`);
        const utxoBatchData = JSON.parse(utxoBatchResp.result.content[0].text);
        const addrKey = "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j";
        if (!utxoBatchData[addrKey]) throw new Error(`get_utxos_batch error: address not found in response`);
        console.log(`PASS get_utxos_batch → ${utxoBatchData[addrKey].totalUtxos} utxos`);

        // Phase 11: get_address_transactions_page
        const txsPageId = send("tools/call", {
          name: "get_address_transactions_page",
          arguments: { address: "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j", limit: 3 },
        });
        const txsPageResp = await waitFor(txsPageId);
        if (!txsPageResp?.result?.content?.[0]?.text) throw new Error(`get_address_transactions_page failed: ${JSON.stringify(txsPageResp)}`);
        const txsPageData = JSON.parse(txsPageResp.result.content[0].text);
        if (!txsPageData.transactions || !Array.isArray(txsPageData.transactions)) throw new Error(`get_address_transactions_page error: missing transactions`);
        console.log(`PASS get_address_transactions_page → ${txsPageData.count} txns, nextBefore: ${txsPageData.nextBefore}`);

        // Phase 12: get_addresses_active
        const activeId = send("tools/call", {
          name: "get_addresses_active",
          arguments: {
            addresses: [
              "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j",
            ],
          },
        });
        const activeResp = await waitFor(activeId);
        if (!activeResp?.result?.content?.[0]?.text) throw new Error(`get_addresses_active failed: ${JSON.stringify(activeResp)}`);
        const activeData = JSON.parse(activeResp.result.content[0].text);
        if (!activeData.results || !Array.isArray(activeData.results)) throw new Error(`get_addresses_active error: missing results`);
        console.log(`PASS get_addresses_active → ${activeData.results.length} results`);

        // Done
        notify("notifications/exit");
        console.log(`\nAll 12 tests passed. Server works correctly against Kaspa mainnet.`);
        proc.stdin.end();
        resolve();
      } catch (err) {
        console.error(`\nFAILED: ${err.message}`);
        if (stderrBuf) console.error("STDERR:", stderrBuf);
        proc.kill();
        reject(err);
      }
    })();
  });
}

runTests().catch((err) => process.exit(1));
