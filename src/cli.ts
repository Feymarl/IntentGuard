// IntentGuard — CLI.
//   npm run vet  -- --chain base --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
//   npm run gate -- --from near --to base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --amount 0.1
//
// `vet` only vets a token (read-only). `gate` vets + fetches a DRY 1Click
// quote when the verdict allows it. Nothing here sends a transaction or
// spends funds: quotes are dry, vetting is read-only.

import { vetToken } from "./vetting/token.js";
import { gateSwap } from "./intents/gate.js";
import { WNEAR_ASSET_ID } from "./intents/oneclick.js";

// Placeholder addresses for DRY quotes only. A dry quote issues no deposit
// address and moves no funds, so these are never paid. refundTo is on the
// ORIGIN chain (NEAR) so it must be a NEAR account — the default is the
// project owner's account (feymar.near). recipient is on the DESTINATION
// chain (an EVM chain here) so it is an EVM address — the default is the
// address from the official 1Click docs example. Real swaps would use the
// user's own addresses.
const DEMO_REFUND_TO_NEAR = "feymar.near";
const DEMO_RECIPIENT_EVM = "0x2527D02599Ba641c19FEa793cD0F167589a0f10D";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

function parseDestination(spec: string): { chain: string; address: string } {
  const [chain, address] = spec.split(":");
  if (!chain || !address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`--to must be <chain>:<0x-address>, e.g. base:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (got "${spec}")`);
  }
  return { chain, address };
}

/** 0.1 NEAR = 10^23 yocto (wNEAR has 24 decimals). */
function nearToYocto(near: string): string {
  const [whole, frac = ""] = near.split(".");
  const padded = (frac + "0".repeat(24)).slice(0, 24);
  return BigInt(whole + padded).toString();
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "vet") {
    const chain = arg("chain", "base")!;
    const token = arg("token");
    if (!token) throw new Error("--token <0x-address> is required");
    const verdict = await vetToken(token, { chain });
    console.log(JSON.stringify(verdict, null, 2));
    return;
  }

  if (cmd === "gate") {
    const from = arg("from", "near")!;
    const to = arg("to");
    if (!to) throw new Error("--to <chain>:<0x-address> is required");
    const amountNear = arg("amount", "0.1")!;
    if (from !== "near") {
      throw new Error(`Only --from near is supported in this demo (origin is wNEAR). Got "${from}".`);
    }
    const { chain, address } = parseDestination(to);
    const result = await gateSwap({
      originAsset: WNEAR_ASSET_ID,
      destinationChain: chain,
      destinationAddress: address,
      amount: nearToYocto(amountNear),
      refundTo: arg("refund-to", DEMO_REFUND_TO_NEAR)!,
      recipient: arg("recipient", DEMO_RECIPIENT_EVM)!,
    });
    console.log(`\n=== IntentGuard gate ===`);
    console.log(`Swap: ${amountNear} NEAR -> ${chain}:${address}`);
    console.log(`Decision: ${result.decision}`);
    console.log(`Verdict: ${result.verdict.symbol ?? "?"} ${result.verdict.score}/100 (${result.verdict.verdict})`);
    for (const r of result.verdict.risks) {
      console.log(`  [${r.severity}] ${r.code}: ${r.message}`);
    }
    if (result.quote) {
      console.log(`Dry quote: ${result.quote.amountInFormatted} NEAR in -> ${result.quote.amountOutFormatted} out (~$${result.quote.amountOutUsd}), min out ${result.quote.minAmountOut}, ~${result.quote.timeEstimateSeconds}s.`);
      console.log(`Deposit address: ${result.quote.depositAddress ?? "none (dry run — no funds can move)"}`);
    }
    console.log(result.summary);
    return;
  }

  console.error("Usage:\n  npm run vet  -- --chain <chain> --token <0x-address>\n  npm run gate -- --from near --to <chain>:<0x-address> --amount <NEAR>");
  process.exit(2);
}

main().catch((err) => {
  console.error(`Error: ${err?.message ?? err}`);
  process.exit(1);
});
