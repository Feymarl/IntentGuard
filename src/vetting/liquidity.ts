// IntentGuard — DexScreener liquidity reads (NEW in the hackathon window).
// Free, no-auth DexScreener API: GET /token-pairs/v1/{chain}/{token}.
// Used by the token vetting path: a swap destination with no meaningful
// DEX liquidity is a trap signal (you can buy in, but you cannot sell out
// at any sane price). Returns null when the API is unreachable — the
// scorer treats "unknown" as a deduction, never as a pass.

import { BROWSER_UA } from "./sourcify.js";

export interface LiquiditySignal {
  /** Number of DEX pairs found for the token. */
  pairCount: number;
  /** USD liquidity of the deepest pair, null when no pairs exist. */
  topLiquidityUsd: number | null;
  /** dexId of the deepest pair, e.g. "pancakeswap". */
  topDex: string | null;
  /** Pair address of the deepest pair. */
  topPair: string | null;
}

/** DexScreener chain slug for a chain id; null when unmapped. */
export function dexscreenerChainSlug(chainId: number): string | null {
  switch (chainId) {
    case 1:
      return "ethereum";
    case 56:
      return "bsc";
    case 8453:
      return "base";
    case 42161:
      return "arbitrum";
    case 10:
      return "optimism";
    case 137:
      return "polygon";
    default:
      return null;
  }
}

export async function fetchLiquidity(
  chainId: number,
  address: string,
): Promise<LiquiditySignal | null> {
  const slug = dexscreenerChainSlug(chainId);
  if (!slug) return null;
  const url = `https://api.dexscreener.com/token-pairs/v1/${slug}/${address.toLowerCase()}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const pairs: any = await res.json().catch(() => null);
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return { pairCount: 0, topLiquidityUsd: null, topDex: null, topPair: null };
  }
  let top: any = null;
  let topLiq = -1;
  for (const p of pairs) {
    const liq = Number(p?.liquidity?.usd);
    if (Number.isFinite(liq) && liq > topLiq) {
      topLiq = liq;
      top = p;
    }
  }
  if (!top) {
    return { pairCount: pairs.length, topLiquidityUsd: null, topDex: null, topPair: null };
  }
  return {
    pairCount: pairs.length,
    topLiquidityUsd: topLiq,
    topDex: typeof top?.dexId === "string" ? top.dexId : null,
    topPair: typeof top?.pairAddress === "string" ? top.pairAddress : null,
  };
}
