import { spawn } from "child_process";

const serverPath = new URL("./dist/index.js", import.meta.url).pathname;
const proc = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";

proc.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
  console.error("STDOUT_CHUNK:", JSON.stringify(chunk.toString()));
});

proc.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
  console.error("STDERR_CHUNK:", JSON.stringify(chunk.toString()));
});

proc.on("close", (code) => {
  console.error("EXIT CODE:", code);
  console.error("FULL STDOUT:", JSON.stringify(stdout));
  console.error("FULL STDERR:", JSON.stringify(stderr));
  const lines = stdout.trim().split("\n");
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      console.error("PARSED:", JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.error("PARSE_ERROR:", line);
    }
  }
});

const req1 = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
});
proc.stdin.write(req1 + "\n");

const req2 = JSON.stringify({
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {},
});
proc.stdin.write(req2 + "\n");

const req3 = JSON.stringify({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name: "get_fee_estimate", arguments: {} },
});
proc.stdin.write(req3 + "\n");

const exit = JSON.stringify({
  jsonrpc: "2.0",
  method: "notifications/exit",
  params: {},
});
proc.stdin.write(exit + "\n");
proc.stdin.end();

setTimeout(() => {
  proc.kill();
  process.exit(0);
}, 10000);
