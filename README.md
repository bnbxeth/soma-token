# 🚀 Soma Token ($SOMA) - TON Smart Contracts

This directory contains the production-grade, audited smart contracts for **Soma ($SOMA)** on The Open Network (TON), built according to the **TEP-74 (Jetton Standard)** and **TEP-64 (Token Data Standard)**.

---

## 📁 Architecture Overview

- **`contracts/jetton-minter.fc`**: The master contract. Handles total supply, metadata URL, and controls minting permissions (only authorized admin/backend can mint).
- **`contracts/jetton-wallet.fc`**: Each user's personal Jetton wallet contract for holding and transferring $SOMA.
- **`metadata.json`**: Token metadata (Name: Soma, Symbol: SOMA, 9 Decimals, Logo image URI).
- **`scripts/deploySomaToken.ts`**: Interactive deployment script for Testnet and Mainnet.
- **`scripts/minterController.ts`**: Interactive admin tool to Mint tokens, Change Admin, View Stats, or Revoke Minting.
- **`tests/SomaToken.spec.ts`**: Comprehensive automated unit tests verifying deployment, admin minting, unauthorized protection, and transfers.

---

## 🧪 1. Run Automated Unit Tests

Run local sandbox simulation tests without spending any gas or network:
```bash
npm test
```
All tests verify:
1. ✅ Correct contract deployment and initial metadata state.
2. ✅ Admin minting (simulating user withdrawal after off-chain mining).
3. ✅ Protection against unauthorized hackers/bots trying to mint.
4. ✅ User-to-user Jetton transfers and balance deductions.

---

## 🌐 2. Deploy to TON Testnet

### Prerequisites:
1. Install **Tonkeeper** on your phone or browser.
2. Switch to **Testnet** (Settings -> tap version number 5 times -> Switch to Testnet).
3. Get free Testnet TON from Telegram Bot: [`@testgiver_ton_bot`](https://t.me/testgiver_ton_bot).

### Run Deployment:
```bash
npx blueprint run deploySomaToken --testnet --tonconnect
```
- A QR code will appear in your terminal.
- Scan it with Tonkeeper (Testnet mode).
- Enter your metadata URL (or GitHub raw URL for `metadata.json`).
- Confirm transaction (~0.25 testnet TON).
- Done! Your token is live on TON Testnet.

---

## 🎛️ 3. Mint Tokens / Manage Contract

To mint tokens to user wallets (e.g. testing withdrawal) or inspect the contract:
```bash
npx blueprint run minterController --testnet --tonconnect
```
Available actions:
- **Mint**: Send freshly minted $SOMA tokens to any user's TON wallet.
- **Info**: Check total supply, current admin, and metadata.
- **Change Admin**: Transfer admin privileges (e.g. to a backend custodial wallet).
- **Drop Admin**: Permanently revoke minting (makes supply fixed for trust).
# soma-token
