# Register AI agent on ERC-8004 Identity Registry

---

## Description

Register the `sivel3agent` on the **ERC-8004 Agent Trust Protocol** identity registry on Celo Sepolia, establishing its on-chain identity and reputation. This is a prerequisite for the agent to be recognized as a legitimate autonomous entity in the SIVeL 3 ecosystem and to interact with the `PreAlertMarket.sol` contract as a trusted pre-alert publisher.

ERC-8004 defines an on-chain identity and reputation registry for AI agents. Registration gives the agent a verifiable identity that smart contracts and users can check before interacting with it.

---

## Tasks

### 1. Prepare agent metadata
- [ ] Create an `agent-metadata.json` file following ERC-8004 metadata schema:
  - `name`: `"SIVeL 3 Agent"`
  - `description`: `"AI agent that monitors public sources to detect political violence events and generates pre-alerts for the SIVeL 3 ecosystem"`
  - `type`: Use the spec URI `"https://eips.ethereum.org/EIPS/eip-8004#registration-v1"` (NOT the deprecated `"type": "Agent"`)
  - `services`: Array with at least one entry — `{ "name": "health", "endpoint": "https://sivel3agent.example.com/api/health" }` (NOT the deprecated `endpoints` array with `url`)
  - `agentURI`: Prefer content-addressed `ipfs://` so metadata cannot be silently mutated after registration
- [ ] Upload metadata to IPFS (or use `data:` URI for initial registration)

### 2. Register on ERC-8004 registry
- [ ] Identify the ERC-8004 Identity Registry contract address on Celo Sepolia (check `ai-agents.md` in celopedia-skill or `https://app.ai.self.xyz`)
- [ ] Register the agent via the registry contract using `bin/m wallet:send`:
  ```bash
  ./bin/m wallet:send --name sivel3agent \
    --to <REGISTRY_ADDRESS> \
    --function "registerAgent(string)" \
    --args "<agentURI>" \
    --network celoSepolia
  ```
- [ ] Verify registration by reading back the registered metadata
- [ ] Record the transaction hash and registration timestamp

### 3. Document agent identity
- [ ] Add the agent's ERC-8004 registration address and token ID to `apps/.env`:
  - `AGENT_ERC8004_REGISTRY=<registry contract address>`
  - `AGENT_ERC8004_TOKEN_ID=<assigned token ID>`
- [ ] Update `apps/.env.example` with the new variables
- [ ] Add registration details to `ARCHITECTURE.md` §Architecture Decisions

### 4. Verify integration readiness
- [ ] Confirm `bin/m wallet:list --name sivel3agent --balance` shows sufficient CELO for gas
- [ ] Document how smart contracts (e.g., `PreAlertMarket.sol`) can verify the agent via `isAgent(address)`

---

## Acceptance Criteria

- [ ] Agent metadata is valid per ERC-8004 schema (no deprecated fields)
- [ ] Registration transaction is confirmed on Celo Sepolia Blockscout
- [ ] `AGENT_ERC8004_REGISTRY` and `AGENT_ERC8004_TOKEN_ID` are set in `apps/.env`
- [ ] Agent identity is documented in `ARCHITECTURE.md`

---

## Dependencies

- [x] #1 — Base agent structure (wallet `sivel3agent` with CELO)

---

## Related

- Epic: https://github.com/pasosdeJesus/sivel3/issues/36
- Blocks: #43 (PreAlertMarket.sol contract — needs the agent to be registered before the contract can verify it)
- Reference: celopedia-skill → `ai-agents.md`, ERC-8004 metadata compliance rules
- Registration: https://app.ai.self.xyz

---

## Notes

- **Metadata compliance is enforced**: deprecated patterns (`"type": "Agent"`, `endpoints` array, `url` field, `https://` agentURI) trigger validator warnings. See celopedia-skill §Important Rules §11.
- **Gas**: The agent already has 31.99 S-CELO from issue #1.
- **Registry address**: Must be confirmed from celopedia-skill references or `app.ai.self.xyz` before running the registration command.
