import { z} from "zod";



// export interface SwapParams {
//   tokenIn: string;
//   tokenOut: string;
//   amount: number;
// }

const tokens = ['SOL', 'USDC', 'USDT', 'BTC', 'ETH'];

export const RequestSwapSchema = z.object({
  userAddress: z.string("user address must be a non-empty string").min(1 , "user address must be a non-empty string"),
  tokenIn: z.enum(tokens as [string, ...string[]] , "tokenIn must be one of the supported tokens"),
  tokenOut: z.enum(tokens as [string, ...string[]], "tokenOut must be one of the supported tokens"),
  amount: z.number().positive("amount must be a positive number"),
});


