// IntentGuard — token scoring tests (offline, no network).
// Covers the hard-block rules and the SAFE/RISKY boundary.

import { describe, expect, it } from "vitest";
import {
  buildTokenVerdict,
  scoreToken,
  type TokenVettingInput,
} from "../src/vetting/core/tokenScoring.js";
import type { SourcifyResult, TokenSecurity } from "../src/vetting/core/types.js";

function baseInput(overrides: Partial<TokenVettingInput> = {}): TokenVettingInput {
  const sourcify: SourcifyResult = {
    verified: true,
    exactMatch: true,
    contractName: "USD Coin",
    abi: [],
  };
  const tokenSecurity: TokenSecurity = {
    isHoneypot: false,
    buyTax: 0,
    sellTax: 0,
    ownerRenounced: true,
  };
  return {
    contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chain: {
      hasCode: true,
      totalSupply: 1_000_000_000_000_000n,
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin",
      paused: false,
      owner: null,
      implementationSlot: null,
    },
    sourcify,
    tokenSecurity,
    liquidity: { pairCount: 120, topLiquidityUsd: 50_000_000, topDex: "uniswap" },
    ...overrides,
  };
}

describe("scoreToken", () => {
  it("SAFE 100 for a clean, verified, liquid token", () => {
    const { score, verdict } = scoreToken(baseInput());
    expect(verdict).toBe("SAFE");
    expect(score).toBe(100);
  });

  it("BLOCKs an unverified token (score capped at 19)", () => {
    const input = baseInput();
    input.sourcify = { verified: false, exactMatch: false, contractName: null, abi: [] };
    const { score, verdict, risks } = scoreToken(input);
    expect(verdict).toBe("BLOCK");
    expect(score).toBeLessThanOrEqual(19);
    expect(risks.some((r) => r.code === "unverified")).toBe(true);
  });

  it("BLOCKs a GoPlus-flagged honeypot", () => {
    const input = baseInput();
    input.tokenSecurity = { isHoneypot: true, buyTax: 0, sellTax: 99, ownerRenounced: false };
    const { verdict, risks } = scoreToken(input);
    expect(verdict).toBe("BLOCK");
    expect(risks.some((r) => r.code === "honeypot")).toBe(true);
  });

  it("BLOCKs tax above 10%", () => {
    const input = baseInput();
    input.tokenSecurity = { isHoneypot: false, buyTax: 12, sellTax: 0, ownerRenounced: true };
    const { verdict, risks } = scoreToken(input);
    expect(verdict).toBe("BLOCK");
    expect(risks.some((r) => r.code === "high_tax")).toBe(true);
  });

  it("BLOCKs a token with no DEX pair / dust liquidity", () => {
    const input = baseInput();
    input.liquidity = { pairCount: 1, topLiquidityUsd: 2.55, topDex: "pancakeswap" };
    const { verdict, risks } = scoreToken(input);
    expect(verdict).toBe("BLOCK");
    expect(risks.some((r) => r.code === "no_liquidity")).toBe(true);
  });

  it("RISKY (not BLOCK) for thin but real liquidity", () => {
    const input = baseInput();
    input.liquidity = { pairCount: 2, topLiquidityUsd: 5_000, topDex: "pancakeswap" };
    const { score, verdict, risks } = scoreToken(input);
    expect(verdict).toBe("RISKY");
    expect(score).toBe(60);
    expect(risks.some((r) => r.code === "thin_liquidity")).toBe(true);
  });

  it("NOT_TOKEN when totalSupply/decimals do not read", () => {
    const input = baseInput();
    input.chain = { ...input.chain, totalSupply: null, decimals: null };
    const { score, verdict } = scoreToken(input);
    expect(verdict).toBe("NOT_TOKEN");
    expect(score).toBe(0);
  });

  it("NOT_TOKEN when the address has no code", () => {
    const input = baseInput();
    input.chain = { ...input.chain, hasCode: false, totalSupply: null, decimals: null };
    const { verdict } = scoreToken(input);
    expect(verdict).toBe("NOT_TOKEN");
  });

  it("buildTokenVerdict carries the symbol, liquidity and risks", () => {
    const v = buildTokenVerdict(baseInput(), "base", 8453);
    expect(v.symbol).toBe("USDC");
    expect(v.chain).toBe("base");
    expect(v.chainId).toBe(8453);
    expect(v.topLiquidityUsd).toBe(50_000_000);
    expect(v.verdict).toBe("SAFE");
  });
});
