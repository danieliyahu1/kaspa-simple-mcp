# kaspa-simple-mcp

A read-only [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for the Kaspa blockchain. Lets AI agents query Kaspa data through simple, deterministic tools — no node required.

Built for use with MCP-compatible clients like [OpenCode](https://opencode.ai), Claude, Cursor, and others.

## Features

- **Balance & UTXOs** — single, batch, and history for balances; single and batch UTXO queries
- **Transactions** — lookup by ID, search, acceptance check, mass calculation, count, and history
- **Addresses** — transactions, UTXOs, count, paginated history, active check, name resolution, distribution, top addresses
- **Blocks** — single block, block range, blocks by blue score, virtual chain
- **Network info** — DAG info, hashrate (current + history + samples), coin supply, price, block reward, halving, kaspad info, virtual chain blue score, health, marketcap, circulating & total supply, max hashrate
- **Fee estimation** — current network priority fee rate

All data comes from the public Kaspa REST API. No API key needed. Read-only.

## Installation

```bash
npm install -g kaspa-simple-mcp
```

Or run directly with npx:

```bash
npx kaspa-simple-mcp
```

## Network configuration

By default the server queries **mainnet**. Set the `KASPA_NETWORK` environment variable to switch:

| Value | API URL |
|---|---|
| `mainnet` (default) | `https://api.kaspa.org` |
| `testnet-10` | `https://api-tn10.kaspa.org` |

### Client configuration examples

**OpenCode (`opencode.json`):**

```json
{
  "mcp": {
    "kaspa-simple-mcp": {
      "command": "npx",
      "args": ["-y", "kaspa-simple-mcp"],
      "env": {
        "KASPA_NETWORK": "testnet-10"
      }
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
      "args": ["-y", "kaspa-simple-mcp"],
      "env": {
        "KASPA_NETWORK": "testnet-10"
      }
    }
  }
}
```

Omit the `env` block to use mainnet.

## Tools reference

### Balance

| Tool | Params | Description |
|------|--------|-------------|
| `get_balance` | `address` | Confirmed KAS balance for an address |
| `get_balances_batch` | `addresses` (array, 1–100) | Balances for up to 100 addresses |
| `get_address_balance_history` | `address`, `dayOrMonth` | Daily or monthly balance history |

### UTXOs

| Tool | Params | Description |
|------|--------|-------------|
| `get_address_utxos` | `address` | UTXOs for an address |
| `get_address_utxo_count` | `address` | UTXO count for an address |
| `get_utxos_batch` | `addresses` (array, 1–100) | UTXOs for up to 100 addresses |

### Transactions

| Tool | Params | Description |
|------|--------|-------------|
| `get_transaction` | `txId` | Transaction status, timestamp, total value, and top outputs |
| `get_address_transactions` | `address`, `limit?`, `offset?` | Recent transactions for an address |
| `get_address_transaction_count` | `address` | Total transaction count for an address |
| `get_address_transactions_page` | `address`, `limit?`, `before?`, `after?` | Cursor-paginated transaction history |
| `search_transactions` | `transactionIds?`, `acceptingBlueScoreGte?`, `acceptingBlueScoreLt?`, `resolvePreviousOutpoints?`, `acceptance?` | Search transactions by ID, blue score, or acceptance |
| `get_transactions_acceptance` | `transactionIds` (array, 1–200) | Check if transactions were accepted |
| `calculate_transaction_mass` | `version`, `inputs`, `outputs`, `lockTime?`, `subnetworkId?` | Compute transaction mass |
| `get_transaction_count` | none | Current total transaction count |
| `get_transaction_count_history` | `dayOrMonth` | Daily or monthly transaction counts |

### Address info

| Tool | Params | Description |
|------|--------|-------------|
| `get_address_name` | `address` | Resolve address name |
| `get_address_names` | none | List all known address names |
| `get_addresses_active` | `addresses` (array, 1–100) | Check if addresses have been active |
| `get_top_addresses` | none | Top addresses by balance |
| `get_address_distribution` | none | Address balance distribution |

### Active addresses

| Tool | Params | Description |
|------|--------|-------------|
| `get_active_addresses_count` | none | Current active address count |
| `get_active_addresses_count_history` | `dayOrMonth` | Daily or monthly active address history |

### Blocks

| Tool | Params | Description |
|------|--------|-------------|
| `get_block` | `blockId`, `includeTransactions?`, `includeColor?` | Block details by hash |
| `get_blocks` | `lowHash`, `includeBlocks?`, `includeTransactions?` | Block hashes from a starting hash |
| `get_blocks_from_bluescore` | `blueScore?`, `blueScoreGte?`, `blueScoreLt?`, `includeTransactions?` | Blocks by blue score |
| `get_virtual_chain` | `blueScoreGte`, `limit?`, `resolveInputs?`, `includeCoinbase?` | Virtual chain blocks from a blue score |

### Network info

| Tool | Params | Description |
|------|--------|-------------|
| `get_blockdag_info` | none | DAG statistics (tips, difficulty, etc.) |
| `get_hashrate` | none | Current network hashrate |
| `get_hashrate_history` | `dayOrMonth` | Daily or monthly hashrate history |
| `get_hashrate_history_samples` | `limit?` | Recent hashrate samples |
| `get_coin_supply` | none | Coin supply details |
| `get_circulating_supply` | none | Circulating supply |
| `get_total_supply` | none | Total supply |
| `get_max_hashrate` | none | Maximum historical hashrate |
| `get_price` | none | Current KAS price |
| `get_marketcap` | none | Current market cap |
| `get_block_reward` | none | Current block reward |
| `get_halving_info` | none | Halving schedule |
| `get_kaspad_info` | none | Kaspad node info |
| `get_virtual_chain_blue_score` | none | Current virtual chain blue score |
| `get_health` | none | API health check |
| `get_fee_estimate` | none | Current priority fee rate |

## Output characteristics

- All monetary values returned in **KAS** (not sompi), as strings with 8 decimal places
- Responses are deterministic JSON — easy for LLMs to parse
- Errors include descriptive messages
- No authentication required

## Development

```bash
npm run build

# Test against mainnet (default)
node test_integration.mjs

# Test against testnet-10
$env:KASPA_NETWORK="testnet-10"; node test_integration.mjs
```

## License

MIT
