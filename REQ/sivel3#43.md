---
title: Implement PreAlertMarket.sol with multi‑token payments and configurable distribution
labels: smart-contract, onchain, security
---

## Description

Implement `PreAlertMarket.sol` — the on-chain marketplace for AI‑generated pre‑alerts. The contract supports:

- **Multiple payment tokens** (USDT, COPm, SLEARN, and future tokens) with **configurable token prices** (USD-based)
- **Automatic fund distribution** to multiple wallets (e.g., CINEP, documenters, restoration fund, church fund) with **configurable percentages**
- **Premium SBT check** for SLEARN payments (must have at least one premium course SBT from learn.tg)
- **Rate limiting** for alert conversions (1 per wallet per day)
- **Pausability** for emergencies

The contract uses **OpenZeppelin AccessControl** for role management.

**SLEARN transfers:** The contract transfers SLEARN directly to recipients (no burning or USDT conversion on-chain). Recipients can convert SLEARN to USDT off-chain using the SLEARN contract's `redeemForSLE` function or by selling on the market.

**Important:** The `PreAlertMarket` address must be authorized in the SLEARN contract (`addAuthorizedTransfer`) after deployment; otherwise, all SLEARN transfers will revert.

---

## Role Design

| Role | Who holds it? | What can it do? |
|------|---------------|-----------------|
| **`DEFAULT_ADMIN_ROLE`** | `sivel3` main wallet (owner) | Grant/revoke roles, pause/unpause, update payment tokens & prices, update fund distribution, withdraw any stuck funds |
| **`AGENT_ROLE`** | AI agent wallet (`0x8C88169977c180f6380C01daAA9c7F31894c20dc` on Sepolia, production wallet on Mainnet) | Call `publishPreAlert` |
| **`PRICE_MANAGER_ROLE`** | `sivel3` backend (or a dedicated wallet) | Update token prices (oracle integration) |
| **`DISTRIBUTION_MANAGER_ROLE`** | `sivel3` backend or admin | Update fund distribution recipients and percentages |

---

## Contract Features

| Feature | Implementation |
|---------|----------------|
| **Publish pre‑alert** | `publishPreAlert(bytes32 eventHash, bytes32 locationHash, uint256 timestamp)` – only `AGENT_ROLE` |
| **Buy pre‑alert** | `buyPreAlert(uint256 preAlertId, address paymentToken)` – any wallet pays equivalent of $1.00 USD in supported tokens |
| **Token prices** | `setTokenPrice(address token, uint256 price)` – price = how many USD (6 decimals) equals 1 unit of the token |
| **Convert to alert** | `convertToAlert(uint256 preAlertId, string calldata additionalData)` – rate limited (1 per 24h per wallet) |
| **Fund distribution** | `setDistribution(address[] calldata recipients, uint256[] calldata percentages)` – percentages sum to 100% |
| **SLEARN validation** | Check caller has at least one premium SBT from learn.tg (via `PasosDeJesusCredentials.balanceOf`) |
| **Pausability** | Inherit from OpenZeppelin `Pausable` – only `DEFAULT_ADMIN_ROLE` |
| **Events** | `PreAlertPublished`, `PreAlertBought`, `AlertConverted`, `TokenPriceUpdated`, `DistributionUpdated` |

---

## Payment Flow

1. **Backend fetches token prices** from an oracle (or uses fixed rates for MVP)
2. **Backend calls `setTokenPrice(token, price)`** on the contract for each token (only `PRICE_MANAGER_ROLE`)
3. **User calls `buyPreAlert(preAlertId, paymentToken)`** with the token they want to pay
4. **Contract calculates required amount:** `requiredAmount = (USD_REFERENCE_UNITS * 10**decimals) / tokenPrice`
5. **Contract transfers tokens** from user to itself
6. **Contract distributes tokens** to pre‑configured recipients (same token as received)
7. **Event emitted** with `tokenPriceUsed` for transparency

### Price examples (based on 1 USDT ≈ 22 SLEARN)

| Token | Decimals | Price (USD per unit) | tokenPrice (6 decimals) | requiredAmount for $1 |
|-------|----------|---------------------|------------------------|----------------------|
| USDT | 6 | 1.00 | 1_000_000 | 1.000000 USDT |
| SLEARN | 2 | 0.04545 | 45_450 | 22.00 SLEARN |
| COPm | 6 | 0.00025 | 250 | 4000.000000 COPm |

---

## Contract Code

```solidity
// SPDX-License-Identifier: ISC
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PreAlertMarket
 * @dev Marketplace for AI‑generated pre‑alerts with multi‑token payments,
 *      configurable token prices, and automatic fund distribution.
 *      Uses OpenZeppelin AccessControl.
 */
contract PreAlertMarket is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Roles -------------------------------------------------
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant PRICE_MANAGER_ROLE = keccak256("PRICE_MANAGER_ROLE");
    bytes32 public constant DISTRIBUTION_MANAGER_ROLE = keccak256("DISTRIBUTION_MANAGER_ROLE");

    // --- Constants ---------------------------------------------
    // Reference: 1 USD = 1_000_000 units (6 decimals)
    uint256 public constant USD_REFERENCE_UNITS = 1_000_000;

    // --- State variables ---------------------------------------
    address public immutable credentialContract; // PasosDeJesusCredentials

    // Token configuration
    struct TokenConfig {
        uint256 tokenPrice;  // How many USD (6 decimals) equals 1 unit of this token
        uint8 decimals;      // Token decimals (USDT/COPm = 6, SLEARN = 2)
        bool isActive;
    }
    mapping(address => TokenConfig) public paymentTokens;
    address[] public activePaymentTokens;

    // Fund distribution
    address[] public distributionRecipients;
    uint256[] public distributionPercentages; // Sum must be 100

    // Pre-alerts
    uint256 public preAlertCounter;
    mapping(uint256 => PreAlert) public preAlerts;

    // Rate limiting
    mapping(address => uint256) public lastConversionTimestamp;

    struct PreAlert {
        bytes32 eventHash;
        bytes32 locationHash;
        uint256 timestamp;
        address publisher;
        bool isActive;
        uint256 boughtCount;
    }

    // --- Events ------------------------------------------------
    event PreAlertPublished(
        uint256 indexed preAlertId,
        bytes32 eventHash,
        bytes32 locationHash,
        uint256 timestamp,
        address publisher
    );
    event PreAlertBought(
        uint256 indexed preAlertId,
        address indexed buyer,
        address paymentToken,
        uint256 amountPaid,
        uint256 tokenPriceUsed,
        uint256 usdValue
    );
    event AlertConverted(
        uint256 indexed preAlertId,
        address indexed converter,
        string additionalData
    );
    event TokenPriceUpdated(address indexed token, uint256 newPrice);
    event DistributionUpdated(address[] recipients, uint256[] percentages);
    event PaymentTokenAdded(address indexed token, uint8 decimals);
    event PaymentTokenDeactivated(address indexed token);

    // --- Constructor -------------------------------------------
    constructor(address _credentialContract, address _agentWallet) {
        require(_credentialContract != address(0), "Invalid credential contract");
        require(_agentWallet != address(0), "Invalid agent wallet");

        credentialContract = _credentialContract;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AGENT_ROLE, _agentWallet);
    }

    // --- Modifiers ---------------------------------------------
    modifier onlyAgent() {
        require(hasRole(AGENT_ROLE, msg.sender), "PreAlertMarket: not AGENT_ROLE");
        _;
    }

    modifier onlyPriceManager() {
        require(hasRole(PRICE_MANAGER_ROLE, msg.sender), "PreAlertMarket: not PRICE_MANAGER_ROLE");
        _;
    }

    modifier onlyDistributionManager() {
        require(hasRole(DISTRIBUTION_MANAGER_ROLE, msg.sender), "PreAlertMarket: not DISTRIBUTION_MANAGER_ROLE");
        _;
    }

    modifier rateLimit(address wallet) {
        require(
            block.timestamp >= lastConversionTimestamp[wallet] + 1 days,
            "PreAlertMarket: rate limit (1 conversion per day)"
        );
        _;
    }

    // --- Agent functions ---------------------------------------
    function publishPreAlert(
        bytes32 eventHash,
        bytes32 locationHash,
        uint256 timestamp
    ) external onlyAgent whenNotPaused {
        require(eventHash != bytes32(0), "eventHash cannot be empty");
        require(locationHash != bytes32(0), "locationHash cannot be empty");
        require(timestamp <= block.timestamp, "timestamp cannot be in future");

        preAlertCounter++;
        preAlerts[preAlertCounter] = PreAlert({
            eventHash: eventHash,
            locationHash: locationHash,
            timestamp: timestamp,
            publisher: msg.sender,
            isActive: true,
            boughtCount: 0
        });

        emit PreAlertPublished(preAlertCounter, eventHash, locationHash, timestamp, msg.sender);
    }

    // --- Citizen functions -------------------------------------
    function buyPreAlert(uint256 preAlertId, address paymentToken)
        external
        nonReentrant
        whenNotPaused
    {
        require(preAlertId > 0 && preAlertId <= preAlertCounter, "Invalid preAlertId");
        require(preAlerts[preAlertId].isActive, "PreAlert not active");

        TokenConfig memory config = paymentTokens[paymentToken];
        require(config.isActive, "Payment token not supported");

        // Special handling for SLEARN: require premium SBT
        if (_isSlearnToken(paymentToken)) {
            require(_hasAnyPremiumSBT(msg.sender), "SLEARN requires premium SBT from learn.tg");
        }

        // Calculate required amount: (USD_REFERENCE_UNITS * 10**decimals) / tokenPrice
        uint256 requiredAmount = (USD_REFERENCE_UNITS * (10 ** config.decimals)) / config.tokenPrice;
        
        // Transfer tokens from buyer to this contract
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), requiredAmount);

        // Distribute funds according to configured percentages
        _distributeFunds(paymentToken, requiredAmount);

        // Update pre-alert state
        preAlerts[preAlertId].boughtCount++;

        emit PreAlertBought(
            preAlertId,
            msg.sender,
            paymentToken,
            requiredAmount,
            config.tokenPrice,
            USD_REFERENCE_UNITS
        );
    }

    function convertToAlert(uint256 preAlertId, string calldata additionalData)
        external
        rateLimit(msg.sender)
        whenNotPaused
    {
        require(preAlertId > 0 && preAlertId <= preAlertCounter, "Invalid preAlertId");
        require(preAlerts[preAlertId].isActive, "PreAlert not active");

        preAlerts[preAlertId].isActive = false;
        lastConversionTimestamp[msg.sender] = block.timestamp;

        emit AlertConverted(preAlertId, msg.sender, additionalData);
    }

    // --- Internal functions ------------------------------------
    function _distributeFunds(address token, uint256 amount) internal {
        require(distributionRecipients.length == distributionPercentages.length, "Invalid distribution config");
        require(distributionRecipients.length > 0, "No distribution recipients configured");

        for (uint256 i = 0; i < distributionRecipients.length; i++) {
            uint256 share = (amount * distributionPercentages[i]) / 100;
            if (share > 0) {
                IERC20(token).safeTransfer(distributionRecipients[i], share);
            }
        }
    }

    function _hasAnyPremiumSBT(address wallet) internal view returns (bool) {
        IPasosDeJesusCredentials cred = IPasosDeJesusCredentials(credentialContract);
        uint256 nextId = cred.nextTokenId();
        
        for (uint256 i = 1; i < nextId; i++) {
            if (cred.isPremiumCourse(i) && cred.balanceOf(wallet, i) > 0) {
                return true;
            }
        }
        return false;
    }

    function _isSlearnToken(address token) internal view returns (bool) {
        // SLEARN addresses on Sepolia and Mainnet
        return (token == 0x9fBa3A2Ca0275c4D7A3eA341923f8c531e913BFA ||  // Sepolia
                token == 0x27fd41Bea85C39254f2B12789eB37a1543152CC1);   // Mainnet
    }

    // --- Admin: Payment token management -----------------------
    function addPaymentToken(address token, uint8 decimals, uint256 initialPrice)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(token != address(0), "Invalid token address");
        require(!paymentTokens[token].isActive, "Token already exists");
        require(initialPrice > 0, "Price must be > 0");
        
        paymentTokens[token] = TokenConfig({
            tokenPrice: initialPrice,
            decimals: decimals,
            isActive: true
        });
        activePaymentTokens.push(token);
        
        emit PaymentTokenAdded(token, decimals);
        emit TokenPriceUpdated(token, initialPrice);
    }

    function setTokenPrice(address token, uint256 newPrice)
        external
        onlyPriceManager
    {
        require(paymentTokens[token].isActive, "Token not active");
        require(newPrice > 0, "Price must be > 0");
        
        paymentTokens[token].tokenPrice = newPrice;
        emit TokenPriceUpdated(token, newPrice);
    }

    function deactivatePaymentToken(address token)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(paymentTokens[token].isActive, "Token not active");
        paymentTokens[token].isActive = false;
        
        emit PaymentTokenDeactivated(token);
    }

    // --- Admin: Distribution management ------------------------
    function setDistribution(address[] calldata recipients, uint256[] calldata percentages)
        external
        onlyDistributionManager
    {
        require(recipients.length == percentages.length, "Array length mismatch");
        require(recipients.length > 0, "At least one recipient");
        
        uint256 totalPercent = 0;
        for (uint256 i = 0; i < percentages.length; i++) {
            totalPercent += percentages[i];
            require(recipients[i] != address(0), "Invalid recipient address");
        }
        require(totalPercent == 100, "Percentages must sum to 100");
        
        distributionRecipients = recipients;
        distributionPercentages = percentages;
        
        emit DistributionUpdated(recipients, percentages);
    }

    // --- Admin: Agent wallet management ------------------------
    function setAgentWallet(address newAgentWallet)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(newAgentWallet != address(0), "Invalid agent wallet");
        
        address currentAgent = getRoleMember(AGENT_ROLE, 0);
        if (currentAgent != address(0)) {
            revokeRole(AGENT_ROLE, currentAgent);
        }
        grantRole(AGENT_ROLE, newAgentWallet);
    }

    // --- Admin: Emergency --------------------------------------
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // In case of stuck funds (e.g., from direct transfers)
    function withdrawTokens(address token, uint256 amount, address to)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        IERC20(token).safeTransfer(to, amount);
    }
}

interface IPasosDeJesusCredentials {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function isPremiumCourse(uint256 tokenId) external view returns (bool);
    function nextTokenId() external view returns (uint256);
}
```

---

## Deployment Tasks

### 1. Environment variables

Add to `apps/.env`:

```bash
# Credential contract (PasosDeJesusCredentials)
NEXT_PUBLIC_CREDENTIAL_CONTRACT_SEPOLIA=0x593f4486Fc7F3403e01a9c71E90ceE5DaD84A439
NEXT_PUBLIC_CREDENTIAL_CONTRACT_MAINNET=<pending>

# Payment tokens (Sepolia)
NEXT_PUBLIC_USDT_SEPOLIA=0x...   # USDT adapter on Celo Sepolia
NEXT_PUBLIC_COPM_SEPOLIA=0x...   # COPm token address
NEXT_PUBLIC_SLEARN_SEPOLIA=0x9fBa3A2Ca0275c4D7A3eA341923f8c531e913BFA

# Payment tokens (Mainnet)
NEXT_PUBLIC_SLEARN_MAINNET=0x27fd41Bea85C39254f2B12789eB37a1543152CC1
NEXT_PUBLIC_USDT_MAINNET=0x...   # USDT adapter on Celo Mainnet
NEXT_PUBLIC_COPM_MAINNET=0x...   # COPm mainnet address

# Agent wallet (from sivel3agent#1)
AGENT_WALLET_SEPOLIA=0x8C88169977c180f6380C01daAA9c7F31894c20dc
AGENT_WALLET_MAINNET=<production agent wallet>
```

### 2. Deployment script

`apps/hardhat/deploy/02_deploy_pre_alert_market.js`:

```javascript
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const network = hre.network.name;

  const credentialContract = network === 'celoSepolia' 
    ? process.env.NEXT_PUBLIC_CREDENTIAL_CONTRACT_SEPOLIA
    : process.env.NEXT_PUBLIC_CREDENTIAL_CONTRACT_MAINNET;
  
  const agentWallet = network === 'celoSepolia'
    ? process.env.AGENT_WALLET_SEPOLIA
    : process.env.AGENT_WALLET_MAINNET;

  await deploy("PreAlertMarket", {
    from: deployer,
    args: [credentialContract, agentWallet],
    log: true,
    waitConfirmations: 1,
  });
};
module.exports.tags = ["PreAlertMarket"];
```

### 3. Post-deployment configuration script

`apps/hardhat/scripts/configure-pre-alert-market.js`:

```javascript
// After deployment, run this script to configure the contract

// Add payment tokens
await preAlertMarket.addPaymentToken(usdtAddress, 6, 1_000_000);      // 1 USDT = 1 USD
await preAlertMarket.addPaymentToken(copmAddress, 6, 250);            // 4000 COPm = 1 USD (1 COPm = 0.00025 USD)
await preAlertMarket.addPaymentToken(slearnAddress, 2, 45_450);       // 22 SLEARN = 1 USD (1 SLEARN = 0.04545 USD)

// Set distribution (percentages must sum to 100)
const recipients = [
  "0xCINEP...",           // Banco de Datos del CINEP
  "0xPasosJesus...",      // Pasos de Jesús (operator)
  "0xDocumenters...",     // Documenters fund
  "0xRestoration...",     // Restoration fund (victims)
  "0xChurches...",        // Church fund
  "0xReinvestment..."     // Reinvestment
];
const percentages = [20, 30, 30, 5, 5, 10];

await preAlertMarket.setDistribution(recipients, percentages);

// Grant PRICE_MANAGER_ROLE to backend wallet
await preAlertMarket.grantRole(PRICE_MANAGER_ROLE, backendWallet);

// Grant DISTRIBUTION_MANAGER_ROLE to backend wallet
await preAlertMarket.grantRole(DISTRIBUTION_MANAGER_ROLE, backendWallet);
```

### 4. Authorize PreAlertMarket in SLEARN contract (CRITICAL)

**This step is required.** Without it, all SLEARN transfers will revert with:
`SLEARN: neither sender nor receiver authorized`

```bash
# Using cast (foundry)
cast send $SLEARN_ADDRESS \
  "addAuthorizedTransfer(address)" \
  $PRE_ALERT_MARKET_ADDRESS \
  --private-key $ADMIN_PRIVATE_KEY \
  --rpc-url $RPC_URL
```

Alternatively, if the SLEARN contract is managed via `bin/m`:

```bash
cd apps/nextjs
./bin/m slearn:add-authorized --address $PRE_ALERT_MARKET_ADDRESS
```

---

## Acceptance Criteria

- [ ] Contract compiles without warnings (Solidity 0.8.20)
- [ ] OpenZeppelin roles correctly assigned
- [ ] Agent can publish pre‑alert (only `AGENT_ROLE`)
- [ ] Citizen can buy pre‑alert with USDT, COPm, or SLEARN (SLEARN requires premium SBT)
- [ ] Token prices can be updated by `PRICE_MANAGER_ROLE`
- [ ] Distribution recipients and percentages can be updated by `DISTRIBUTION_MANAGER_ROLE`
- [ ] Funds are automatically distributed to configured recipients upon purchase
- [ ] SLEARN transfers succeed only after `addAuthorizedTransfer` is called on SLEARN contract
- [ ] Rate limiting works (1 conversion per day per wallet)
- [ ] Contract is pausable by admin
- [ ] All events are emitted correctly
- [ ] Contract verified on Celo Sepolia Blockscout

---

## Dependencies

- **Requires from `sivel3agent#1`:** Agent wallet address (`0x8C8816...`)
- **Requires from #45:** Agent registration (for documentation only)
- **Requires external:** Credential contract addresses (provided above)
- **Requires external:** USDT, COPm token addresses on Celo Sepolia/Mainnet
- **Requires external:** SLEARN contract authorization (post-deployment step)

---

## Related Issues

- Epic: [#36](https://github.com/pasosdeJesus/sivel3/issues/36)
- Predecessor: #45 (agent registration)
- Blocks: #44 (API endpoints for pre‑alerts), #41 (COPm/SLEARN payments)

---

## Notes for the Developer

- **Token price precision:** All prices use 6 decimals (1 USD = 1_000_000 reference units).
- **SLEARN decimals:** SLEARN has 2 decimals (cents). The `addPaymentToken` function receives `decimals = 2`.
- **SLEARN authorization:** Remember to authorize the `PreAlertMarket` address in the SLEARN contract **immediately after deployment**. This is a one-time operation.
- **Distribution:** All recipients receive the **same token** that the user paid. For MVP this is acceptable.
- **Premium SBT check:** The contract iterates over all tokenIds to find premium courses. This is gas-inefficient for large numbers of courses. For production, consider caching the list of premium tokenIds.
- **Oracle integration:** The backend should fetch token prices from a reliable oracle (e.g., Chainlink, or a simple fixed rate for MVP) and call `setTokenPrice` periodically.
- **Testnet first:** Deploy on Celo Sepolia first, verify all functionality, then deploy on Celo Mainnet.
- **Gas costs:** On Sepolia, deployment and interactions are cheap. On Mainnet, ensure the agent wallet has sufficient CELO for `publishPreAlert` gas.

---

## Testing Checklist

- [ ] Unit test: `publishPreAlert` from agent wallet succeeds
- [ ] Unit test: `publishPreAlert` from non-agent wallet reverts
- [ ] Unit test: `buyPreAlert` with USDT calculates correct amount
- [ ] Unit test: `buyPreAlert` with SLEARN calculates correct amount (22 SLEARN for $1)
- [ ] Unit test: `buyPreAlert` with SLEARN without premium SBT reverts
- [ ] Unit test: `buyPreAlert` with COPm calculates correct amount
- [ ] Unit test: Funds distribution sends correct percentages to recipients
- [ ] Unit test: `convertToAlert` succeeds once per wallet per day
- [ ] Unit test: `convertToAlert` second attempt within 24h reverts
- [ ] Unit test: `setTokenPrice` only callable by `PRICE_MANAGER_ROLE`
- [ ] Unit test: `setDistribution` only callable by `DISTRIBUTION_MANAGER_ROLE`
- [ ] Unit test: Pause/unpause works only for admin

---

> *"Whatever you do, work at it with all your heart, as working for the Lord, not for human masters."* (Colossians 3:23)
