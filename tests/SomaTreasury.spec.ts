import '@ton/test-utils';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, Address, beginCell, Dictionary } from '@ton/core';
import { compile, libraryCellFromCode } from '@ton/blueprint';
import { SomaTreasury } from '../wrappers/SomaTreasury';
import { JettonMinter, jettonContentToCell } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';

describe('Soma Treasury (Vault) Unit Tests', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let hacker: SandboxContract<TreasuryContract>;
    let treasury: SandboxContract<SomaTreasury>;
    let minter: SandboxContract<JettonMinter>;

    let treasuryCode: Cell;
    let minterCode: Cell;
    let walletCodeRaw: Cell;
    let walletCode: Cell;

    beforeAll(async () => {
        treasuryCode = await compile('SomaTreasury');
        minterCode = await compile('JettonMinter');
        walletCodeRaw = await compile('JettonWallet', { buildLibrary: false });
        walletCode = libraryCellFromCode(walletCodeRaw);
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = Math.floor(Date.now() / 1000);
        deployer = await blockchain.treasury('deployer');
        admin = await blockchain.treasury('admin');
        user1 = await blockchain.treasury('user1');
        hacker = await blockchain.treasury('hacker');

        // Set blockchain libraries for the wallet code
        const _libs = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        _libs.set(BigInt(`0x${walletCodeRaw.hash().toString('hex')}`), walletCodeRaw);
        blockchain.libs = beginCell().storeDictDirect(_libs).endCell();

        // 1. Deploy Jetton Minter
        minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: admin.address,
                    wallet_code: walletCode,
                    jetton_content: jettonContentToCell({ uri: 'https://raw.githubusercontent.com/bnbxeth/soma-token/main/metadata.json' }),
                },
                minterCode
            )
        );
        await minter.sendDeploy(deployer.getSender(), toNano('0.05'));

        // 2. Deploy Treasury Contract
        treasury = blockchain.openContract(
            SomaTreasury.createFromConfig(
                {
                    admin: admin.address,
                    jetton_minter: minter.address,
                    verification_fee: toNano('0.2'),
                },
                treasuryCode
            )
        );

        const deployResult = await treasury.sendDeploy(deployer.getSender(), toNano('0.1'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: treasury.address,
            deploy: true,
            success: true,
        });
    });

    it('1. should deploy with correct initial state and admin', async () => {
        const data = await treasury.getTreasuryData();
        expect(data.adminAddress.equals(admin.address)).toBe(true);
        expect(data.jettonMinterAddress?.equals(minter.address)).toBe(true);
        expect(data.totalTonCollected).toBe(0n);
        expect(data.verificationFee).toBe(toNano('0.2'));
        expect(data.isPaused).toBe(false);
    });

    it('2. should accept verification fee from user and record statistics', async () => {
        const telegramId = 987654321n;
        const depositAmount = toNano('0.2');

        const depositResult = await treasury.sendDepositVerification(user1.getSender(), {
            value: depositAmount,
            telegram_user_id: telegramId,
        });

        expect(depositResult.transactions).toHaveTransaction({
            from: user1.address,
            to: treasury.address,
            success: true,
        });

        const data = await treasury.getTreasuryData();
        expect(data.totalTonCollected).toBe(depositAmount);

        const balance = await treasury.getBalance();
        expect(balance).toBeGreaterThanOrEqual(toNano('0.2'));
    });

    it('3. should reject deposit if fee is insufficient', async () => {
        const lowDeposit = toNano('0.05'); // requires 0.2 TON

        const res = await treasury.sendDepositVerification(user1.getSender(), {
            value: lowDeposit,
            telegram_user_id: 111n,
        });

        expect(res.transactions).toHaveTransaction({
            from: user1.address,
            to: treasury.address,
            success: false,
            exitCode: 102, // error::insufficient_fee
        });
    });

    it('4. should BLOCK unauthorized users from withdrawing TON', async () => {
        // Hacker tries to withdraw TON
        const hackResult = await treasury.sendWithdrawTon(hacker.getSender(), {
            amount: toNano('0.1'),
        });

        expect(hackResult.transactions).toHaveTransaction({
            from: hacker.address,
            to: treasury.address,
            success: false,
            exitCode: 73, // error::not_owner
        });
    });

    it('5. should ALLOW admin to withdraw TON (partial and full sweep)', async () => {
        // Deposit 1 TON from user1
        await treasury.sendDepositVerification(user1.getSender(), {
            value: toNano('1.0'),
            telegram_user_id: 222n,
        });

        const balanceBefore = await admin.getBalance();

        // Admin withdraws 0.5 TON
        const withdrawResult = await treasury.sendWithdrawTon(admin.getSender(), {
            amount: toNano('0.5'),
        });

        expect(withdrawResult.transactions).toHaveTransaction({
            from: admin.address,
            to: treasury.address,
            success: true,
        });

        expect(withdrawResult.transactions).toHaveTransaction({
            from: treasury.address,
            to: admin.address,
            success: true,
        });

        // Admin sweeps all remaining balance
        const sweepResult = await treasury.sendWithdrawTon(admin.getSender(), {
            amount: 0n, // sweep mode
        });

        expect(sweepResult.transactions).toHaveTransaction({
            from: admin.address,
            to: treasury.address,
            success: true,
        });

        const vaultBalance = await treasury.getBalance();
        // Vault still keeps safety reserve around 0.05 TON
        expect(vaultBalance).toBeLessThanOrEqual(toNano('0.06'));
        expect(vaultBalance).toBeGreaterThanOrEqual(toNano('0.04'));
    });

    it('6. should allow admin to pause/unpause and update fees', async () => {
        // Admin updates fee to 0.5 TON
        await treasury.sendSetVerificationFee(admin.getSender(), {
            newFee: toNano('0.5'),
        });

        let data = await treasury.getTreasuryData();
        expect(data.verificationFee).toBe(toNano('0.5'));

        // Admin pauses the contract
        await treasury.sendSetPaused(admin.getSender(), { paused: true });
        data = await treasury.getTreasuryData();
        expect(data.isPaused).toBe(true);

        // User tries to deposit while paused -> should FAIL
        const res = await treasury.sendDepositVerification(user1.getSender(), {
            value: toNano('0.5'),
            telegram_user_id: 333n,
        });
        expect(res.transactions).toHaveTransaction({
            from: user1.address,
            to: treasury.address,
            success: false,
            exitCode: 101, // error::paused
        });

        // Admin unpauses
        await treasury.sendSetPaused(admin.getSender(), { paused: false });

        // User deposits again -> should SUCCEED
        const resSuccess = await treasury.sendDepositVerification(user1.getSender(), {
            value: toNano('0.5'),
            telegram_user_id: 333n,
        });
        expect(resSuccess.transactions).toHaveTransaction({
            from: user1.address,
            to: treasury.address,
            success: true,
        });
    });

    it('7. should allow admin to transfer ownership (change admin)', async () => {
        const newAdmin = await blockchain.treasury('newAdmin');

        // Hacker tries to change admin -> fails
        const hack = await treasury.sendChangeAdmin(hacker.getSender(), {
            newAdmin: hacker.address,
        });
        expect(hack.transactions).toHaveTransaction({
            from: hacker.address,
            to: treasury.address,
            success: false,
            exitCode: 73,
        });

        // Current admin changes admin
        await treasury.sendChangeAdmin(admin.getSender(), {
            newAdmin: newAdmin.address,
        });

        const data = await treasury.getTreasuryData();
        expect(data.adminAddress.equals(newAdmin.address)).toBe(true);

        // Old admin can no longer withdraw
        const oldAdminWithdraw = await treasury.sendWithdrawTon(admin.getSender(), {
            amount: 0n,
        });
        expect(oldAdminWithdraw.transactions).toHaveTransaction({
            from: admin.address,
            to: treasury.address,
            success: false,
            exitCode: 73,
        });

        // New admin CAN withdraw
        const newAdminWithdraw = await treasury.sendWithdrawTon(newAdmin.getSender(), {
            amount: 0n,
        });
        expect(newAdminWithdraw.transactions).toHaveTransaction({
            from: newAdmin.address,
            to: treasury.address,
            success: true,
        });
    });

    it('8. should allow Treasury to mint SOMA Jettons to a user when Treasury is Minter Admin', async () => {
        // Deploy a new minter whose admin is the Treasury contract
        const minterWithTreasuryAdmin = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: treasury.address,
                    wallet_code: walletCode,
                    jetton_content: jettonContentToCell({ uri: 'https://raw.githubusercontent.com/bnbxeth/soma-token/main/metadata.json' }),
                },
                minterCode
            )
        );
        await minterWithTreasuryAdmin.sendDeploy(deployer.getSender(), toNano('0.05'));

        // Point treasury to this minter
        await treasury.sendSetJettonMinter(admin.getSender(), {
            newMinter: minterWithTreasuryAdmin.address,
        });

        // Top up treasury with gas so it can pay for minting
        await treasury.sendDeploy(deployer.getSender(), toNano('0.2'));

        // Admin commands Treasury to mint 1,000 SOMA to user1
        const mintResult = await treasury.sendMintSoma(admin.getSender(), {
            to: user1.address,
            jetton_amount: toNano('1000'),
            value: toNano('0.15'),
        });

        expect(mintResult.transactions).toHaveTransaction({
            from: admin.address,
            to: treasury.address,
            success: true,
        });

        expect(mintResult.transactions).toHaveTransaction({
            from: treasury.address,
            to: minterWithTreasuryAdmin.address,
            success: true,
        });

        // Verify Jetton total supply increased to 1,000 SOMA
        const minterData = await minterWithTreasuryAdmin.getJettonData();
        expect(minterData.totalSupply).toBe(toNano('1000'));
    });
});

