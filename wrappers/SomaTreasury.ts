import {
    Address,
    beginCell,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
    toNano
} from '@ton/core';

export const OpTreasury = {
    deposit_verification: 0x54657374,
    withdraw_ton: 0x6e746b73,
    mint_soma: 0x746d696e,
    set_verification_fee: 0x8a9b0c1d,
    set_jetton_minter: 0x9b0c1d2e,
    change_admin: 0x6501f354,
    set_paused: 0xa1b2c3d4,
    top_up: 0xd372158c,
};

export type SomaTreasuryConfig = {
    admin: Address;
    jetton_minter: Address | null;
    total_ton_collected?: bigint;
    verification_fee?: bigint;
    is_paused?: boolean;
};

export function somaTreasuryConfigToCell(config: SomaTreasuryConfig): Cell {
    return beginCell()
        .storeAddress(config.admin)
        .storeAddress(config.jetton_minter)
        .storeCoins(config.total_ton_collected ?? 0n)
        .storeCoins(config.verification_fee ?? toNano('0.2'))
        .storeInt(config.is_paused ? -1 : 0, 1)
        .endCell();
}

export class SomaTreasury implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SomaTreasury(address);
    }

    static createFromConfig(config: SomaTreasuryConfig, code: Cell, workchain = 0) {
        const data = somaTreasuryConfigToCell(config);
        const init = { code, data };
        return new SomaTreasury(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint = toNano('0.05')) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().storeUint(OpTreasury.top_up, 32).storeUint(0, 64).endCell(),
        });
    }

    async sendDepositVerification(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            telegram_user_id?: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OpTreasury.deposit_verification, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeUint(opts.telegram_user_id ?? 0n, 64)
                .endCell(),
        });
    }

    async sendWithdrawTon(
        provider: ContractProvider,
        via: Sender,
        opts: {
            amount: bigint; // 0n to sweep all funds
            recipient?: Address | null;
            value?: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value ?? toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OpTreasury.withdraw_ton, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.amount)
                .storeAddress(opts.recipient ?? null)
                .endCell(),
        });
    }

    async sendMintSoma(
        provider: ContractProvider,
        via: Sender,
        opts: {
            to: Address;
            jetton_amount: bigint;
            forward_ton_amount?: bigint;
            value?: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value ?? toNano('0.1'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OpTreasury.mint_soma, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeAddress(opts.to)
                .storeCoins(opts.jetton_amount)
                .storeCoins(opts.forward_ton_amount ?? 1n)
                .endCell(),
        });
    }

    async sendSetVerificationFee(
        provider: ContractProvider,
        via: Sender,
        opts: {
            newFee: bigint;
            value?: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value ?? toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OpTreasury.set_verification_fee, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.newFee)
                .endCell(),
        });
    }

    async sendSetJettonMinter(
        provider: ContractProvider,
        via: Sender,
        opts: {
            newMinter: Address;
            value?: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value ?? toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OpTreasury.set_jetton_minter, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeAddress(opts.newMinter)
                .endCell(),
        });
    }

    async sendChangeAdmin(
        provider: ContractProvider,
        via: Sender,
        opts: {
            newAdmin: Address;
            value?: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value ?? toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OpTreasury.change_admin, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeAddress(opts.newAdmin)
                .endCell(),
        });
    }

    async sendSetPaused(
        provider: ContractProvider,
        via: Sender,
        opts: {
            paused: boolean;
            value?: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value ?? toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(OpTreasury.set_paused, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeInt(opts.paused ? -1 : 0, 1)
                .endCell(),
        });
    }

    async getTreasuryData(provider: ContractProvider) {
        const res = await provider.get('get_treasury_data', []);
        return {
            adminAddress: res.stack.readAddress(),
            jettonMinterAddress: res.stack.readAddressOpt(),
            totalTonCollected: res.stack.readBigNumber(),
            verificationFee: res.stack.readBigNumber(),
            isPaused: res.stack.readBoolean(),
        };
    }

    async getVaultBalance(provider: ContractProvider): Promise<bigint> {
        const res = await provider.get('get_vault_balance', []);
        return res.stack.readBigNumber();
    }

    async getBalance(provider: ContractProvider): Promise<bigint> {
        const state = await provider.getState();
        return state.balance;
    }
}
