---
title: Register AI agent on-chain (ERC-8004)
labels: smart-contract, onchain, identity
status: closed — Self Agent ID blocked, ERC-8004 basic completed
---

## Outcome

**Self Agent ID (proof-of-human) is not operational.** We attempted registration on both Celo Sepolia (testnet) and Celo Mainnet across multiple sessions, using both the REST API and the web wizard at https://app.ai.self.xyz. **ERC-8004 basic registration completed successfully on Celo Sepolia and Celo Mainnet.**

---

## What We Tried

### Attempt 1: Celo Sepolia — REST API (modes: `wallet-free`, `ed25519`)
- Generated Ed25519 key pair (`AGENT_ED25519_PUBLIC_KEY` + `AGENT_ED25519_PRIVATE_KEY` in `apps/.env`)
- Built `scripts/self-register.py` — challenge request, Ed25519 signing, registration submission, polling loop
- Self API returned QR-ready session successfully
- Human operator scanned QR with Self app (mock passport USA)
- **Result**: Self app showed "Proof Verified" but the browser UI remained stuck at "Waiting for passport scan" and the polling endpoint never advanced beyond `qr-ready`
- Second scan on same session: "Proof Failed"

### Attempt 2: Celo Sepolia — Web Wizard
- Used https://app.ai.self.xyz/agents/register with Ed25519 public key (base64)
- Human operator scanned QR
- **Result**: Same pattern — "Proof Verified" in app, browser stuck, second scan "Proof Failed"

### Attempt 3: Celo Mainnet — Web Wizard
- Same Ed25519 key `MCowBQYDK2VwAyEAc2ocHdz9oIzhVDyN1VGjcHMB+RVoUa429pnMwqW6tew=`
- Guardian: `0x2e2c4ac19c93d0984840cdd8e7f77500e2ef978e` (vtamara.eth, real passport verified)
- Disclosures: 18+
- Human operator scanned QR with Self app (real biometric passport)
- **Result**: "Proof Verified" on app, "Connected to Self" appeared below QR in browser, second scan "Proof Failed"
- **No on-chain transaction** on Celo Mainnet (verified via Blockscout: no tx from vtamara.eth to registry `0xaC3DF9...`)

### Root Cause
Self Agent ID infrastructure has a gap between off-chain ZK proof verification (app) and on-chain transaction submission (relayer/contract). The ZK proof is generated and verified locally, but the mint transaction to `0x043DaCac...` (Sepolia) or `0xaC3DF9...` (Mainnet) never executes. This occurs consistently regardless of network, registration mode, or passport type (mock/real).

---

## What We Completed Instead

### ERC-8004 Basic Registration (Celo Sepolia) ✅

| Field | Value |
|-------|-------|
| Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Token ID | `352` |
| Owner | `0x01a72816110a88883F79026C0199827fCF9184c8` (sivel3 dev wallet) |
| Agent URI | `https://sivel.xyz:9001/agent/sivel3agent-dev.json` |
| Transaction | `0x43c28be25c8d0d170e903391fd03f95c10d2e759b40353ddbfcf82b21b055aaa` |
| Block | `28066909` |

Metadata served at `https://sivel.xyz:9001/agent/sivel3agent-dev.json` is ERC-8004 compliant:
```json
{
  "name": "SIVeL 3 Scout Agent",
  "description": "AI agent that monitors public sources (RSS, APIs) to detect political violence events in some regions. Generates structured pre-alerts following the SIVeL methodology with CINEP's Bank of Data conceptual framework for the SIVeL 3 ecosystem.",
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "version": "1.0.0",
  "agentType": "Scout",
  "ownerAddress": "0x01a72816110a88883F79026C0199827fCF9184c8",
  "services": [
    { "name": "health", "endpoint": "https://sivel.xyz:9001/api/agent/health" },
    { "name": "webhook", "endpoint": "https://sivel.xyz:9001/api/agent/webhook" }
  ],
  "supportedTrust": ["reputation"],
  "createdAt": "2026-06-07T00:00:00Z"
}
```

### Ed25519 Keys Generated ✅
Stored in `apps/.env` — ready for future Self Agent ID retry or other Ed25519-based auth.

### ERC-8004 Basic Registration (Celo Mainnet) ✅

| Field | Value |
|-------|-------|
| Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Token ID | `9330` |
| Owner | `0x9F636E5653b649b44c9375E6E103600AE55aF979` (sivel3 production wallet) |
| Agent URI | `https://sivel.xyz/agent/sivel3agent.json` |
| Transaction | `0xe3d7c6faeb9a90a060a576af79f35d869003c3a47d781d69a5ce1afaff34938a` |
| Block | `69456462` |

Command used:
```bash
./bin/m wallet:send --name sivel3 \
  --to 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 \
  --function "register(string)" \
  --args "https://sivel.xyz/agent/sivel3agent.json" \
  --network celo --rpc https://forno.celo.org
```

---

## Decision

Use **ERC-8004 basic** as the agent's on-chain identity for now. When Self Agent ID stabilizes (relayer fixed, on-chain mint working), we will retry registration. The Ed25519 keys and metadata are already prepared.

**Impact on PreAlertMarket.sol**: The contract should verify agents via `isAgent(address)` on the ERC-8004 registry (`0x8004A818...` on Sepolia, `0x8004A169...` on mainnet) rather than the Self registry. This is a simpler integration and works today.

---

## Related

- Epic: https://github.com/pasosdeJesus/sivel3/issues/36
- Blocks: #43 (PreAlertMarket.sol)
- Self Agent ID docs: https://app.ai.self.xyz/llms.txt
