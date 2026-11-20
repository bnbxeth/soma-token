import * as dotenv from 'dotenv';
dotenv.config();
import { toNano, Address } from '@ton/core';
import { SomaTreasury } from '../wrappers/SomaTreasury';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const isTestnet = provider.network() !== 'mainnet';
    const ui = provider.ui();

    ui.write(`\n======================================================`);
    ui.write(`🏛️ Deploying Soma Treasury (Vault) to ${isTestnet ? 'TESTNET' : 'MAINNET'}`);
    ui.write(`======================================================\n`);

    const senderAddress = provider.sender().address;
    if (!senderAddress) {
        throw new Error('Sender address is not defined. Please connect a wallet.');
    }

    ui.write(`Connected deployer address: ${senderAddress.toString({ testOnly: isTestnet })}\n`);

    // Admin address (default: connected deployer)
    const adminAddress: Address = senderAddress;
    ui.write(`Treasury Admin (Vault Owner): ${adminAddress.toString({ testOnly: isTestnet })}\n`);

    // Linked Soma Jetton Minter
    const defaultMinter = 'EQABP8tq7XSN9PG2a5_fapigi8JQQDqdRwjZIhfgwDplcL7C';
    const minterAddress = Address.parse(defaultMinter);
    ui.write(`Linked Soma Jetton Minter: ${minterAddress.toString({ testOnly: isTestnet })}\n`);

    ui.write(`Default Verification Fee: 0.2 TON\n`);

    const treasuryCode = await compile('SomaTreasury');

    const treasury = provider.open(
        SomaTreasury.createFromConfig(
            {
                admin: adminAddress,
                jetton_minter: minterAddress,
                verification_fee: toNano('0.2'),
            },
            treasuryCode
        )
    );

    ui.write(`Deploying Soma Treasury at: ${treasury.address.toString({ testOnly: isTestnet })}\n`);

    await treasury.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(treasury.address);

    ui.write(`\n======================================================`);
    ui.write(`🎉 Soma Treasury Vault deployed successfully!`);
    ui.write(`Address: ${treasury.address.toString({ testOnly: isTestnet })}`);
    ui.write(`Explorer: https://${isTestnet ? 'testnet.' : ''}tonviewer.com/${treasury.address.toString({ testOnly: isTestnet })}`);
    ui.write(`======================================================\n`);
}
