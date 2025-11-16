import { randomBytes } from "crypto";
import type { Quote, SwapParams, SwapResult } from "../lib/types.js";
import { sleep } from "../lib/utils.js";



/**
 * MeteoraMock simulates interaction with the Meteora DEX.
 */
export class MeteoraMock {
  private basePrice = 100;

  async getQuote(tokenIn: string, tokenOut: string, amount: number): Promise<Quote> {
    await sleep(2000);

    const variance = 0.97 + Math.random() * 0.05;
    const price = this.basePrice * variance * amount;

    return {
      dex: "meteora",
      price,
      fee: 0.002,
    };
  }

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const executionTime = 2000 + Math.random() * 1000;
    await sleep(executionTime);

    const slippage = 0.995 + Math.random() * 0.01;
    const executedPrice = this.basePrice * params.amount * slippage;

    const txHash = this.generateTxHash();

    return {
      txHash,
      executedPrice,
    };
  }

  private generateTxHash(): string {
    return randomBytes(32).toString("hex");
  }
}
/**
 * Raydium DEX Mock Service
 */
export class RaydiumMock {
  private basePrice = 100;

  async getQuote(tokenIn: string, tokenOut: string, amount: number): Promise<Quote> {
    await sleep(2000);

    const variance = 0.98 + Math.random() * 0.04;
    const price = this.basePrice * variance * amount;

    return {
      dex: "raydium",
      price,
      fee: 0.003,
    };
  }

  async executeSwap(params: SwapParams): Promise<SwapResult> {
    const executionTime = 2000 + Math.random() * 1000;
    await sleep(executionTime);

    const slippage = 0.995 + Math.random() * 0.01;
    const executedPrice = this.basePrice * params.amount * slippage;

    const txHash = this.generateTxHash();

    return {
      txHash,
      executedPrice,
    };
  }

  private generateTxHash(): string {
    return randomBytes(32).toString("hex");
  }
}
