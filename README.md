# EmbiPay — Economic Control Plane (MCP)

EmbiPay MCP is the Economic Control Plane for autonomous AI agents.
It enforces delegated economic authority across AI fleets through policy-driven governance, atomic invariants, and scoped tool access.

## What This Is

This MCP server exposes fleet-level economic governance tools:
- **Enforced capital limits** — Fleet budgets with hard caps enforced at database level
- **Policy-based authority controls** — Governance presets (Conservative Enterprise, Controlled Autonomy, Research Mode)
- **Scoped API keys** — Tool-level permissions with revocable keys
- **Rate-limited tool execution** — Per-key rate limiting to prevent abuse
- **Atomic financial invariants** — All mutations enforced in backend via Postgres functions

It does NOT:
- **Custody funds** — EmbiPay is not a bank and does not hold real money
- **Bypass backend invariants** — All enforcement happens in hardened REST APIs
- **Replace database enforcement** — Atomic functions ensure consistency

## Architecture

- **No direct DB access** — All operations go through EmbiPay REST APIs
- **Atomic enforcement preserved** — Uses `update_wallet_balance_atomic`, `fleet_reallocate_atomic`, etc.
- **Policy-aware** — Respects fleet policy templates (overage_policy, allow_reallocate, auto_pause_threshold)
- **Production-safe** — Minimal, focused, error-normalized

## Setup

```bash
cd mcp
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

**Note:** The MCP server no longer uses `EMBIPAY_ADMIN_TOKEN`. Authentication is handled via scoped API keys (see Authentication section below).

## Authentication

The MCP server requires **scoped API keys** for authentication:

- **X-API-Key header** — Required on all requests
- **Tool-level permissions** — Each key is scoped to specific allowed tools
- **Revocable** — Keys can be revoked without affecting others
- **Secure** — Keys are hashed (SHA256) and never stored in plaintext

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

### Available Tool Names

- `get_fleet_status`
- `request_wallet_increase`
- `request_reallocation`
- `approve_overage`
- `get_fleet_policies`

## MCP Tool Specification

All tools are defined with formal JSON Schema (Draft 7 compatible) for MCP compliance:

- **Input validation** — All inputs are validated against JSON Schema before API calls
- **Structured output** — Responses follow consistent schema for MCP compatibility
- **Type safety** — Enforced via schema validation (integers, strings, numbers, required fields)
- **Error details** — Validation errors include detailed schema violation information

Each tool definition includes:
- `name` — Tool identifier
- `description` — Human-readable description
- `input_schema` — JSON Schema for input validation
- `output_schema` — JSON Schema for output structure
- `examples` — Example input/output pairs

## Available Tools

1. **get_fleet_status** — Get fleet budget status (allocated, remaining, total_capital)
2. **request_wallet_increase** — Request wallet balance increase (subject to fleet cap and overage policy)
3. **request_reallocation** — Reallocate balance between wallets (same fleet or both non-fleet)
4. **approve_overage** — Approve a pending fleet overage request
5. **get_fleet_policies** — Get all available fleet policy templates

## Example Usage

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

## Response Format

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

**Rate Limit Error:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retry_after": 45
}
```

## Rate Limiting

The MCP server enforces **per-API-key rate limiting** to prevent abuse:

- **Default limit:** 60 requests per minute per API key
- **Configurable:** Set `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` in `.env`
- **Sliding window:** Uses sliding window algorithm (not fixed window)
- **In-memory:** Rate limit state resets on server restart
- **HTTP 429:** Returns `429 Too Many Requests` when limit exceeded
- **Retry-After:** Response includes `retry_after` seconds until next request allowed

**Note:** This is an in-memory implementation suitable for single-instance deployments. For distributed deployments, upgrade to Redis-backed rate limiting.

## MCP Store Metadata

**Name:**
EmbiPay — Economic Control Plane

**Short Description:**
Enforced delegated economic authority for autonomous AI fleets.

**Category:**
Governance / Infrastructure

**Tags:**
economic-control, ai-governance, fleet-coordination, capital-enforcement, mcp

## Integration Notes

- All operations respect fleet policy templates (Conservative Enterprise, Controlled Autonomy, Research Mode)
- Reallocation is blocked if fleet template has `allow_reallocate: false`
- Wallet increases trigger overage escalation if fleet cap exceeded (per template `overage_policy`)
- Auto-pause by policy threshold runs after successful mutations (application-layer only)
