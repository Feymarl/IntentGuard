// IntentGuard — Ethereum adapter (NEW in the hackathon window, written
// 12 Nov 2026, following the MintGuard adapter pattern in bsc.ts).
// RPC: publicnode (works with a browser UA). Sourcify chain id 1,
// GoPlus chain id 1. Blockscout: Etherscan is not Blockscout-compatible,
// so no blockscoutBaseUrl — Sourcify is the only source check on Ethereum.

import type { ChainAdapter, TokenSecurity } from "../core/types.js";
import { parseGoPlusResponse } from "../core/safety.js";
import { BROWSER_UA } from "../sourcify.js";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1/token_security";

export async function fetchGoPlusEth(address: string): Promise<TokenSecurity | null> {
  const lower = address.toLowerCase();
  const url = `${GOPLUS_BASE}/1?contract_addresses=${lower}`;
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) return null;
  const body: any = await res.json().catch(() => null);
  return parseGoPlusResponse(body, lower);
}

export const ethereumAdapter: ChainAdapter = {
  key: "ethereum",
  name: "Ethereum",
  chainId: 1,
  rpcUrls: [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com",
  ],
  sourcifyChainId: 1,
  goplusChainId: 1,
  getTokenSecurity: fetchGoPlusEth,
};
