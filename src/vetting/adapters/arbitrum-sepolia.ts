// IntentGuard — REUSED BASELINE (MintGuard, our own pre-hackathon code).
// Copied verbatim from ~/workspace/hackathon-near-mintguard/src/vetting/ (project #1).
// See ../../BASELINE.md. Only the NEAR Intents integration in this repo is new.
// MintGuard — Arbitrum Sepolia adapter (chainId 421614).
// Testnet sibling of Arbitrum One, and the broadcast target for the
// Dubai hackathon demo (T&C: submissions must be deployed on Arbitrum
// One, Arbitrum Sepolia, or an Orbit chain).
//
// GoPlus token_security does NOT cover chain 421614 (verified live
// 2026-11-09: the API answers code 2022 "The main chain is not
// supported"). That is handled by OMISSION, not by a fake — exactly
// like the BSC-testnet adapter: goplusChainId is unset and
// getTokenSecurity is absent, so the engine treats token security as
// "no signal" (tokenSecurity null). It never fails the vet, and no
// request is ever sent to GoPlus for an unsupported chain. A testnet
// NFT contract has no token to screen anyway; the on-chain reads +
// simulation + Sourcify verification carry the verdict.
//
// Sourcify coverage VERIFIED live 2026-11-09: chain 421614 is
// supported. RPC endpoints verified live via eth_blockNumber.

import type { ChainAdapter } from "../core/types.js";

export const arbitrumSepoliaAdapter: ChainAdapter = {
  key: "arbitrum-sepolia",
  name: "Arbitrum Sepolia",
  chainId: 421614,
  rpcUrls: [
    "https://sepolia-rollup.arbitrum.io/rpc",
    "https://arbitrum-sepolia.drpc.org",
    "https://arbitrum-sepolia-rpc.publicnode.com",
  ],
  sourcifyChainId: 421614,
  // goplusChainId intentionally omitted: GoPlus does not support chain 421614.
  // No getTokenSecurity on purpose — see the header comment.
};

/** Re-exported for symmetry with bsc.ts; the registry lives there. */
export const ARBITRUM_SEPOLIA_KEY = "arbitrum-sepolia";
