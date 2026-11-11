// IntentGuard — REUSED BASELINE (MintGuard, our own pre-hackathon code).
// Copied verbatim from ~/workspace/hackathon-near-mintguard/src/vetting/ (project #1).
// See ../../BASELINE.md. Only the NEAR Intents integration in this repo is new.
// MintGuard — Robinhood Chain Testnet adapter (chainId 46630).
// Orbit L2 (Arbitrum Dedicated Blockchain), ETH gas, Blockscout explorer.
//
// GoPlus token_security does NOT cover chain 46630 (verified live
// 2026-11-11: the API answers code 2022 "The main chain is not
// supported"). Handled by OMISSION, exactly like the bsc-testnet and
// arbitrum-sepolia adapters: goplusChainId is unset and
// getTokenSecurity is absent, so the engine treats token security as
// "no signal" (tokenSecurity null). It never fails the vet, and no
// request is ever sent to GoPlus for an unsupported chain.
//
// Sourcify coverage VERIFIED live 2026-11-11: chain 46630 is
// supported, and a real Blockscout-verified contract (LockedLiquidity)
// returns a full ABI from Sourcify v2. Coverage is PARTIAL, not zero:
// contracts verified only through Blockscout's own verifier 404 on
// Sourcify, so the adapter also carries blockscoutBaseUrl — the
// vetting entry point falls back to Blockscout when Sourcify has no
// record (see src/vetting/verdict.ts).
//
// RPC endpoint verified live 2026-11-11 via eth_chainId (0xb626) +
// eth_blockNumber. Gas ~0.01 gwei — effectively free.

import type { ChainAdapter } from "../core/types.js";

export const robinhoodTestnetAdapter: ChainAdapter = {
  key: "robinhood-testnet",
  name: "Robinhood Chain Testnet",
  chainId: 46630,
  rpcUrls: ["https://rpc.testnet.chain.robinhood.com"],
  sourcifyChainId: 46630,
  // goplusChainId intentionally omitted: GoPlus does not support chain 46630.
  // No getTokenSecurity on purpose — see the header comment.
  blockscoutBaseUrl: "https://explorer.testnet.chain.robinhood.com/api/v2",
};

/** Re-exported for symmetry with bsc.ts; the registry lives there. */
export const ROBINHOOD_TESTNET_KEY = "robinhood-testnet";
