// IntentGuard — gate tests (offline, no network).
// The gate's decision logic is tested with vetToken + requestDryQuote
// stubbed: BLOCK/NOT_TOKEN must refuse before any quote is fetched,
// SAFE must allow with a quote, RISKY must allow with a warning + quote.
// Live end-to-end behaviour is covered by `npm run demo`.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/vetting/token.js", () => ({
  vetToken: vi.fn(),
}));
vi.mock("../src/intents/oneclick.js", () => ({
  evmAssetId: (chain: string, address: string) =>
    `nep141:${chain}-${address.toLowerCase()}.omft.near`,
  requestDryQuote: vi.fn(),
  WNEAR_ASSET_ID: "nep141:wrap.near",
}));

import { vetToken } from "../src/vetting/token.js";
import { requestDryQuote } from "../src/intents/oneclick.js";
import { gateSwap, type GateRequest } from "../src/intents/gate.js";
import type { TokenVettingVerdict } from "../src/vetting/core/tokenScoring.js";
import type { DryQuoteResult } from "../src/intents/oneclick.js";

const mockedVetToken = vi.mocked(vetToken);
const mockedRequestDryQuote = vi.mocked(requestDryQuote);

function verdict(overrides: Partial<TokenVettingVerdict> = {}): TokenVettingVerdict {
  return {
    contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    chain: "base",
    chainId: 8453,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    verified: true,
    exactMatch: true,
    isProxy: false,
    implementation: null,
    topLiquidityUsd: 50_000_000,
    pairCount: 120,
    risks: [],
    score: 95,
    verdict: "SAFE",
    ...overrides,
  };
}

function dryQuote(): DryQuoteResult {
  return {
    quote: {
      amountIn: "100000000000000000000000",
      amountInFormatted: "0.1",
      amountInUsd: "0.37",
      amountOut: "372600",
      amountOutFormatted: "0.3726",
      amountOutUsd: "0.37",
      minAmountOut: "369310",
      timeEstimateSeconds: 24,
      depositAddress: null,
    },
    raw: {},
  };
}

const REQ: GateRequest = {
  originAsset: "nep141:wrap.near",
  destinationChain: "base",
  destinationAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  amount: "100000000000000000000000",
  refundTo: "feymar.near",
  recipient: "0x2527D02599Ba641c19FEa793cD0F167589a0f10D",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequestDryQuote.mockResolvedValue(dryQuote());
});

describe("gateSwap", () => {
  it("BLOCKED on a BLOCK verdict — and never fetches a quote", async () => {
    mockedVetToken.mockResolvedValue(
      verdict({
        score: 0,
        verdict: "BLOCK",
        risks: [
          {
            code: "honeypot",
            message: "GoPlus flags this token as a honeypot — buys succeed, sells fail.",
            severity: "block",
          },
        ],
      }),
    );
    const r = await gateSwap(REQ);
    expect(r.decision).toBe("BLOCKED");
    expect(r.quote).toBeNull();
    expect(mockedRequestDryQuote).not.toHaveBeenCalled();
    expect(r.summary).toMatch(/BLOCKED/);
  });

  it("BLOCKED on a NOT_TOKEN verdict — and never fetches a quote", async () => {
    mockedVetToken.mockResolvedValue(
      verdict({
        score: 0,
        verdict: "NOT_TOKEN",
        symbol: null,
        risks: [{ code: "no_code", message: "Address has no contract code.", severity: "block" }],
      }),
    );
    const r = await gateSwap(REQ);
    expect(r.decision).toBe("BLOCKED");
    expect(r.quote).toBeNull();
    expect(mockedRequestDryQuote).not.toHaveBeenCalled();
  });

  it("ALLOWED on a SAFE verdict — with the dry quote attached", async () => {
    mockedVetToken.mockResolvedValue(verdict());
    const r = await gateSwap(REQ);
    expect(r.decision).toBe("ALLOWED");
    expect(r.quote).not.toBeNull();
    expect(r.quote?.depositAddress).toBeNull();
    expect(mockedRequestDryQuote).toHaveBeenCalledTimes(1);
    const call = mockedRequestDryQuote.mock.calls[0][0];
    expect(call.destinationAsset).toContain("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
    expect(call.originAsset).toBe("nep141:wrap.near");
  });

  it("ALLOWED_WITH_WARNING on a RISKY verdict — quote shown with the risks", async () => {
    mockedVetToken.mockResolvedValue(
      verdict({
        score: 60,
        verdict: "RISKY",
        symbol: "KAITO",
        topLiquidityUsd: 7803.17,
        risks: [
          {
            code: "thin_liquidity",
            message: "Deepest DEX pair holds only $7803.17 of liquidity — a small sell moves the price hard.",
            severity: "warn",
          },
        ],
      }),
    );
    const r = await gateSwap(REQ);
    expect(r.decision).toBe("ALLOWED_WITH_WARNING");
    expect(r.quote).not.toBeNull();
    expect(r.summary).toMatch(/WARNING/);
    expect(r.summary).toMatch(/thin_liquidity|small sell moves the price/);
  });
});
