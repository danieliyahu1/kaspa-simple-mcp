# kaspa-simple-mcp

A read-only [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for the Kaspa blockchain mainnet. Lets AI agents query Kaspa data through simple, deterministic tools — no node required.

Built for use with MCP-compatible clients like [OpenCode](https://opencode.ai), Claude, Cursor, and others.

## Features

- **Balance lookup** — get the confirmed KAS balance for any mainnet address
- **Transaction lookup** — get status, timestamp, total value, and top outputs for any transaction
- **Fee estimation** — get the current network priority fee rate

All data comes from the public [api.kaspa.org](https://api.kaspa.org) REST API. No API key needed. Read-only. Mainnet only.

## Installation

### Via npm (recommended)

```bash
npm install -g kaspa-simple-mcp
```

### Via npx (no install)

```bash
npx kaspa-simple-mcp
```

### From source

```bash
git clone https://github.com/danieliyahu1/kaspa-simple-mcp.git
cd kaspa-simple-mcp
npm install
npm run build
npm start
```

## Usage

### MCP client configuration

The server communicates over **stdio**. Configure it as an MCP tool server in your client's settings.

**OpenCode (`opencode.json`):**

```json
{
  "mcp": {
    "kaspa-simple-mcp": {
      "command": "npx",
      "args": ["-y", "kaspa-simple-mcp"]
    }
  }
}
```

**Claude Desktop (`claude_desktop_config.json`):**

```json
{
  "mcpServers": {
    "kaspa": {
      "command": "npx",
      "args": ["-y", "kaspa-simple-mcp"]
    }
  }
}
```

## Tools

### `get_balance`

Get the confirmed KAS balance for a Kaspa mainnet address.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `address` | string | Kaspa mainnet address (e.g., `kaspa:...`) |

**Example response:**

```json
{ "balance": "1250.50000000" }
```

### `get_transaction`

Look up a transaction by its ID.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `txId` | string | 64-char Kaspa transaction ID (hex) |

**Example response:**

```json
{
  "status": "confirmed",
  "timestamp": 1700000000,
  "totalKas": "500.00000000",
  "outputs": [
    { "recipient": "kaspa:...", "amount": "250.00000000" },
    { "recipient": "kaspa:...", "amount": "250.00000000" }
  ]
}
```

If the transaction has more than 5 outputs, a `moreOutputs` field indicates how many were omitted.

### `get_fee_estimate`

Get the current network priority fee rate.

**Parameters:** None

**Example response:**

```json
{ "feerate": "0.00000100" }
```

The fee rate is in KAS/KB — multiply by your estimated transaction size in KB to get the total fee.

## Examples

**Check a balance:**
```
Agent: get_balance for kaspa:qpauqsvk7yf9unexwmxsnmg547mhyga37csh0kj53q6xxgl24ydxjsgzthw5j
Agent: The balance is 100.00000000 KAS.
```

**Look up a transaction:**
```
Agent: get_transaction for b2a4c3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
Agent: Transaction is confirmed with 500 KAS total.
```

**Estimate fees:**
```
Agent: What's the current fee estimate?
Agent: Current priority fee rate is 0.00000100 KAS/KB.
```

## Output characteristics

- All monetary values returned in **KAS** (not sompi), as strings with 8 decimal places
- Responses are **deterministic JSON** structures — easy for LLMs to parse
- Errors include descriptive messages
- No authentication or configuration required

## Development

```bash
# Build
npm run build

# Test against mainnet
node test_integration.mjs
```

## Publishing

```bash
npm login
npm publish
```

Make sure you're logged into the npm registry first. The `prepublishOnly` script runs the TypeScript build automatically.

## License

MIT
