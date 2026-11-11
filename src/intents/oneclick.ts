// IntentGuard — NEAR Intents 1Click quote client (NEW in the hackathon window).
// Docs: https://docs.near-intents.org/api-reference/oneclick/request-a-swap-quote
// POST https://1click.chaindefuser.com/v0/quote — no auth needed for basic
// quotes (0.2% platform fee without a partner JWT; quotes are free).
//
// DRY MODE ONLY in this repo: `dry: true` returns real solver pricing
// but NO depositAddress / deadline — no funds can move. A live quote
// (dry: false) is deliberately NOT implemented here: executing a swap
// needs Feri's explicit iya for a specific amount, and Intents has no
// testnet, so a dry quote is the safe, reproducible demo path.

export const ONE_CLICK_BASE = "https://1click.chaindefuser.com";

/** 1Click asset id for an EVM token: nep141:<chain>-<address>.omft.near.
 *  Chain prefixes follow the 1Click token list (verified live 12 Nov 2026):
 *  eth -> eth, base -> base, bsc -> bnb, arbitrum -> arb. */
export function evmAssetId(chain: string, address: string): string {
  const prefix: Record<string, string> = {
    ethereum: "eth",
    eth: "eth",
    base: "base",
    bsc: "bnb",
    arbitrum: "arb",
    optimism: "op",
    polygon: "pol",
    gnosis: "gnosis",
    avalanche: "avax",
  };
  const p = prefix[chain.toLowerCase()];
  if (!p) throw new Error(`No 1Click asset prefix known for chain "${chain}"`);
  return `nep141:${p}-${address.toLowerCase()}.omft.near`;
}

/** Wrapped NEAR (the origin asset for the demo). Verified in the live
 *  1Click token list: nep141:wrap.near, 24 decimals. */
export const WNEAR_ASSET_ID = "nep141:wrap.near";

export interface DryQuoteRequest {
  originAsset: string;
  destinationAsset: string;
  /** Amount in the smallest unit of the origin asset, as an integer string. */
  amount: string;
  /** Refund address on the origin chain (required by the API; unused for dry quotes). */
  refundTo: string;
  /** Recipient address on the destination chain (required; unused for dry quotes). */
  recipient: string;
  /** Slippage tolerance in basis points (100 = 1%). Default 100. */
  slippageTolerance?: number;
}

export interface DryQuote {
  amountIn: string;
  amountInFormatted: string;
  amountInUsd: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string;
  minAmountOut: string;
  timeEstimateSeconds: number;
  /** Dry quotes MUST NOT carry a deposit address — assert this on receipt. */
  depositAddress: string | null;
}

export interface DryQuoteResult {
  quote: DryQuote;
  raw: any;
}

/** Request a dry (simulation-only) quote from the 1Click API. */
export async function requestDryQuote(req: DryQuoteRequest): Promise<DryQuoteResult> {
  const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const body = {
    dry: true,
    swapType: "EXACT_INPUT",
    slippageTolerance: req.slippageTolerance ?? 100,
    originAsset: req.originAsset,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: req.destinationAsset,
    amount: req.amount,
    refundTo: req.refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient: req.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline,
    quoteWaitingTimeMs: 5000,
  };
  const res = await fetch(`${ONE_CLICK_BASE}/v0/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`1Click quote failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const q = data?.quote;
  if (!q || typeof q.amountOut !== "string") {
    throw new Error(`1Click quote response missing quote.amountOut: ${JSON.stringify(data).slice(0, 300)}`);
  }
  // Safety invariant: a dry quote must never issue a deposit address.
  if (q.depositAddress) {
    throw new Error("1Click returned a depositAddress for a dry quote — refusing to proceed.");
  }
  return {
    quote: {
      amountIn: q.amountIn,
      amountInFormatted: q.amountInFormatted ?? q.amountIn,
      amountInUsd: q.amountInUsd ?? "?",
      amountOut: q.amountOut,
      amountOutFormatted: q.amountOutFormatted ?? q.amountOut,
      amountOutUsd: q.amountOutUsd ?? "?",
      minAmountOut: q.minAmountOut ?? q.amountOut,
      timeEstimateSeconds: Number(q.timeEstimate ?? 0),
      depositAddress: q.depositAddress ?? null,
    },
    raw: data,
  };
}
