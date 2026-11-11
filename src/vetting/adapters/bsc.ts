// IntentGuard — REUSED BASELINE (MintGuard, our own pre-hackathon code).
// Copied verbatim from ~/workspace/hackathon-near-mintguard/src/vetting/ (project #1).
// See ../../BASELINE.md. Only the NEAR Intents integration in this repo is new.
// MintGuard — BSC adapter (the first ChainAdapter).
// All BSC-specific knowledge lives here: RPC endpoints, Sourcify chain id
// (56), GoPlus chain id (56). The core engine consumes this adapter through
// the ChainAdapter interface — a new chain is a new file like this one.
//
// NOTE: BSC dataseed endpoints reject UA-less requests; the UA header is
// attached by the rpc.ts provider factory, not here.

import type { ChainAdapter, TokenSecurity } from "../core/types.js";
import { parseGoPlusResponse } from "../core/safety.js";
import { BROWSER_UA } from "../sourcify.js";
import { bscTestnetAdapter } from "./bsc-testnet.js";
import { arbitrumAdapter } from "./arbitrum.js";
import { arbitrumSepoliaAdapter } from "./arbitrum-sepolia.js";
import { robinhoodAdapter } from "./robinhood.js";
import { robinhoodTestnetAdapter } from "./robinhood-testnet.js";
import { ethereumAdapter } from "./ethereum.js";
import { baseAdapter } from "./base.js";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1/token_security";

export async function fetchGoPlusBsc(address: string): Promise<TokenSecurity | null> {
  const lower = address.toLowerCase();
  const url = `${GOPLUS_BASE}/56?contract_addresses=${lower}`;
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) return null;
  const body: any = await res.json().catch(() => null);
  return parseGoPlusResponse(body, lower);
}

export const bscAdapter: ChainAdapter = {
  key: "bsc",
  name: "BNB Smart Chain",
  chainId: 56,
  rpcUrls: [
    "https://bsc-dataseed1.bnbchain.org",
    "https://bsc-dataseed2.bnbchain.org",
    "https://bsc-dataseed1.defibit.io",
    "https://bsc-dataseed.bnbchain.org",
  ],
  sourcifyChainId: 56,
  goplusChainId: 56,
  getTokenSecurity: fetchGoPlusBsc,
};

/** Adapter registry. New chains register here; the CLI picks by --chain.
 *  bsc-testnet (97) is registered alongside bsc (56): same family, but
 *  vetting a testnet contract through the mainnet adapter checks the
 *  WRONG chain (an address that only exists on testnet reads as "no
 *  code" on mainnet). The demo's sign/full modes vet on bsc-testnet.
 *  Arbitrum One (42161) and Arbitrum Sepolia (421614) joined 2026-11-09
 *  for the Dubai hackathon adapter: same rule — vet on the chain the
 *  contract actually lives on.
 *  Robinhood Chain (4663) and Robinhood Chain Testnet (46630) joined
 *  2026-11-11 for the São Paulo hackathon rehearsal: same rule again. */
export const ADAPTERS: Record<string, ChainAdapter> = {
  bsc: bscAdapter,
  "bsc-testnet": bscTestnetAdapter,
  arbitrum: arbitrumAdapter,
  "arbitrum-sepolia": arbitrumSepoliaAdapter,
  robinhood: robinhoodAdapter,
  "robinhood-testnet": robinhoodTestnetAdapter,
  ethereum: ethereumAdapter,
  base: baseAdapter,
};

export function getAdapter(chainKey: string): ChainAdapter {
  const adapter = ADAPTERS[chainKey.toLowerCase()];
  if (!adapter) {
    throw new Error(
      `Unknown chain "${chainKey}". Available: ${Object.keys(ADAPTERS).join(", ")}. ` +
        `Add a new adapter under src/vetting/adapters/ to support another chain.`,
    );
  }
  return adapter;
}
