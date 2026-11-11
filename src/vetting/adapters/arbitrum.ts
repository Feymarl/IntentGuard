// IntentGuard — REUSED BASELINE (MintGuard, our own pre-hackathon code).
// Copied verbatim from ~/workspace/hackathon-near-mintguard/src/vetting/ (project #1).
// See ../../BASELINE.md. Only the NEAR Intents integration in this repo is new.
// MintGuard — Arbitrum One adapter (chainId 42161).
// Same ChainAdapter shape as BSC mainnet: RPC endpoints, Sourcify
// chain id (42161), GoPlus chain id (42161).
//
// GoPlus coverage VERIFIED live 2026-11-09: the token_security API
// answers for chain 42161 (unlike 421614, which it rejects with
// code 2022 "The main chain is not supported"). Sourcify coverage
// also verified live: chain 42161 is supported.
// RPC endpoints verified live 2026-11-09 via eth_blockNumber.

import type { ChainAdapter, TokenSecurity } from "../core/types.js";
import { parseGoPlusResponse } from "../core/safety.js";
import { BROWSER_UA } from "../sourcify.js";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1/token_security";

export async function fetchGoPlusArbitrum(address: string): Promise<TokenSecurity | null> {
  const lower = address.toLowerCase();
  const url = `${GOPLUS_BASE}/42161?contract_addresses=${lower}`;
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) return null;
  const body: any = await res.json().catch(() => null);
  return parseGoPlusResponse(body, lower);
}

export const arbitrumAdapter: ChainAdapter = {
  key: "arbitrum",
  name: "Arbitrum One",
  chainId: 42161,
  rpcUrls: [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum.drpc.org",
    "https://arbitrum-one-rpc.publicnode.com",
  ],
  sourcifyChainId: 42161,
  goplusChainId: 42161,
  getTokenSecurity: fetchGoPlusArbitrum,
};

/** Re-exported for symmetry with bsc.ts; the registry lives there. */
export const ARBITRUM_KEY = "arbitrum";
