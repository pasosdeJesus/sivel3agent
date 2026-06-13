---
title: Register AI agent with Self Agent ID (ERC-8004 + proof-of-human)
labels: smart-contract, onchain, identity, reputation
---

## Description

Register the `sivel3agent` using **Self Agent ID** (https://app.ai.self.xyz). This gives the agent:

- An on-chain identity (ERC-8004)
- Proof-of-human (biometric, via passport/ID)
- Sybil resistance (1 human → 1 agent)
- Verifiable credentials (age, OFAC, nationality, etc.)

Unlike a basic ERC-8004 registration (which only stores a URI), Self Agent ID adds a **zero-knowledge proof** that the agent is backed by a real human. No personal data is uploaded – only a cryptographic proof is stored on-chain. The human operator scans a QR code with the Self mobile app, and the app generates the proof on-device using the operator's passport or ID.

This registration is required for the agent to be trusted in the SIVeL 3 ecosystem. Documenters, validators, and citizens will be able to verify that the agent is human-backed before trusting its pre-alerts.

---

## Why Self Agent ID?

| Feature | Basic ERC-8004 | Self Agent ID |
|---------|----------------|---------------|
| On-chain identity | ✅ | ✅ |
| Proof-of-human | ❌ | ✅ (biometric ZK proof) |
| Sybil-resistant | ❌ | ✅ (1 human → 1 agent) |
| Age verification | ❌ | ✅ (18+ or 21+) |
| OFAC/sanctions check | ❌ | ✅ |
| Nationality verification | ❌ | ✅ (optional) |
| Verifiable by any service | 🟡 (only wallet) | ✅ (full credentials) |

For a project documenting political violence, **trust is non-negotiable**. Self Agent ID provides the strongest possible assurance that the agent is operated by a legitimate human from Pasos de Jesús, not a malicious actor.

---

## Registration Mode: `ed25519-linked`

We will use **`ed25519-linked`** mode:

| Parameter | Value | Reason |
|-----------|-------|--------|
| **Agent key type** | Ed25519 | Industry standard for AI agents; secure and widely supported |
| **Guardian wallet** | `0x01a72816110a88883F79026C0199827fCF9184c8` (sivel3 development wallet on Sepolia) | Allows the project to revoke the agent if needed |
| **Network** | Celo Sepolia (testnet) | For hackathon and testing; mainnet registration will follow |
| **Agent URI** | `https://sivel.xyz:9001/agent/sivel3agent-dev.json` | Agent metadata (name, description, services) |

The `linked` mode means the agent's Ed25519 key is registered on-chain, and the guardian wallet (ECDSA) has the power to revoke the agent's identity. This is the recommended pattern for production agents.

---

## Prerequisites

### Human operator requirements

- [ ] Install the **Self app** on iOS or Android from the official app store
- [ ] Complete the one-time identity verification in the Self app:
    - Scan a passport or government ID (biometric)
    - This is done **once per human**, not per agent
    - No personal data is uploaded – a ZK proof is generated on-device
- [ ] Ensure the Self app is ready to scan QR codes (no additional setup required per agent)

### Technical prerequisites

- [ ] Node.js installed (for CLI or SDK)
- [ ] Access to the project's development wallet (`0x01a728...`) – not strictly required for registration, as Self handles the on-chain transaction, but needed if you choose the `linked` mode with a guardian
- [ ] The agent metadata JSON must be publicly accessible at `https://sivel.xyz:9001/agent/sivel3agent-dev.json`

---

## Tasks

### 1. Prepare agent metadata JSON

- [ ] Create `apps/nextjs/public/agent/sivel3agent-dev.json` in the `sivel3` repository with the following content:

```json
{
  "name": "SIVeL 3 Scout Agent",
  "description": "AI agent that autonomously monitors public news sources (RSS, APIs) to detect socio-political violence events in Colombia and Palestine. Generates structured pre-alerts following the CINEP methodology for the SIVeL 3 ecosystem.",
  "version": "1.0.0",
  "agentType": "Scout",
  "owner": "Pasos de Jesús",
  "services": [
    {
      "name": "health",
      "endpoint": "https://sivel.xyz:9001/api/agent/health"
    },
    {
      "name": "pre-alert-sync",
      "endpoint": "https://sivel.xyz:9001/api/pre-alerts/sync"
    }
  ],
  "supportedTrust": ["reputation", "human-backing"],
  "createdAt": "2026-06-13T00:00:00Z"
}
```

- [ ] Verify the file is accessible: `curl https://sivel.xyz:9001/agent/sivel3agent-dev.json`

### 2. Generate Ed25519 key pair for the agent

- [ ] Generate a secure Ed25519 private key:
```bash
# Using OpenSSL
openssl genpkey -algorithm ed25519 -out agent-key.pem
# Extract the public key
openssl pkey -in agent-key.pem -pubout -out agent-pub.pem
# Encode the public key in base64 (required for Self API)
cat agent-pub.pem | grep -v "PUBLIC KEY" | tr -d '\n' | base64
```

- [ ] Store the private key securely (same security level as `~/.m/wallets/` – never commit to git)
- [ ] Record the public key (base64) for the registration step

### 3. Register the agent using Self Agent ID

**Option A: Using the Self CLI (recommended for simplicity)**

```bash
# Install the Self CLI globally (if not already)
npm install -g @selfxyz/cli

# Run registration
self-agent register \
  --mode ed25519-linked \
  --network celoSepolia \
  --guardian-wallet 0x01a72816110a88883F79026C0199827fCF9184c8 \
  --agent-uri https://sivel.xyz:9001/agent/sivel3agent-dev.json \
  --ed25519-private-key <path-to-agent-key.pem> \
  --output registration-info.json
```

The CLI will:
- Generate a challenge
- Sign it with your Ed25519 key
- Submit the registration to Self API
- Output a QR code

**Option B: Using the Self API directly (more control)**

Step 1 – Request a challenge:
```bash
curl -X POST https://app.ai.self.xyz/api/agent/register/ed25519-challenge \
  -H "Content-Type: application/json" \
  -d '{
    "ed25519PublicKey": "<base64-public-key>",
    "network": "celoSepolia"
  }'
```

Step 2 – Sign the challenge (using the Ed25519 private key) – this step requires a small script (see `scripts/sign-challenge.ts` in `sivel3agent`)

Step 3 – Submit registration:
```bash
curl -X POST https://app.ai.self.xyz/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "ed25519-linked",
    "ed25519PublicKey": "<base64-public-key>",
    "ed25519Signature": "<base64-signature>",
    "challengeId": "<challenge-id>",
    "network": "celoSepolia",
    "agentURI": "https://sivel.xyz:9001/agent/sivel3agent-dev.json",
    "guardianWallet": "0x01a72816110a88883F79026C0199827fCF9184c8"
  }'
```

Step 4 – Complete human verification:
- The response will contain a session token and a QR code (as a data URL or text)
- The human operator scans the QR code with the **Self app**
- The app verifies the human's identity (using the already-set-up passport/ID)
- The app generates a ZK proof and submits it to Self
- Self emits the on-chain registration transaction

Step 5 – Poll registration status:
```bash
curl "https://app.ai.self.xyz/api/agent/register/status?sessionToken=<token>"
```

### 4. Verify registration success

- [ ] Confirm the registration transaction appears on Celo Sepolia Blockscout
- [ ] Query the agent's identity:
```bash
# Using the Self API
curl "https://app.ai.self.xyz/api/agent/identify?network=celoSepolia&agentAddress=<agent-ed25519-public-key>"
```
- [ ] Test the agent's verification using the demo endpoint:
```bash
# This requires the agent to sign a request (see SDK documentation)
curl -X POST https://app.ai.self.xyz/api/demo/verify?network=celoSepolia \
  -H "x-self-agent-signature: ..." \
  -H "x-self-agent-timestamp: ..." \
  -H "x-self-agent-key: <base64-public-key>" \
  -H "x-self-agent-keytype: ed25519"
```

### 5. Document the registration

- [ ] Record the following in `ARCHITECTURE.md` (sivel3agent) and `AGENTS.md`:
    - `AGENT_SELF_ID` (the on-chain agent identifier)
    - `AGENT_ED25519_PUBLIC_KEY` (base64)
    - `AGENT_REGISTRATION_TX_HASH`
    - `AGENT_GUARDIAN_WALLET` (`0x01a728...`)
    - `SELF_REGISTRY_ADDRESS` (Celo Sepolia: `0x043DaCac8b0771DD5b444bCC88f2f8BBDBEdd379` – from Self documentation)
- [ ] Add the Ed25519 public key to `apps/.env` (as `AGENT_ED25519_PUBLIC_KEY`)
- [ ] Document the human operator's Self app verification status (which human from Pasos de Jesús completed it)

### 6. (Optional) Test agent-to-agent communication

Once registered, the agent can authenticate itself to any service running the Self verifier:

```typescript
import { SelfAgentClient } from "@selfxyz/agent-sdk";

const agent = new SelfAgentClient({
  privateKey: "<ed25519-private-key>",
  keyType: "ed25519",
  network: "celoSepolia"
});

// Signed request to any service that verifies Self Agent IDs
const response = await agent.fetch("https://some-service.com/api/protected", {
  method: "POST",
  body: JSON.stringify({ preAlertId: 123 })
});
```

---

## Acceptance Criteria

- [ ] Agent metadata JSON is publicly accessible at `https://sivel.xyz:9001/agent/sivel3agent-dev.json`
- [ ] The Self CLI or API registration completes successfully
- [ ] A human operator (from Pasos de Jesús) scans the QR code with the Self app
- [ ] The Self app generates a ZK proof and submits it
- [ ] The on-chain registration transaction is confirmed on Celo Sepolia
- [ ] The agent has proof-of-human (strength ≥ 50, as shown in Self's verification)
- [ ] The guardian wallet (`0x01a728...`) is correctly set in the registry
- [ ] The agent can be verified via Self's demo endpoint or SDK verifier
- [ ] Registration details are documented in `ARCHITECTURE.md` and `AGENTS.md`

---

## Dependencies

- **Human operator**: Requires a human with the Self app installed and passport/ID already verified
- **Technical**: None (this registration is independent of other issues, though it logically follows `sivel3agent#1`)

---

## Related

- Epic: https://github.com/pasosdeJesus/sivel3/issues/36
- Blocks: #43 (PreAlertMarket.sol – the contract can verify the agent via Self)
- Self Agent ID documentation: https://app.ai.self.xyz/llms.txt
- Self Agent ID explorer: https://app.ai.self.xyz

---

## Notes for the Developer

- **This registration is for the agent's identity and reputation, not for transaction signing.** The agent will still use its ECDSA wallet (`0x8C8816...` from `sivel3agent#1`) to call `publishPreAlert` on `PreAlertMarket.sol`. The Ed25519 key is only for authentication and verification services.
- **The human operator must have the Self app ready.** This is a one-time setup per human. Once completed, the human can verify any number of agents by scanning QR codes.
- **Privacy:** No personal data is ever uploaded. The Self app generates a ZK proof on-device. The only on-chain data is the proof and the agent's public key.
- **Sybil resistance:** The same human cannot register unlimited agents. Self enforces 1 human → 1 agent (configurable).
- **Cost:** Registration requires gas on Celo Sepolia (minimal). The agent's guardian wallet must have a small amount of CELO to submit the transaction if using `linked` mode.
- **Fallback:** If the Self API or CLI fails, you can use the **web wizard** at https://app.ai.self.xyz, selecting "Ed25519 + linked wallet" mode. The QR code approach is identical.

---

## Example registration output (expected)

```json
{
  "success": true,
  "agentId": "eip155:11142220:0x8C8816...",
  "transactionHash": "0x...",
  "sessionToken": "abc123",
  "qrCodeData": "https://app.ai.self.xyz/verify?session=abc123",
  "verificationStatus": "pending_human"
}
```

After human scans the QR code:

```json
{
  "success": true,
  "agentId": "eip155:11142220:0x8C8816...",
  "status": "registered",
  "proofOfHuman": {
    "strength": 100,
    "method": "biometric_passport_nfc"
  }
}
