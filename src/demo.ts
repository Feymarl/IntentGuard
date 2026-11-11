// IntentGuard — demo script (the full decision table).
//   npm run demo
//
// Case 1 (BLOCKED): swap 0.1 NEAR -> SQUID on BSC.
//   SQUID (0xA167d46c9087a1D9ED15d8d08BFB5bA1BcA0C4aE) — the infamous
//   2021 Squid Game honeypot. GoPlus still flags is_honeypot=1 (verified
//   live 12 Nov 2026); source unverified, no DEX pair left. The gate must
//   REFUSE the swap before any quote — and the honeypot reason must be in
//   the risks.
// Case 2 (ALLOWED): swap 0.1 NEAR -> USDC on Base.
//   USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) — verified source,
//   deep liquidity, clean GoPlus row. The gate must ALLOW and show a real
//   DRY 1Click quote (no funds move).
// Case 3 (ALLOWED_WITH_WARNING): swap 0.1 NEAR -> KAITO on Base.
//   KAITO (0x98d0baa52b2d063e780de12f615f963fe8537553) — verified source,
//   clean GoPlus row, but deepest DEX pair only ~$7.8k liquidity
//   (verified live 12 Nov 2026: RISKY 60/100, thin_liquidity). The gate
//   must show the dry quote WITH the warning — execution would need an
//   explicit risk acknowledgment first.
//
// Exits 0 only when all three cases behave as expected; exits 1 otherwise.
// Everything is read-only + dry quotes: no wallet, no funds, no keys.

import { gateSwap } from "./intents/gate.js";
import { WNEAR_ASSET_ID } from "./intents/oneclick.js";
import type { GateResult } from "./intents/gate.js";

const REFUND_TO_NEAR = "feymar.near"; // origin chain is NEAR: must be a NEAR account (dry quote — no funds move)
const RECIPIENT_EVM = "0x2527D02599Ba641c19FEa793cD0F167589a0f10D"; // destination chain is Base: EVM address (docs example)
const AMOUNT_YOCTO_0_1_NEAR = "100000000000000000000000";

const SQUID_BSC = "0xA167d46c9087a1D9ED15d8d08BFB5bA1BcA0C4aE";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const KAITO_BASE = "0x98d0baa52b2d063e780de12f615f963fe8537553";

function section(title: string): void {
  console.log(`\n${"=".repeat(64)}\n${title}\n${"=".repeat(64)}`);
}

function printResult(r: GateResult): void {
  console.log(`Decision: ${r.decision}`);
  console.log(`Verdict: ${r.verdict.symbol ?? "?"} ${r.verdict.score}/100 (${r.verdict.verdict})`);
  for (const risk of r.verdict.risks) console.log(`  [${risk.severity}] ${risk.code}: ${risk.message}`);
  if (r.quote) {
    console.log(`Dry quote: ${r.quote.amountInFormatted} NEAR in -> ${r.quote.amountOutFormatted} out (~$${r.quote.amountOutUsd}), min out ${r.quote.minAmountOut}, ~${r.quote.timeEstimateSeconds}s.`);
    console.log(`Deposit address: ${r.quote.depositAddress ?? "none (dry run — no funds can move)"}`);
  } else {
    console.log("Quote fetched: NO");
  }
  console.log(r.summary);
}

async function main(): Promise<void> {
  let ok = true;

  section("CASE 1 — 0.1 NEAR -> SQUID (BSC): expect BLOCKED (honeypot)");
  const blocked = await gateSwap({
    originAsset: WNEAR_ASSET_ID,
    destinationChain: "bsc",
    destinationAddress: SQUID_BSC,
    amount: AMOUNT_YOCTO_0_1_NEAR,
    refundTo: REFUND_TO_NEAR,
    recipient: RECIPIENT_EVM,
  });
  printResult(blocked);
  const hasHoneypotRisk = blocked.verdict.risks.some((r) => r.code === "honeypot");
  if (blocked.decision !== "BLOCKED" || blocked.quote !== null || !hasHoneypotRisk) {
    console.error("CASE 1 FAILED: expected BLOCKED with no quote and a honeypot risk.");
    ok = false;
  } else {
    console.log("CASE 1 PASSED.");
  }

  section("CASE 2 — 0.1 NEAR -> USDC (Base): expect ALLOWED + dry quote");
  const allowed = await gateSwap({
    originAsset: WNEAR_ASSET_ID,
    destinationChain: "base",
    destinationAddress: USDC_BASE,
    amount: AMOUNT_YOCTO_0_1_NEAR,
    refundTo: REFUND_TO_NEAR,
    recipient: RECIPIENT_EVM,
  });
  printResult(allowed);
  if (allowed.decision !== "ALLOWED" || !allowed.quote || allowed.quote.depositAddress) {
    console.error("CASE 2 FAILED: expected ALLOWED with a dry quote and no deposit address.");
    ok = false;
  } else {
    console.log("CASE 2 PASSED.");
  }

  section("CASE 3 — 0.1 NEAR -> KAITO (Base): expect ALLOWED_WITH_WARNING + dry quote");
  const risky = await gateSwap({
    originAsset: WNEAR_ASSET_ID,
    destinationChain: "base",
    destinationAddress: KAITO_BASE,
    amount: AMOUNT_YOCTO_0_1_NEAR,
    refundTo: REFUND_TO_NEAR,
    recipient: RECIPIENT_EVM,
  });
  printResult(risky);
  if (risky.decision !== "ALLOWED_WITH_WARNING" || !risky.quote || risky.quote.depositAddress) {
    console.error("CASE 3 FAILED: expected ALLOWED_WITH_WARNING with a dry quote and no deposit address.");
    ok = false;
  } else {
    console.log("CASE 3 PASSED.");
  }

  section(ok ? "DEMO PASSED — all three cases behaved as expected." : "DEMO FAILED — see above.");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`Demo error: ${err?.message ?? err}`);
  process.exit(1);
});
