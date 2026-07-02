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

        // Phase 4: get_balance
        const balId = send("tools/call", {
          name: "get_balance",
          arguments: { address: "kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j" },
        });
        const balResp = await waitFor(balId);
        if (!balResp?.result?.content?.[0]?.text) throw new Error(`get_balance failed: ${JSON.stringify(balResp)}`);
        const balData = JSON.parse(balResp.result.content[0].text);
        if (balData.balance === undefined) throw new Error(`get_balance error: ${balData.error}`);
        console.log(`PASS get_balance → ${balData.balance} KAS`);

        // Done
        notify("notifications/exit");
        console.log(`\nAll 4 tests passed. Server works correctly against Kaspa mainnet.`);
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
