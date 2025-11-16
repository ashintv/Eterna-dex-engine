export interface Quote {
  dex: string;
  price: number;
  fee: number;
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amount: number;
}

export interface SwapResult {
  txHash: string;
  executedPrice: number;
}
export interface OrderData {
  orderId: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
}
