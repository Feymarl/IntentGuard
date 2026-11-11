// IntentGuard — REUSED BASELINE (MintGuard, our own pre-hackathon code).
// Copied verbatim from ~/workspace/hackathon-near-mintguard/src/vetting/ (project #1).
// See ../../BASELINE.md. Only the NEAR Intents integration in this repo is new.
// MintGuard — Adapter layer: Blockscout v2 API client (chain-agnostic).
// Fallback source check for chains where Sourcify coverage is PARTIAL:
// a contract verified only through Blockscout's own verifier 404s on
// Sourcify, so without this the engine would false-BLOCK it.
// RULE: always query with a LOWERCASE address (same rule as Sourcify).

import type { SourcifyResult } from "./core/types.js";
import { BROWSER_UA } from "./sourcify.js";

export async function fetchBlockscout(
  baseUrl: string,
  address: string,
): Promise<SourcifyResult> {
  const lower = address.toLowerCase();
  const url = `${baseUrl.replace(/\/$/, "")}/smart-contracts/${lower}`;
  const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (res.status === 404) {
    return { verified: false, exactMatch: false, contractName: null, abi: [] };
  }
  if (!res.ok) {
    throw new Error(`Blockscout request failed: HTTP ${res.status}`);
  }
  const body: any = await res.json();
  // Blockscout v2 returns `abi` as a parsed JSON array; older instances
  // return it as a JSON-encoded string. Accept both.
  let abi: any[] = [];
  if (Array.isArray(body?.abi)) {
    abi = body.abi;
  } else if (typeof body?.abi === "string" && body.abi.length > 0) {
    try {
      const parsed = JSON.parse(body.abi);
      if (Array.isArray(parsed)) abi = parsed;
    } catch {
      abi = [];
    }
  }
  const implementations = Array.isArray(body?.implementations) ? body.implementations : [];
  const firstImpl = implementations[0];
  const implementation =
    typeof firstImpl === "string"
      ? firstImpl
      : typeof firstImpl?.address === "string"
        ? firstImpl.address
        : null;
  return {
    verified: body?.is_verified === true,
    exactMatch: body?.is_fully_verified === true,
    contractName: typeof body?.name === "string" ? body.name : null,
    abi,
    isProxy: body?.proxy_type != null || body?.is_proxy === true,
    implementation,
  };
}
