# IntentGuard — the bouncer for NEAR Intents swaps

**NEAR HACKATHON 2026 — Track: Unstoppable DeFi (`defi`)**
**Built at NEAR HACKATHON 2026** · by feymarl · payout account: `feymar.near`

> Before your intent executes, IntentGuard vets the token you're about to
> buy — honeypot, tax, owner, liquidity — and **blocks the swap if it's
> a trap**.

A swap into a honeypot is a one-way door: the buy succeeds, the sell
fails, the money is gone. NEAR Intents makes cross-chain swaps one click —
IntentGuard makes that click safe. It vets the **destination token**
before the intent executes and refuses to proceed when the token is a
trap. The quote is only shown when the token passes.

## What it does

1. **Vet** the destination token (read-only): source verification
   (Sourcify/Blockscout), GoPlus honeypot + buy/sell tax + owner, DEX
   liquidity (DexScreener). Score 0–100 → `SAFE` / `RISKY` / `BLOCK` /
   `NOT_TOKEN`.
2. **Gate**: `BLOCK` → swap refused, no quote is even fetched.
   `SAFE` → real dry quote shown. `RISKY` → quote shown with the risks;
   execution requires an explicit acknowledgment.
3. **Quote** (dry only): real solver pricing from the NEAR Intents 1Click
   API with `dry: true` — no deposit address is issued, no funds move.

## Try it (judge steps — no wallet, no funds, no keys)

```bash
npm install
npm test        # 13 offline unit tests, ~1s
npm run demo    # the full demo: BLOCKED + ALLOWED + WARNING swaps, ~35s
npm run serve   # web UI at http://localhost:3000 (same gate, browser form)
```

Expected demo output:

```
CASE 1 — 0.1 NEAR -> SQUID (BSC): BLOCKED (honeypot)
  SQUID 0/100 (BLOCK)
  [block] unverified: Token source is NOT verified ...
  [block] honeypot: GoPlus flags this token as a honeypot ...
  [block] no_liquidity: No DEX pair found for this token ...
  Quote fetched: NO

CASE 2 — 0.1 NEAR -> USDC (Base): ALLOWED + dry quote
  USDC 95/100 (SAFE)
  Dry quote: 0.1 NEAR in -> 0.36965 USDC out (~$0.37)
  Deposit address: none (dry run — no funds can move)

CASE 3 — 0.1 NEAR -> KAITO (Base): ALLOWED_WITH_WARNING + dry quote
  KAITO 60/100 (RISKY)
  [warn] thin_liquidity: Deepest DEX pair holds only $7803.41 ...
  Dry quote: 0.1 NEAR in -> 1.78686 KAITO out (~$0.37)
  Deposit address: none (dry run — no funds can move)

DEMO PASSED
```

Vet any token yourself:

```bash
npm run vet  -- --chain base --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
npm run gate -- --from near --to bsc:0xA167d46c9087a1D9ED15d8d08BFB5bA1BcA0C4aE --amount 0.1
```

Supported chains for vetting: `base`, `ethereum`, `bsc`, `arbitrum`,
`robinhood` (+ testnets). The gate's origin is wNEAR; the destination
can be any EVM token on a supported chain.

## How the gate decides

| Verdict | Score | Gate decision |
|---------|-------|---------------|
| `BLOCK` | ≤ 19 | **Swap refused.** No quote fetched. Reasons shown: unverified source, honeypot, tax > 10%, or top DEX pair liquidity < $1,000 (or no pair). |
| `RISKY` | 20–79 | Quote shown **with warnings**. Thin liquidity ($1k–$10k), tax 5–10%, partial verification. Execution needs an explicit risk acknowledgment. |
| `SAFE` | ≥ 80 | Quote shown. Swap may proceed. |
| `NOT_TOKEN` | 0 | Swap refused — the address is not an ERC-20 token. |

Design note: the gate vets **before** quoting (not quote-then-vet).
Vetting first is cheaper (no solver auction runs for a trap) and works
for any token — a honeypot is never on the 1Click token list, so
quote-first would fail on the quote instead of blocking on the verdict.
The decision is identical either way.

## Live demo vs dry demo

Intents has **no testnet** (hackathon rule Q-007), so a live executed
swap needs tiny mainnet funds. This repo implements **dry quotes only**
on purpose: `dry: true` returns real solver pricing with no deposit
address. The demo proves the whole gate end-to-end with zero funds.
A live-swap mode is intentionally absent — adding it is a one-flag
change (`dry: false` + a deposit + the user's own refund/recipient
addresses) and would need the owner's explicit approval for the exact
amount first.

## The other project (Q-015 independence disclosure)

Our other NEAR Hackathon 2026 project is **MintGuard**
(https://github.com/Feymarl/MintGuard, track: Agent Economy) — an AI
agent on NEAR that vets free mints and executes them cross-chain via
NEAR Chain Signatures. IntentGuard is independent: it shares only the
reused vetting baseline below, and neither project depends on the other
at runtime. MintGuard vets contracts you **mint**; IntentGuard vets
tokens you **buy**. Different action, different NEAR tech (Intents vs
Chain Signatures), different user (trader vs minting agent).

## Baseline disclosure (Q-002 / Q-005)

IntentGuard reuses our own pre-hackathon code as its baseline — see
[BASELINE.md](BASELINE.md) for the full list. In short: the MintGuard
vetting engine (Sourcify/Blockscout/GoPlus reads + risk scoring) is
reused verbatim; **new in the hackathon window** are the token-focused
scoring path (`src/vetting/core/tokenScoring.ts`,
`src/vetting/core/tokenEngine.ts`), the DexScreener liquidity check,
the 1Click quote client, the swap gate, the CLI, and the demo. Only the
NEAR Intents integration is claimed as hackathon work.

## Project structure

```
src/
  vetting/            # token vetting (engine reused from MintGuard, see BASELINE.md)
    core/tokenScoring.ts   # NEW: token scoring (pure, tested)
    core/tokenEngine.ts    # NEW: ERC-20 reads + vet orchestration
    liquidity.ts           # NEW: DexScreener liquidity
    token.ts               # NEW: vetToken() entry point
    adapters/              # chain adapters (bsc/arbitrum/robinhood reused; ethereum/base NEW)
  intents/
    oneclick.ts       # NEW: 1Click dry-quote client
    gate.ts           # NEW: vet -> decide -> quote
  cli.ts              # NEW: `vet` / `gate` commands
  demo.ts             # NEW: BLOCKED vs ALLOWED vs WARNING demo (exit 0 = all as expected)
  server.ts           # NEW: web UI server (`npm run serve`, http://localhost:3000)
public/index.html     # NEW: swap-gate UI (form + 3 one-click demo cases)
tests/                # 13 offline unit tests (9 scoring + 4 gate)
```

## Known limits (honest)

- The BLOCK demo case is SQUID, the 2021 Squid Game honeypot — GoPlus
  still flags `is_honeypot=1` (verified live 12 Nov 2026). Its source is
  also unverified and it has no DEX pair left, so the verdict carries
  three block reasons; the honeypot flag is the headline trap signal.
- The RISKY demo case (KAITO) sits on live liquidity: its top pair was
  ~$7.8k on 12 Nov 2026, inside the $1k–$10k thin band. If that pair
  grows past $10k the verdict flips to SAFE and the demo's case-3
  assertion fails — re-run `npm run demo` before recording the video.
- Liquidity reads depend on DexScreener; if it is unreachable the
  scorer deducts 10 points ("liquidity unknown") instead of passing.
- Quotes are dry only (see above) — no live swap is executed by this repo.
