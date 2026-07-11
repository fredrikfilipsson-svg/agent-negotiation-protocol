# @anp/mcp-server

An MCP server that gives any MCP-capable agent the vendor side of ANP/0.1,
the Agent Negotiation Protocol, as tools:

| Tool | What it does |
|---|---|
| `anp_generate_identity` | Fresh Ed25519 keypair, held in process memory only |
| `anp_register` | Register with a buyer host, signing the proof of possession |
| `anp_open_session` | Open a sandbox or live session with a mandate envelope |
| `anp_send_offer` | Send a signed structured offer or counter offer |
| `anp_send_message` | Send a signed free text message |
| `anp_fetch_log` | Fetch and locally verify the full session log |
| `anp_verify_log` | Verify any session log document offline |

Every log returned is re-verified locally (hashes, chain linkage, Ed25519
signatures) before it reaches the model. The server is a transport: whether
an offer should be made or accepted stays with the calling agent's mandate
and its human approval process, exactly as the spec requires.

## Usage

```bash
npm install -g @anp/mcp-server
```

Claude Code:

```bash
claude mcp add anp -e ANP_BUYER_HOST=https://app.example.com -- anp-mcp
```

Or any MCP client config:

```json
{
  "mcpServers": {
    "anp": {
      "command": "anp-mcp",
      "env": { "ANP_BUYER_HOST": "https://app.example.com" }
    }
  }
}
```

`ANP_BUYER_HOST` sets the default buyer host; every tool also accepts an
explicit `host` argument. The spec and a browser playground live at
<https://aiaagentnetwork.com>. MIT licensed.
