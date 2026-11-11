# Baseline disclosure (NEAR Hackathon Q-002 / Q-005)

IntentGuard reuses our own pre-hackathon code as its baseline. Only the
NEAR Intents integration built in the hackathon window (12–14 Nov 2026)
is new, and only that integration is claimed as the hackathon work.

## Reused baseline (from MintGuard, our project #1)

- `src/vetting/core/{types,safety,selectors,engine}.ts` — the chain-agnostic
  vetting engine: on-chain reads (eth_call), Sourcify verification,
  GoPlus token-security parsing, risk scoring (SAFE / RISKY / BLOCK).
  Copied verbatim from `~/workspace/hackathon-near-mintguard/src/vetting/`.
- `src/vetting/{sourcify,blockscout,rpc}.ts` — Sourcify v2 + Blockscout v2
  source clients and the ethers JSON-RPC provider factory. Copied verbatim.
- `src/vetting/adapters/*` — chain adapters (BSC, Arbitrum, Robinhood,
  testnets). Copied verbatim, plus two new adapters written in the window
  (`ethereum.ts`, `base.ts`) following the same pattern.

MintGuard itself vets contracts you MINT; IntentGuard vets tokens you BUY
via NEAR Intents. Different action, different NEAR tech (Intents vs Chain
Signatures), different user (trader vs minting agent).

## New in the hackathon window (the judged work)

- `src/vetting/core/tokenScoring.ts` + `src/vetting/core/tokenEngine.ts` —
  a token-focused vetting path (ERC-20 detection, liquidity check): the
  MintGuard engine is mint-focused and returns NOT_MINT for plain tokens.
- `src/vetting/liquidity.ts` — DexScreener pair/liquidity reads.
- `src/intents/oneclick.ts` — NEAR Intents 1Click quote client (dry mode).
- `src/intents/gate.ts` — the swap gate: vet → decide → quote.
- `src/cli.ts`, `src/demo.ts`, `src/server.ts`, `public/index.html` —
  CLI, demo script, web UI.
- `tests/` — token-scoring and gate tests.

## The other project (Q-015 independence disclosure)

Our other NEAR Hackathon 2026 project is **MintGuard**
(https://github.com/Feymarl/MintGuard, track: Agent Economy) — an AI agent
on NEAR that vets free mints and executes them cross-chain via NEAR Chain
Signatures. IntentGuard is independent: it shares only the reused vetting
baseline above, and neither project depends on the other at runtime.
