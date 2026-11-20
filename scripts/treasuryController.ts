import * as dotenv from 'dotenv';
dotenv.config();
import { Address, fromNano, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { SomaTreasury } from '../wrappers/SomaTreasury';

export async function run(provider: NetworkProvider) {
    const isTestnet = provider.network() !== 'mainnet';
    const ui = provider.ui();

    ui.write(`\n======================================================`);
    ui.write(`🏛️ Soma Treasury (Vault) Controller`);
    ui.write(`======================================================\n`);

    const sender = provider.sender();
    if (!sender.address) {
        throw new Error('No sender address available. Please check your wallet/mnemonic.');
    }

    const defaultTreasury = 'kQAv1SHQhr7bH0x00nNyT7uT12V-4JKzTC8i_EaFjjEvre7m';
    const treasuryInput = await ui.input(`Enter Soma Treasury Address (Press Enter for default: ${defaultTreasury}):`);
    const finalAddressStr = treasuryInput.trim().length > 0 ? treasuryInput.trim() : defaultTreasury;
    const treasuryAddress = Address.parse(finalAddressStr);
    const treasury = provider.open(SomaTreasury.createFromAddress(treasuryAddress));

    const data = await treasury.getTreasuryData();
    const balance = await treasury.getBalance();

    ui.write(`\n--- Treasury Status ---`);
    ui.write(`Vault Address:       ${treasuryAddress.toString({ testOnly: isTestnet })}`);
    ui.write(`Admin (Owner):       ${data.adminAddress.toString({ testOnly: isTestnet })}`);
    ui.write(`Current TON Balance: ${fromNano(balance)} TON`);
    ui.write(`Total TON Collected: ${fromNano(data.totalTonCollected)} TON`);
    ui.write(`Verification Fee:    ${fromNano(data.verificationFee)} TON`);
    ui.write(`Is Paused:           ${data.isPaused}\n`);

    if (!data.adminAddress.equals(sender.address)) {
        ui.write(`⚠️ WARNING: Connected wallet is NOT the Admin of this Treasury!\n`);
    }

    const action = await ui.choose('What would you like to do?', [
        '1. Sweep All TON (Withdraw everything except reserve to Admin)',
        '2. Withdraw Specific Amount of TON',
        '3. Update Verification Fee',
        '4. Toggle Pause State',
        '5. Exit'
    ], (c) => c);

    if (action.startsWith('1.')) {
        ui.write(`Sweeping all available TON to: ${sender.address.toString({ testOnly: isTestnet })}`);
        await treasury.sendWithdrawTon(sender, {
            amount: 0n, // mode 128 sweep
        });
        ui.write(`🎉 Sweep transaction sent!`);
    } else if (action.startsWith('2.')) {
        const amtStr = await ui.input('Enter TON amount to withdraw:');
        const amt = toNano(amtStr.trim());
        ui.write(`Withdrawing ${fromNano(amt)} TON to: ${sender.address.toString({ testOnly: isTestnet })}`);
        await treasury.sendWithdrawTon(sender, {
            amount: amt,
        });
        ui.write(`🎉 Withdrawal transaction sent!`);
    } else if (action.startsWith('3.')) {
        const feeStr = await ui.input('Enter new verification fee in TON (e.g. 0.2):');
        const newFee = toNano(feeStr.trim());
        await treasury.sendSetVerificationFee(sender, {
            newFee,
        });
        ui.write(`🎉 Verification fee updated!`);
    } else if (action.startsWith('4.')) {
        await treasury.sendSetPaused(sender, {
            paused: !data.isPaused,
        });
        ui.write(`🎉 Pause state toggled to: ${!data.isPaused}`);
    }
}
