// IntentGuard — token vetting entry point (NEW in the hackathon window).
// vetToken(address, { chain }) vets one ERC-20 token through the chain
// adapter (default: base) and returns the JSON verdict.
// Read-only: only eth_call / getCode / getStorage / HTTP GET. Never sends
// a transaction.
//
// The source fetcher is copied from MintGuard's verdict.ts
// (createSourceFetcher): Sourcify first; when Sourcify has no record
// (404 → verified:false) and the adapter carries a blockscoutBaseUrl,
// ask Blockscout before concluding unverified.

import type { ChainAdapter, SourcifyResult } from "./core/types.js";
import type { TokenVettingVerdict } from "./core/tokenScoring.js";
import { vetTokenWithAdapter } from "./core/tokenEngine.js";
import { fetchSourcify } from "./sourcify.js";
import { fetchBlockscout } from "./blockscout.js";
import { buildLiveProvider } from "./rpc.js";
import { getAdapter } from "./adapters/bsc.js";

export interface VetTokenOptions {
  /** Chain key, e.g. "base". Default "base". */
  chain?: string;
}

export function createSourceFetcher(
  adapter: ChainAdapter,
): (sourcifyChainId: number, address: string) => Promise<SourcifyResult> {
  return async (sourcifyChainId: number, address: string): Promise<SourcifyResult> => {
    let sourcify: SourcifyResult;
    try {
      sourcify = await fetchSourcify(sourcifyChainId, address);
    } catch (err) {
      if (!adapter.blockscoutBaseUrl) throw err;
      return fetchBlockscout(adapter.blockscoutBaseUrl, address);
    }
    if (sourcify.verified || !adapter.blockscoutBaseUrl) return sourcify;
    return fetchBlockscout(adapter.blockscoutBaseUrl, address);
  };
}

export async function vetToken(
  address: string,
  opts: VetTokenOptions = {},
): Promise<TokenVettingVerdict> {
  const adapter = getAdapter(opts.chain ?? "base");
  const provider = await buildLiveProvider(adapter);
  return vetTokenWithAdapter(
    adapter,
    address,
    { fetchSourcify: createSourceFetcher(adapter), buildProvider: () => provider },
  );
}

export { getAdapter };
