// IntentGuard — the swap gate (NEW in the hackathon window).
// Flow: vet the destination token FIRST, then quote only when the vetting
// allows it.
//
// Order note (deviation from SCOPE.md's "quote -> vet" sketch, deliberate):
// vetting first is cheaper (no solver auction is run for a trap) and works
// for ANY token, not just the ~229 assets on the 1Click list — a honeypot
// is never 1Click-listed, so quote-first would fail on the quote instead
// of blocking on the verdict. The gate decision is identical either way:
// BLOCK means the swap is refused, whatever the quote would have said.
//
// Decisions:
//   BLOCKED              — verdict BLOCK / NOT_TOKEN: swap refused, no quote.
//   ALLOWED              — verdict SAFE: dry quote shown, swap may proceed.
//   ALLOWED_WITH_WARNING — verdict RISKY: dry quote shown WITH the risks;
//                          the caller must acknowledge them explicitly
//                          (CLI --acknowledge-risks / UI checkbox) before
//                          any execution step is even offered.

import { vetToken } from "../vetting/token.js";
import {
  evmAssetId,
  requestDryQuote,
  type DryQuote,
} from "./oneclick.js";
import type { TokenVettingVerdict } from "../vetting/core/tokenScoring.js";

export type GateDecision = "BLOCKED" | "ALLOWED" | "ALLOWED_WITH_WARNING";

export interface GateRequest {
  /** Origin asset id, e.g. "nep141:wrap.near". */
  originAsset: string;
  /** Chain key of the destination token, e.g. "base", "bsc". */
  destinationChain: string;
  /** Destination token contract address (EVM). */
  destinationAddress: string;
  /** Amount in the smallest unit of the origin asset. */
  amount: string;
  refundTo: string;
  recipient: string;
}

export interface GateResult {
  decision: GateDecision;
  verdict: TokenVettingVerdict;
  /** Present only when the decision is ALLOWED / ALLOWED_WITH_WARNING. */
  quote: DryQuote | null;
  /** Human-readable one-liner for the UI / CLI. */
  summary: string;
}

export async function gateSwap(req: GateRequest): Promise<GateResult> {
  const verdict = await vetToken(req.destinationAddress, { chain: req.destinationChain });

  if (verdict.verdict === "BLOCK" || verdict.verdict === "NOT_TOKEN") {
    const reasons = verdict.risks
      .filter((r) => r.severity === "block")
      .map((r) => r.message)
      .join(" ");
    return {
      decision: "BLOCKED",
      verdict,
      quote: null,
      summary:
        `BLOCKED — swap refused. ${verdict.symbol ?? "Token"} scored ${verdict.score}/100 (${verdict.verdict}). ` +
        (reasons || "See risks."),
    };
  }

  const destinationAsset = evmAssetId(req.destinationChain, req.destinationAddress);
  const { quote } = await requestDryQuote({
    originAsset: req.originAsset,
    destinationAsset,
    amount: req.amount,
    refundTo: req.refundTo,
    recipient: req.recipient,
  });

  if (verdict.verdict === "SAFE") {
    return {
      decision: "ALLOWED",
      verdict,
      quote,
      summary:
        `ALLOWED — ${verdict.symbol ?? "Token"} scored ${verdict.score}/100 (SAFE). ` +
        `Dry quote: ${quote.amountInFormatted} in -> ${quote.amountOutFormatted} out (~$${quote.amountOutUsd}). No funds moved (dry run).`,
    };
  }

  // RISKY
  const warns = verdict.risks.map((r) => r.message).join(" ");
  return {
    decision: "ALLOWED_WITH_WARNING",
    verdict,
    quote,
    summary:
      `ALLOWED WITH WARNING — ${verdict.symbol ?? "Token"} scored ${verdict.score}/100 (RISKY). ` +
      `Dry quote: ${quote.amountInFormatted} in -> ${quote.amountOutFormatted} out (~$${quote.amountOutUsd}). ` +
      `Risks: ${warns} Acknowledge the risks before proceeding.`,
  };
}
