// IntentGuard — Base adapter (NEW in the hackathon window, written
// 12 Nov 2026, following the MintGuard adapter pattern in bsc.ts).
// RPC: publicnode Base endpoint (verified working from this VM).
// Sourcify chain id 8453, GoPlus chain id 8453.
// Blockscout fallback: basescan's API is Etherscan-compatible, not
// Blockscout v2 — so no blockscoutBaseUrl; Sourcify is the source check.

import type { ChainAdapter, TokenSecurity } from "../core/types.js";
import { parseGoPlusResponse } from "../core/safety.js";
import { BROWSER_UA } from "../sourcify.js";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1/token_security";

export async function fetchGoPlusBase(address: string): Promise<TokenSecurity | null> {
  const lower = address.toLowerCase();
  const url = `${GOPLUS_BASE}/8453?contract_addresses=${lower}`;
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) return null;
  const body: any = await res.json().catch(() => null);
  return parseGoPlusResponse(body, lower);
}

export const baseAdapter: ChainAdapter = {
  key: "base",
  name: "Base",
  chainId: 8453,
  rpcUrls: [
    "https://base-rpc.publicnode.com",
    "https://mainnet.base.org",
  ],
  sourcifyChainId: 8453,
  goplusChainId: 8453,
  getTokenSecurity: fetchGoPlusBase,
};
