// IntentGuard — token vetting engine (NEW in the hackathon window).
// Orchestrates Sourcify + on-chain ERC-20 reads + GoPlus + DexScreener
// liquidity through a ChainAdapter, then scores with tokenScoring.ts.
// Reuses the read helpers from the MintGuard engine (readUintBig,
// readBool, readAddress) — those are chain-agnostic eth_call wrappers.
// Read-only: only eth_call / getCode / getStorage / HTTP GET. Never
// sends a transaction.

import { ethers } from "ethers";
import type {
  ChainAdapter,
  SourcifyResult,
  TokenSecurity,
} from "./types.js";
import { buildTokenVerdict, type TokenChainSnapshot, type TokenVettingVerdict } from "./tokenScoring.js";
import { readAddress, readBool, readUintBig } from "./engine.js";
import { selector } from "./selectors.js";
import { EIP1967_IMPLEMENTATION_SLOT, ZERO_ADDRESS } from "./selectors.js";
import { fetchLiquidity } from "../liquidity.js";

export interface TokenEngineDeps {
  fetchSourcify: (sourcifyChainId: number, address: string) => Promise<SourcifyResult>;
  buildProvider: (adapter: ChainAdapter) => ethers.Provider;
}

/** Read a dynamic string return (symbol()/name()) via eth_call. */
async function readString(
  provider: ethers.Provider,
  contract: string,
  signature: string,
): Promise<string | null> {
  try {
    const data = selector(signature);
    const raw = await provider.call({ to: contract, data });
    if (!raw || raw === "0x") return null;
    return ethers.AbiCoder.defaultAbiCoder().decode(["string"], raw)[0] as string;
  } catch {
    return null;
  }
}

/** Read a uint8 (decimals()) via eth_call. */
async function readUint8(
  provider: ethers.Provider,
  contract: string,
  signature: string,
): Promise<number | null> {
  try {
    const data = selector(signature);
    const raw = await provider.call({ to: contract, data });
    if (!raw || raw === "0x") return null;
    return Number(ethers.AbiCoder.defaultAbiCoder().decode(["uint8"], raw)[0]);
  } catch {
    return null;
  }
}

/** Gather the ERC-20 read snapshot for one token contract. */
export async function readTokenSnapshot(
  provider: ethers.Provider,
  contract: string,
): Promise<TokenChainSnapshot> {
  const code = await provider.getCode(contract).catch(() => "0x");
  const hasCode = !!code && code !== "0x";

  const [totalSupply, decimals, symbol, name, paused, owner] = await Promise.all([
    readUintBig(provider, contract, "totalSupply()"),
    readUint8(provider, contract, "decimals()"),
    readString(provider, contract, "symbol()"),
    readString(provider, contract, "name()"),
    readBool(provider, contract, "paused()"),
    readAddress(provider, contract, "owner()"),
  ]);

  // EIP-1967 implementation slot.
  let implementationSlot: string | null = null;
  try {
    const slot = await provider.getStorage(contract, EIP1967_IMPLEMENTATION_SLOT);
    if (slot && slot !== ethers.ZeroHash) {
      const impl = "0x" + slot.slice(-40);
      if (impl.toLowerCase() !== ZERO_ADDRESS) implementationSlot = ethers.getAddress(impl);
    }
  } catch {
    implementationSlot = null;
  }

  return { hasCode, totalSupply, decimals, symbol, name, paused, owner, implementationSlot };
}

/**
 * Vet one ERC-20 token end-to-end through an adapter.
 * Read-only: only eth_call / getCode / getStorage / HTTP GET.
 */
export async function vetTokenWithAdapter(
  adapter: ChainAdapter,
  contract: string,
  deps: TokenEngineDeps,
): Promise<TokenVettingVerdict> {
  const address = ethers.getAddress(contract);
  const provider = deps.buildProvider(adapter);

  const sourcify = await deps.fetchSourcify(adapter.sourcifyChainId, address);
  // If the main contract is a proxy, vet the implementation's source too.
  if (!sourcify.isProxy) {
    const snapProbe = await provider.getStorage(address, EIP1967_IMPLEMENTATION_SLOT).catch(() => ethers.ZeroHash);
    if (snapProbe && snapProbe !== ethers.ZeroHash) {
      sourcify.isProxy = true;
      sourcify.implementation = ethers.getAddress("0x" + snapProbe.slice(-40));
    }
  }

  const chain = await readTokenSnapshot(provider, address);

  let tokenSecurity: TokenSecurity | null = null;
  if (adapter.getTokenSecurity) {
    tokenSecurity = await adapter.getTokenSecurity(address).catch(() => null);
  }

  const liquidity = await fetchLiquidity(adapter.chainId, address).catch(() => null);

  return buildTokenVerdict(
    { contract: address, chain, sourcify, tokenSecurity, liquidity },
    adapter.key,
    adapter.chainId,
  );
}
