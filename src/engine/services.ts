import type { Quote, SwapParams, SwapResult} from "../lib/types.js";
import { MeteoraMock, RaydiumMock } from "./mock.js";


export class dexHandler {
  private raydium: RaydiumMock;
  private meteora: MeteoraMock;

  constructor() {
    this.raydium = new RaydiumMock();
    this.meteora = new MeteoraMock();
  }

  async getBestRoute(tokenIn: string, tokenOut: string, amount: number): Promise<Quote> {
    console.log(`\nFetching quotes for ${amount} ${tokenIn} -> ${tokenOut}`);

    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.raydium.getQuote(tokenIn, tokenOut, amount),
      this.meteora.getQuote(tokenIn, tokenOut, amount),
    ]);

    console.log('\nRaydium:', raydiumQuote);
    console.log('Meteora:', meteoraQuote);

    const raydiumNet = raydiumQuote.price * (1 - raydiumQuote.fee);
    const meteoraNet = meteoraQuote.price * (1 - meteoraQuote.fee);

    const bestQuote = raydiumNet > meteoraNet ? raydiumQuote : meteoraQuote;

    console.log(`\nBest route: ${bestQuote.dex} (net price: ${bestQuote.price * (1 - bestQuote.fee)})`);

    return bestQuote;
  }

  async executeSwap(dex: string, params: SwapParams): Promise<SwapResult> {
    console.log(`\nExecuting swap on ${dex}`);

    if (dex === 'raydium') {
      return await this.raydium.executeSwap(params);
    } else {
      return await this.meteora.executeSwap(params);
    }
  }
}




