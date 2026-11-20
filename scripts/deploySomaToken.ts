import * as dotenv from 'dotenv';
dotenv.config();
import { toNano, Address } from '@ton/core';
import { JettonMinter, jettonContentToCell } from '../wrappers/JettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';
import { promptUrl, promptUserFriendlyAddress } from '../wrappers/ui-utils';

export async function run(provider: NetworkProvider) {
    const isTestnet = provider.network() !== 'mainnet';
    const ui = provider.ui();

    ui.write(`\n======================================================`);
    ui.write(`🚀 Deploying Soma Token ($SOMA) to ${isTestnet ? 'TESTNET' : 'MAINNET'}`);
    ui.write(`======================================================\n`);

    const senderAddress = provider.sender().address;
    if (!senderAddress) {
        throw new Error('Sender address is not defined. Please connect a wallet.');
    }

    ui.write(`Connected deployer address: ${senderAddress.toString({ testOnly: isTestnet })}\n`);

    let adminAddress: Address = senderAddress;
    if (process.env.ADMIN_ADDRESS && process.env.ADMIN_ADDRESS.trim().length > 0) {
        try {
            adminAddress = Address.parse(process.env.ADMIN_ADDRESS.trim());
            ui.write(`Using Admin Address from .env: ${adminAddress.toString({ testOnly: isTestnet })}\n`);
        } catch {
            ui.write(`⚠️ Invalid ADMIN_ADDRESS in .env, falling back to selection.\n`);
        }
    } else {
        const useConnectedAsAdmin = await ui.choose('Who should be the Jetton Admin (Owner)?', [
            'Connected Wallet (Recommended)',
            'Custom Address'
        ], (c) => c);

        if (useConnectedAsAdmin === 'Custom Address') {
            const customAddr = await promptUserFriendlyAddress("Enter the admin address:", ui, isTestnet);
            adminAddress = customAddr.address;
        }
    }

    ui.write(`\nJetton Admin will be: ${adminAddress.toString({ testOnly: isTestnet })}\n`);

    let metadataUri = process.env.METADATA_URI?.trim();
    if (metadataUri && metadataUri.length > 0) {
        ui.write(`Using Metadata URI from .env: ${metadataUri}\n`);
    } else {
        metadataUri = await promptUrl(
            "Enter metadata JSON URL (e.g. https://raw.githubusercontent.com/.../metadata.json):",
            ui
        );
    }

    ui.write(`\nCompiling contracts...`);
    const jettonWalletCode = await compile('JettonWallet');
    const jettonMinterCode = await compile('JettonMinter');

    const minter = provider.open(
        JettonMinter.createFromConfig(
            {
                admin: adminAddress,
                wallet_code: jettonWalletCode,
                jetton_content: jettonContentToCell({ uri: metadataUri }),
            },
            jettonMinterCode
        )
    );

    ui.write(`\nDeploying Minter contract at: ${minter.address.toString({ testOnly: isTestnet })}`);
    ui.write(`Please confirm the transaction in your wallet...\n`);

    await minter.sendDeploy(provider.sender(), toNano('0.25'));
    await provider.waitForDeploy(minter.address);

    ui.write(`\n======================================================`);
    ui.write(`🎉 SUCCESS! Soma Token ($SOMA) deployed successfully!`);
    ui.write(`Contract Address: ${minter.address.toString({ testOnly: isTestnet })}`);
    ui.write(`View on Explorer: https://${isTestnet ? 'testnet.' : ''}tonviewer.com/${minter.address.toString({ testOnly: isTestnet })}`);
    ui.write(`======================================================\n`);
}
