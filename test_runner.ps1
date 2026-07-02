using System.Diagnostics;

var psi = new ProcessStartInfo("node", "dist/index.js") {
    RedirectStandardInput = true,
    RedirectStandardOutput = true,
    RedirectStandardError = true,
    UseShellExecute = false
};
var proc = new Process();
proc.StartInfo = psi;
proc.Start();

var requests = @'{""jsonrpc"":""2.0"",""id"":1,""method"":""initialize"",""params"":{""protocolVersion"":""2024-11-05"",""capabilities"":{},""clientInfo"":{""name"":""test"",""version"":""1.0.0""}}}
{"jsonrpc"":""2.0"",""id"":2,""method"":""tools/list"",""params"":{}}
{"jsonrpc"":""2.0"",""id"":3,""method"":""notifications/exit"",""params"":{}}';

proc.StandardInput.WriteLine(requests);
proc.StandardInput.Flush();
proc.WaitForExit(5000);

string stdout = proc.StandardOutput.ReadToEnd();
string stderr = proc.StandardError.ReadToEnd();
Console.WriteLine($""=== STDOUT ===\n{stdout}"");
Console.WriteLine($""=== STDERR ===\n{stderr}"");
