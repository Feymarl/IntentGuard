// IntentGuard — REUSED BASELINE (MintGuard, our own pre-hackathon code).
// Copied verbatim from ~/workspace/hackathon-near-mintguard/src/vetting/ (project #1).
// See ../../BASELINE.md. Only the NEAR Intents integration in this repo is new.
// MintGuard — Robinhood Chain adapter (chainId 4663).
// Orbit L2 (Arbitrum Dedicated Blockchain), ETH gas, Blockscout explorer.
//
// GoPlus coverage VERIFIED live 2026-11-11: the token_security API
// answers for chain 4663 (code 1, full data incl. UniV3 pool). Sourcify
// coverage also verified live: chain 4663 is supported.
//
// NOTE on the Blockscout fallback: the mainnet Blockscout API
// (robinhoodchain.blockscout.com/api/v2) is Cloudflare-blocked from
// this VM (HTTP 403, verified 2026-11-11). The blockscoutBaseUrl below
// is wired in anyway — the fallback only fires when Sourcify 404s, and
// a Blockscout error propagates instead of silently BLOCKing. Verify
// mainnet Blockscout access from another egress before relying on it
// for mainnet vetting; Sourcify alone already covers the chain.
//
// Mainnet is a VETTING target only — never a broadcast target
// (see src/signing/chains.ts: only testnet configs live there).

import type { ChainAdapter, TokenSecurity } from "../core/types.js";
import { parseGoPlusResponse } from "../core/safety.js";
import { BROWSER_UA } from "../sourcify.js";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1/token_security";

export async function fetchGoPlusRobinhood(address: string): Promise<TokenSecurity | null> {
  const lower = address.toLowerCase();
  const url = `${GOPLUS_BASE}/4663?contract_addresses=${lower}`;
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) return null;
  const body: any = await res.json().catch(() => null);
  return parseGoPlusResponse(body, lower);
}

export const robinhoodAdapter: ChainAdapter = {
  key: "robinhood",
  name: "Robinhood Chain",
  chainId: 4663,
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  sourcifyChainId: 4663,
  goplusChainId: 4663,
  getTokenSecurity: fetchGoPlusRobinhood,
  blockscoutBaseUrl: "https://robinhoodchain.blockscout.com/api/v2",
};

/** Re-exported for symmetry with bsc.ts; the registry lives there. */
export const ROBINHOOD_KEY = "robinhood";
