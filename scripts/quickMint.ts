import * as dotenv from 'dotenv';
dotenv.config();
import { Address, fromNano, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { promptAmount, promptUserFriendlyAddress } from '../wrappers/ui-utils';

// Your deployed Soma Token contract address
const SOMA_MINTER_ADDRESS = Address.parse('EQABP8tq7XSN9PG2a5_fapigi8JQQDqdRwjZIhfgwDplcL7C');

export async function run(provider: NetworkProvider) {
    const isTestnet = provider.network() !== 'mainnet';
    const ui = provider.ui();

    ui.write(`\n======================================================`);
    ui.write(`🪙 Soma Token ($SOMA) - Quick Mint Tool`);
    ui.write(`======================================================\n`);

    const sender = provider.sender();
    if (!sender.address) {
        throw new Error('No sender address available. Please check your wallet/mnemonic.');
    }

    const minter = provider.open(JettonMinter.createFromAddress(SOMA_MINTER_ADDRESS));

    // Check jetton data
    const jettonData = await minter.getJettonData();
    ui.write(`Minter Address: ${SOMA_MINTER_ADDRESS.toString({ testOnly: isTestnet })}`);
    ui.write(`Admin Address:  ${jettonData.adminAddress ? jettonData.adminAddress.toString({ testOnly: isTestnet }) : 'None'}`);
    ui.write(`Current Supply: ${fromNano(jettonData.totalSupply)} SOMA`);
    ui.write(`Sender Address: ${sender.address.toString({ testOnly: isTestnet })}\n`);

    if (jettonData.adminAddress && !jettonData.adminAddress.equals(sender.address)) {
        ui.write(`⚠️ WARNING: Connected wallet is not the admin of this token contract!\n`);
    }

    const recipientChoice = await ui.choose('Who should receive the minted tokens?', [
        'My Wallet (Connected Wallet)',
        'Another Address'
    ], (c) => c);

    let recipientAddress: Address = sender.address;
    if (recipientChoice === 'Another Address') {
        const addrPrompt = await promptUserFriendlyAddress('Enter recipient address:', ui, isTestnet);
        recipientAddress = addrPrompt.address;
    }

    const mintAmount = await promptAmount('Enter amount of SOMA tokens to mint (e.g. 10000):', 9, ui);

    ui.write(`\nMinting ${fromNano(mintAmount)} SOMA to: ${recipientAddress.toString({ testOnly: isTestnet })}`);
    ui.write(`Sending transaction...`);

    await minter.sendMint(
        sender,
        recipientAddress,
        mintAmount,
        null,
        null,
        null,
        toNano('0.05'), // forward ton amount
        toNano('0.2')   // total ton amount for minting and gas
    );

    ui.write(`\n🎉 Mint transaction sent successfully!`);
    ui.write(`Please check your Tonkeeper wallet in a few seconds to see your SOMA balance.\n`);
}
