// IntentGuard — token-focused scoring (NEW in the hackathon window).
// Pure and offline: given a TokenVettingInput it produces risks, a 0-100
// score and a verdict. No network, no provider — unit-testable.
//
// This is the swap-side sibling of MintGuard's mint-focused scoring
// (core/scoring.ts). The mint engine returns NOT_MINT for a plain ERC-20
// because it requires a mint/claim function; a swap destination IS a plain
// ERC-20, so this scorer checks token-ness instead (totalSupply +
// decimals + symbol readable) and drops the mint simulation / quota
// sections. The shared risk rules are identical on purpose:
// unverified source, honeypot, and tax > 10% are hard BLOCKs in both.
//
// Hard-block rules (verdict BLOCK, score capped at 19):
//   - address has no code / is not an ERC-20 token -> NOT_TOKEN (score 0)
//   - unverified source                               -> BLOCK
//   - paused                                          -> BLOCK
//   - honeypot (GoPlus)                               -> BLOCK
//   - buy/sell tax > 10%                              -> BLOCK
//   - top DEX pair liquidity < $1,000 (or no pair)    -> BLOCK
// Everything else only deducts points; score >= 80 -> SAFE, else RISKY.

import type { Risk, SourcifyResult, TokenSecurity } from "./types.js";

export type TokenVerdictKind = "SAFE" | "RISKY" | "BLOCK" | "NOT_TOKEN";

export interface TokenChainSnapshot {
  hasCode: boolean;
  /** null when totalSupply() is not readable (not an ERC-20). */
  totalSupply: bigint | null;
  /** null when decimals() is not readable. */
  decimals: number | null;
  symbol: string | null;
  name: string | null;
  paused: boolean | null;
  owner: string | null;
  implementationSlot: string | null;
}

export interface TokenLiquidity {
  pairCount: number;
  topLiquidityUsd: number | null;
  topDex: string | null;
}

export interface TokenVettingInput {
  contract: string;
  chain: TokenChainSnapshot;
  sourcify: SourcifyResult;
  tokenSecurity: TokenSecurity | null;
  /** null when the liquidity provider was unreachable/unsupported. */
  liquidity: TokenLiquidity | null;
}

export interface TokenVettingVerdict {
  contract: string;
  chain: string;
  chainId: number;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  verified: boolean;
  exactMatch: boolean;
  isProxy: boolean;
  implementation: string | null;
  topLiquidityUsd: number | null;
  pairCount: number | null;
  risks: Risk[];
  score: number;
  verdict: TokenVerdictKind;
}

const BLOCK_SCORE_CAP = 19;
/** Below this top-pair liquidity (USD) the token is un-sellable in
 *  practice — a swap into it is a one-way door. */
export const MIN_LIQUIDITY_USD = 1_000;
/** Below this, liquidity is thin enough to deserve a heavy deduction. */
export const THIN_LIQUIDITY_USD = 10_000;

function risk(code: string, message: string, severity: Risk["severity"]): Risk {
  return { code, message, severity };
}

/** Is the contract an ERC-20 token? totalSupply + decimals must read. */
export function isErc20Token(chain: TokenChainSnapshot): boolean {
  return chain.hasCode && chain.totalSupply !== null && chain.decimals !== null;
}

export function scoreToken(input: TokenVettingInput): {
  risks: Risk[];
  score: number;
  verdict: TokenVerdictKind;
} {
  const risks: Risk[] = [];
  let score = 100;
  let hardBlock = false;

  const deduct = (pts: number, r: Risk) => {
    score -= pts;
    risks.push(r);
  };

  // --- 0. Is it even a contract / an ERC-20 token? -----------------------
  if (!input.chain.hasCode) {
    return {
      risks: [risk("no_code", "Address has no contract code.", "block")],
      score: 0,
      verdict: "NOT_TOKEN",
    };
  }
  if (!isErc20Token(input.chain)) {
    return {
      risks: [
        risk(
          "not_token",
          "totalSupply()/decimals() are not readable — this is not an ERC-20 token contract.",
          "block",
        ),
      ],
      score: 0,
      verdict: "NOT_TOKEN",
    };
  }

  // --- 1. Verification ----------------------------------------------------
  if (!input.sourcify.verified) {
    hardBlock = true;
    deduct(100, risk("unverified", "Token source is NOT verified on Sourcify or Blockscout — the code you would be buying into cannot be read.", "block"));
  } else if (!input.sourcify.exactMatch) {
    deduct(10, risk("partial_match", "Source verified but only a partial match.", "warn"));
  }

  // --- 2. Proxy -----------------------------------------------------------
  if (input.sourcify.isProxy || input.chain.implementationSlot) {
    deduct(
      5,
      risk(
        "proxy",
        `EIP-1967 proxy — logic lives in implementation ${input.sourcify.implementation ?? input.chain.implementationSlot ?? "unknown"}. Vet the implementation too.`,
        "warn",
      ),
    );
  }

  // --- 3. Paused ----------------------------------------------------------
  if (input.chain.paused === true) {
    hardBlock = true;
    deduct(100, risk("paused", "Token contract is paused — transfers are disabled.", "block"));
  }

  // --- 4. Token security (GoPlus) -----------------------------------------
  const ts: TokenSecurity | null = input.tokenSecurity;
  if (ts) {
    if (ts.isHoneypot === true) {
      hardBlock = true;
      deduct(100, risk("honeypot", "GoPlus flags this token as a honeypot — buys succeed, sells fail.", "block"));
    }
    const maxTax = Math.max(ts.buyTax ?? 0, ts.sellTax ?? 0);
    if (maxTax > 10) {
      hardBlock = true;
      deduct(100, risk("high_tax", `Token tax is ${maxTax}% (> 10%) — likely a fee trap.`, "block"));
    } else if (maxTax > 5) {
      deduct(25, risk("elevated_tax", `Token tax is ${maxTax}% (> 5%).`, "warn"));
    }
    if (ts.ownerRenounced === false) {
      deduct(5, risk("owner_not_renounced", "Token owner is not renounced.", "info"));
    }
  } else {
    deduct(10, risk("no_security_signal", "No independent token-security signal (GoPlus has no row for this token).", "warn"));
  }

  // --- 5. Liquidity -------------------------------------------------------
  const liq = input.liquidity;
  if (liq === null) {
    deduct(10, risk("liquidity_unknown", "Could not read DEX liquidity (provider unreachable) — cannot confirm an exit exists.", "warn"));
  } else if (liq.pairCount === 0 || liq.topLiquidityUsd === null) {
    hardBlock = true;
    deduct(100, risk("no_liquidity", "No DEX pair found for this token — there is nowhere to sell it.", "block"));
  } else if (liq.topLiquidityUsd < MIN_LIQUIDITY_USD) {
    hardBlock = true;
    deduct(
      100,
      risk(
        "no_liquidity",
        `Deepest DEX pair holds only $${liq.topLiquidityUsd.toFixed(2)} of liquidity (${liq.topDex ?? "unknown dex"}) — effectively un-sellable.`,
        "block",
      ),
    );
  } else if (liq.topLiquidityUsd < THIN_LIQUIDITY_USD) {
    deduct(
      40,
      risk(
        "thin_liquidity",
        `Deepest DEX pair holds only $${liq.topLiquidityUsd.toFixed(2)} of liquidity (${liq.topDex ?? "unknown dex"}) — a small sell moves the price hard.`,
        "warn",
      ),
    );
  }

  // --- Final verdict ------------------------------------------------------
  score = Math.max(0, Math.min(100, score));
  let verdict: TokenVerdictKind;
  if (hardBlock) {
    verdict = "BLOCK";
    score = Math.min(score, BLOCK_SCORE_CAP);
  } else if (score >= 80) {
    verdict = "SAFE";
  } else {
    verdict = "RISKY";
  }

  return { risks, score, verdict };
}

/** Assemble the full JSON verdict object from a TokenVettingInput. */
export function buildTokenVerdict(
  input: TokenVettingInput,
  chainKey: string,
  chainId: number,
): TokenVettingVerdict {
  const { risks, score, verdict } = scoreToken(input);
  return {
    contract: input.contract,
    chain: chainKey,
    chainId,
    symbol: input.chain.symbol,
    name: input.chain.name,
    decimals: input.chain.decimals,
    verified: input.sourcify.verified,
    exactMatch: input.sourcify.exactMatch,
    isProxy: Boolean(input.sourcify.isProxy || input.chain.implementationSlot),
    implementation: input.sourcify.implementation ?? input.chain.implementationSlot ?? null,
    topLiquidityUsd: input.liquidity?.topLiquidityUsd ?? null,
    pairCount: input.liquidity?.pairCount ?? null,
    risks,
    score,
    verdict,
  };
}
