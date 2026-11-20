# 🚀 Soma Token ($SOMA) & Soma Treasury Vault - TON Smart Contracts

This repository contains the production-grade smart contracts for **Soma ($SOMA)** on The Open Network (TON), built according to **TEP-74 (Jettons)**, **TEP-64 (Metadata)**, and **TEP-89 (Discovery)** standards with an on-chain **SomaTreasury Vault** for Telegram Mini-App anti-sybil verification.

---

## 📍 Deployed Contracts (TON Testnet)

* **Soma Token ($SOMA) Minter:**  
  `kQAqqhoZIKObqya7D3wxjltSRzJ6idRMFiEV-98BACjFxkMF`  
  [View on Tonviewer](https://testnet.tonviewer.com/kQAqqhoZIKObqya7D3wxjltSRzJ6idRMFiEV-98BACjFxkMF) | [View on Tonscan](https://testnet.tonscan.org/address/kQAqqhoZIKObqya7D3wxjltSRzJ6idRMFiEV-98BACjFxkMF)

---

## 📁 Architecture Overview

1. **`contracts/jetton-minter.fc`**: Master token contract. Handles total supply, metadata URL, and controls minting permissions (only authorized admin or Treasury can mint).
2. **`contracts/jetton-wallet.fc`**: Each user's personal Jetton wallet contract for holding and transferring $SOMA.
3. **`contracts/soma-treasury.fc`**: Dedicated Vault smart contract. Accepts 1-time TON verification fees from Telegram bot users, locks the funds, and allows **ONLY the Admin** to withdraw/sweep all collected TON.
4. **`metadata.json`**: Token metadata (Name: Soma, Symbol: SOMA, Decimals: 9, Logo URL).
5. **`scripts/mintInitialSupply.ts`**: 1-click script to mint 100M, 200M, or custom fixed supply to Admin wallet.
6. **`scripts/treasuryController.ts`**: Admin control tool to inspect collected TON and sweep all funds.

---

## 🛠️ CLI Commands Cheat Sheet (কমান্ড গাইড)

| কমান্ড (Command) | বিবরণ (Description) | মোড (Mode) |
| :--- | :--- | :--- |
| `npx blueprint run deploySomaToken --testnet --mnemonic` | নতুন সোমা টোকেন ($SOMA) টেস্টনেটে ডিপ্লয় করে | Local Mnemonic |
| `npx blueprint run mintInitialSupply --testnet --mnemonic` | এক ক্লিকে ১০০M বা ২০০M ফিক্সড সাপ্লাই আপনার ওয়ালেটে মিন্ট করে | Local Mnemonic |
| `npx blueprint run quickMint --testnet --mnemonic` | নির্দিষ্ট পরিমাণের টোকেন নিজের বা ইউজারের ওয়ালেটে মিন্ট করে | Local Mnemonic |
| `npx blueprint run deploySomaTreasury --testnet --mnemonic` | সোমা ট্রেজারি ভল্ট (Vault) কন্ট্রাক্ট টেস্টনেটে ডিপ্লয় করে | Local Mnemonic |
| `npx blueprint run treasuryController --testnet --mnemonic` | ট্রেজারিতে জমা হওয়া সব TON অ্যাডমিন ওয়ালেটে সুইপ/উইথড্র করে | Local Mnemonic |
| `npx blueprint test SomaToken.spec.ts SomaTreasury.spec.ts` | লোকাল স্যান্ডবক্স ইউনিট টেস্ট চালায় (১২/১২ পাস) | Local Sandbox |

---

## ⚙️ Environment Setup (.env)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and paste your 24-word seed phrase:
   ```env
   WALLET_MNEMONIC="word1 word2 ... word24"
   WALLET_VERSION="v5r1"
   METADATA_URI="https://raw.githubusercontent.com/bnbxeth/soma-token/main/metadata.json"
   ```
   *(Note: `.env` is automatically ignored by `.gitignore` so your secret seed phrase will NEVER be uploaded to GitHub).*
