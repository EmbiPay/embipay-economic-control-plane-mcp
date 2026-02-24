# EmbiPay — Economic Control Plane (MCP)

![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-success)

EmbiPay is the Economic Control Plane for autonomous AI systems.
This MCP server exposes enforced economic authority, fleet-level capital controls, and governance policies to AI agents through structured, validated tools.

## Why This Exists

Autonomous AI agents can spend, allocate, and coordinate capital.

Without enforced economic authority:
- Agents compete for shared resources
- Budget overruns occur
- Capital coordination breaks
- Human oversight disappears

EmbiPay enforces:
- Fleet-level capital ceilings
- Policy-based overage approval
- Atomic financial invariants
- Scoped economic authority per agent

## What This MCP Server Provides

- Fleet status retrieval
- Wallet increase requests
- Atomic reallocations
- Overage approval flows
- Fleet policy inspection

All requests:
- Schema validated (JSON Schema)
- Rate limited per API key
- Scoped via tool-level permissions
- Enforced by atomic backend invariants

## Security Model

- Scoped MCP API keys
- Tool-level permission enforcement
- In-memory rate limiting (v1)
- No service-role tokens
- No database access
- Backend invariants enforced via atomic Postgres functions

## Rate Limiting

Default: 60 requests per minute per API key

Configurable via:
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`

Returns HTTP 429 when exceeded.

In-memory implementation (upgradeable to Redis).

## Installation

```bash
git clone https://github.com/your-org/embipay-economic-control-plane-mcp.git
cd embipay-economic-control-plane-mcp
npm install
cp .env.example .env
# Edit .env with your EMBIPAY_API_URL
npm start
```

## Environment Variables

- `EMBIPAY_API_URL` — Base URL of EmbiPay Dashboard API (e.g., `http://localhost:3000`)
- `PORT` — Server port (default: 4001)
- `RATE_LIMIT_WINDOW_MS` — Rate limit window in milliseconds (default: 60000 = 1 minute)
- `RATE_LIMIT_MAX` — Maximum requests per window per API key (default: 60)

## MCP Tool Specification

All tools are defined with formal JSON Schema (Draft 7 compatible) for MCP compliance:

- **Input validation** — All inputs are validated against `input_schema` before API calls
- **Structured output** — Responses follow consistent `output_schema` for MCP compatibility
- **Type safety** — Enforced via schema validation (integers, strings, numbers, required fields)
- **Structured errors** — Validation errors include detailed schema violation information
- **Example payloads** — Each tool includes example input/output pairs

### Available Tools

1. **get_fleet_status** — Get fleet budget status (allocated, remaining, total_capital)
2. **request_wallet_increase** — Request wallet balance increase (subject to fleet cap and overage policy)
3. **request_reallocation** — Reallocate balance between wallets (same fleet or both non-fleet)
4. **approve_overage** — Approve a pending fleet overage request
5. **get_fleet_policies** — Get all available fleet policy templates

### Creating an MCP API Key

Admin users can create scoped API keys via the backend:

```bash
curl -X POST http://localhost:3000/api/admin/create-mcp-key \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Read-only MCP key",
    "allowed_tools": ["get_fleet_status", "get_fleet_policies"]
  }'
```

Response includes the plaintext key **only once** (never stored):

```json
{
  "success": true,
  "api_key": "abc123...",
  "key_info": {
    "id": "...",
    "name": "Read-only MCP key",
    "allowed_tools": ["get_fleet_status", "get_fleet_policies"],
    "created_at": "..."
  }
}
```

**Save the `api_key` immediately** — it cannot be retrieved later.

### Example Usage

**All requests require X-API-Key header:**

```bash
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_MCP_API_KEY" \
  -d '{
    "tool": "get_fleet_status",
    "input": { "fleet_id": "UUID_HERE" }
  }'
```

```bash
curl -X POST http://localhost:4001/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_MCP_API_KEY" \
  -d '{
    "tool": "request_wallet_increase",
    "input": {
      "agent_id": 123,
      "balance": 1000,
      "note": "MCP request"
    }
  }'
```

### Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "status": 400,
  "error": "Error message"
}
```

**Authentication Errors:**
- `401 Unauthorized` — Missing or invalid API key, or key is revoked
- `403 Forbidden` — API key does not have permission for the requested tool
- `429 Too Many Requests` — Rate limit exceeded (see Rate Limiting section)

## Architecture

```
LLM → MCP → EmbiPay REST API → Atomic DB invariants
```

- **No direct DB access** — All operations go through EmbiPay REST APIs
- **Atomic enforcement preserved** — Uses `update_wallet_balance_atomic`, `fleet_reallocate_atomic`, etc.
- **Policy-aware** — Respects fleet policy templates (overage_policy, allow_reallocate, auto_pause_threshold)
- **Production-safe** — Minimal, focused, error-normalized

## Integration Notes

- All operations respect fleet policy templates (Conservative Enterprise, Controlled Autonomy, Research Mode)
- Reallocation is blocked if fleet template has `allow_reallocate: false`
- Wallet increases trigger overage escalation if fleet cap exceeded (per template `overage_policy`)
- Auto-pause by policy threshold runs after successful mutations (application-layer only)

## License

MIT
