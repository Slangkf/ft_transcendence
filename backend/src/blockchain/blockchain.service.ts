import { ethers } from "ethers";
import { TournamentScoresAbi } from "./TournamentScores.abi";

export interface PlayerScoreInput {
    nickname: string;
    score: number;
    rank: number;
}

export interface OnchainTournament {
    finishedAt: number;
    winner: string;
    players: { nickname: string; score: number; rank: number }[];
}

/**
 * Talks to the TournamentScores smart contract on the Avalanche Fuji testnet.
 *
 * The service is intentionally fail-soft: if the env is incomplete it stays
 * disabled (isEnabled() === false) and every method becomes a no-op, so a
 * missing/slow blockchain can never break the tournament flow.
 */
export class BlockchainService {
    private contract: ethers.Contract | null = null;
    private explorerBase = "https://testnet.snowtrace.io";

    /*
     * Wires the contract from env (RPC + private key + address).
     * Stays disabled (no-op mode) if any var is missing or init fails.
     */
    constructor() {
        const rpc = process.env.AVAX_RPC_URL;
        const pk = process.env.CHAIN_PRIVATE_KEY;
        const address = process.env.CHAIN_CONTRACT_ADDRESS;

        if (!rpc || !pk || !address) {
            console.warn("[blockchain] disabled: AVAX_RPC_URL / CHAIN_PRIVATE_KEY / CHAIN_CONTRACT_ADDRESS not all set");
            return;
        }
        try {
            const provider = new ethers.JsonRpcProvider(rpc);
            const wallet = new ethers.Wallet(pk, provider);
            this.contract = new ethers.Contract(address, TournamentScoresAbi, wallet);
            console.log(`[blockchain] enabled, contract ${address}`);
        } catch (e) {
            console.error("[blockchain] failed to initialise, staying disabled", e);
            this.contract = null;
        }
    }

    /* True when the contract was successfully wired (chain calls are live). */
    isEnabled(): boolean {
        return this.contract !== null;
    }

    /** keccak256 of the off-chain UUID -> bytes32 key used on-chain. */
    private toId(tournamentId: string): string {
        return ethers.keccak256(ethers.toUtf8Bytes(tournamentId));
    }

    /* Builds the Snowtrace explorer URL for a transaction hash. */
    explorerTxUrl(txHash: string): string {
        return `${this.explorerBase}/tx/${txHash}`;
    }

    /**
     * Record a finished tournament on-chain. Returns the transaction hash, or
     * null if the service is disabled. Throws on an actual chain error so the
     * caller can log it (the caller MUST wrap this in try/catch).
     */
    async recordTournament(
        tournamentId: string,
        winner: string,
        players: PlayerScoreInput[],
    ): Promise<string | null> {
        if (!this.contract) return null;
        const tx = await this.contract.recordTournament(
            this.toId(tournamentId),
            winner,
            players.map(p => p.nickname),
            players.map(p => BigInt(Math.max(0, Math.trunc(p.score)))),
            players.map(p => p.rank),
        );
        const receipt = await tx.wait();
        return receipt?.hash ?? tx.hash;
    }

    /** Read a tournament back from the chain. Returns null if disabled/unknown. */
    async getTournament(tournamentId: string): Promise<OnchainTournament | null> {
        if (!this.contract) return null;
        try {
            const [finishedAt, winner, players] = await this.contract.getTournament(this.toId(tournamentId));
            return {
                finishedAt: Number(finishedAt),
                winner,
                players: players.map((p: any) => ({
                    nickname: p.nickname,
                    score: Number(p.score),
                    rank: Number(p.rank),
                })),
            };
        } catch {
            // contract reverts with "not found" for unknown ids
            return null;
        }
    }
}
