import '@ton/test-utils';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, Address, beginCell, Dictionary } from '@ton/core';
import { JettonMinter, jettonContentToCell } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { compile, libraryCellFromCode } from '@ton/blueprint';

describe('Soma Token (SOMA) Unit Tests', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let minter: SandboxContract<JettonMinter>;
    let minterCode: Cell;
    let walletCodeRaw: Cell;
    let walletCode: Cell;

    beforeAll(async () => {
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
        user2 = await blockchain.treasury('user2');

        // Set blockchain libraries for the wallet code
        const _libs = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        _libs.set(BigInt(`0x${walletCodeRaw.hash().toString('hex')}`), walletCodeRaw);
        blockchain.libs = beginCell().storeDictDirect(_libs).endCell();

        minter = blockchain.openContract(
            JettonMinter.createFromConfig(
                {
                    admin: admin.address,
                    wallet_code: walletCode,
                    jetton_content: jettonContentToCell({ uri: 'https://raw.githubusercontent.com/username/repo/main/metadata.json' }),
                },
                minterCode
            )
        );

        const deployResult = await minter.sendDeploy(deployer.getSender(), toNano('0.05'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: minter.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy with correct admin and initial state', async () => {
        const jettonData = await minter.getJettonData();
        expect(jettonData.adminAddress?.equals(admin.address)).toBe(true);
        expect(jettonData.totalSupply).toBe(0n);
        expect(jettonData.mintable).toBe(true);
    });

    it('should allow admin to mint SOMA tokens (e.g. withdrawal after mining)', async () => {
        const mintAmount = toNano('1000'); // 1,000 SOMA tokens
        const mintResult = await minter.sendMint(
            admin.getSender(),
            user1.address,
            mintAmount,
            null, // from
            null, // response_addr
            null, // customPayload
            toNano('0.05'), // forward ton amount
            toNano('1')    // total ton amount
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: admin.address,
            to: minter.address,
            success: true,
        });

        // Check total supply updated
        const jettonData = await minter.getJettonData();
        expect(jettonData.totalSupply).toBe(mintAmount);

        // Check user1 jetton wallet balance
        const user1WalletAddress = await minter.getWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(JettonWallet.createFromAddress(user1WalletAddress));
        const user1Balance = await user1Wallet.getJettonBalance();
        expect(user1Balance).toBe(mintAmount);
    });

    it('should prevent non-admin from minting tokens', async () => {
        const hacker = user2;
        const mintAmount = toNano('50000');

        const mintResult = await minter.sendMint(
            hacker.getSender(),
            hacker.address,
            mintAmount,
            null,
            null,
            null,
            toNano('0.05'),
            toNano('1')
        );

        // Transaction should fail or bounce because sender is not admin
        expect(mintResult.transactions).toHaveTransaction({
            from: hacker.address,
            to: minter.address,
            success: false,
            exitCode: 73, // error unauthorized in jetton-minter.fc
        });

        // Total supply must remain 0
        const jettonData = await minter.getJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });

    it('should allow user1 to transfer SOMA tokens to user2', async () => {
        // First admin mints 500 SOMA to user1
        await minter.sendMint(
            admin.getSender(),
            user1.address,
            toNano('500'),
            null,
            null,
            null,
            toNano('0.05'),
            toNano('1')
        );

        const user1WalletAddress = await minter.getWalletAddress(user1.address);
        const user1Wallet = blockchain.openContract(JettonWallet.createFromAddress(user1WalletAddress));

        // User1 transfers 200 SOMA to User2
        const transferAmount = toNano('200');
        const transferResult = await user1Wallet.sendTransfer(
            user1.getSender(),
            toNano('0.15'), // value for gas
            transferAmount,
            user2.address,
            user1.address, // response address
            null, // custom payload
            toNano('0.05'), // forward ton amount
            null // forward payload
        );

        expect(transferResult.transactions).toHaveTransaction({
            from: user1.address,
            to: user1Wallet.address,
            success: true,
        });

        // Check user1 balance is 300
        const user1Balance = await user1Wallet.getJettonBalance();
        expect(user1Balance).toBe(toNano('300'));

        // Check user2 balance is 200
        const user2WalletAddress = await minter.getWalletAddress(user2.address);
        const user2Wallet = blockchain.openContract(JettonWallet.createFromAddress(user2WalletAddress));
        const user2Balance = await user2Wallet.getJettonBalance();
        expect(user2Balance).toBe(transferAmount);
    });
});
