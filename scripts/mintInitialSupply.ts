import * as dotenv from 'dotenv';
dotenv.config();
import { Address, fromNano, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';

const SOMA_MINTER_ADDRESS = Address.parse('EQABP8tq7XSN9PG2a5_fapigi8JQQDqdRwjZIhfgwDplcL7C');

export async function run(provider: NetworkProvider) {
    const isTestnet = provider.network() !== 'mainnet';
    const ui = provider.ui();

    ui.write(`\n======================================================`);
    ui.write(`🚀 Soma Token ($SOMA) - Initial Fixed Supply Minter`);
    ui.write(`======================================================\n`);

    const sender = provider.sender();
    if (!sender.address) {
        throw new Error('No sender address available. Please check your wallet/mnemonic.');
    }

    const minter = provider.open(JettonMinter.createFromAddress(SOMA_MINTER_ADDRESS));
    const jettonData = await minter.getJettonData();

    ui.write(`Token Contract: ${SOMA_MINTER_ADDRESS.toString({ testOnly: isTestnet })}`);
    ui.write(`Admin Wallet:   ${jettonData.adminAddress ? jettonData.adminAddress.toString({ testOnly: isTestnet }) : 'None'}`);
    ui.write(`Current Supply: ${fromNano(jettonData.totalSupply)} SOMA\n`);

    const supplyChoice = await ui.choose('Select Initial Supply to Mint:', [
        '100,000,000 SOMA (100 Million)',
        '200,000,000 SOMA (200 Million)',
        '500,000,000 SOMA (500 Million)',
        '1,000,000,000 SOMA (1 Billion)',
        'Custom Amount'
    ], (c) => c);

    let amountTokens = 100000000n;
    if (supplyChoice.startsWith('100,000,000')) {
        amountTokens = 100000000n;
    } else if (supplyChoice.startsWith('200,000,000')) {
        amountTokens = 200000000n;
    } else if (supplyChoice.startsWith('500,000,000')) {
        amountTokens = 500000000n;
    } else if (supplyChoice.startsWith('1,000,000,000')) {
        amountTokens = 1000000000n;
    } else {
        const customPrompt = await ui.input('Enter token amount to mint:');
        amountTokens = BigInt(customPrompt.replace(/,/g, '').trim());
    }

    const mintNanotons = amountTokens * 1000000000n; // 9 decimals

    ui.write(`\nTarget Recipient: ${sender.address.toString({ testOnly: isTestnet })}`);
    ui.write(`Minting: ${amountTokens.toLocaleString()} SOMA tokens...`);

    await minter.sendMint(
        sender,
        sender.address,
        mintNanotons,
        null,
        null,
        null,
        toNano('0.05'),
        toNano('0.2')
    );

    ui.write(`\n🎉 Initial Supply Mint transaction dispatched!`);
    ui.write(`Tokens will appear in your Tonkeeper wallet within ~5-10 seconds.`);
    ui.write(`Explorer: https://${isTestnet ? 'testnet.' : ''}tonviewer.com/${SOMA_MINTER_ADDRESS.toString({ testOnly: isTestnet })}\n`);
}
