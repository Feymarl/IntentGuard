// IntentGuard — web UI server (stretch, NEW in the hackathon window).
//   npm run serve        # http://localhost:3000 (PORT env overrides)
//
// Serves public/index.html plus a tiny JSON API that wraps the same
// vetToken()/gateSwap() used by the CLI and the demo — no new logic:
//   GET  /api/health          -> { ok: true }
//   POST /api/vet  { chain, token }            -> TokenVettingVerdict
//   POST /api/gate { chain, token, amount }   -> GateResult (dry quote only)
//
// Dry quotes only, same as the rest of this repo: the gate never issues a
// deposit address and no funds can move. No wallet, no keys, no signing.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { vetToken } from "./vetting/token.js";
import { gateSwap } from "./intents/gate.js";
import { WNEAR_ASSET_ID } from "./intents/oneclick.js";

const PORT = Number(process.env.PORT ?? 3000);
// Defaults are the docs-example addresses (dry quotes move no funds, so
// these are never paid). A real swap would use the user's own addresses.
const DEMO_REFUND_TO_NEAR = "feymar.near";
const DEMO_RECIPIENT_EVM = "0x2527D02599Ba641c19FEa793cD0F167589a0f10D";
const MAX_BODY_BYTES = 64 * 1024;
/** Sanity cap for a demo amount (NEAR). */
const MAX_AMOUNT_NEAR = 1000;

/** 0.1 NEAR = 10^23 yocto (wNEAR has 24 decimals). */
function nearToYocto(near: string): string {
  const [whole, frac = ""] = near.split(".");
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(frac)) throw new Error(`Invalid amount "${near}"`);
  const padded = (frac + "0".repeat(24)).slice(0, 24);
  return BigInt(whole + padded).toString();
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf-8");
  if (!text.trim()) return {};
  return JSON.parse(text);
}

function parseGateBody(body: any): { chain: string; token: string; amountNear: string } {
  const chain = typeof body?.chain === "string" ? body.chain.trim().toLowerCase() : "base";
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(token)) {
    throw Object.assign(new Error('token must be a 0x address, e.g. "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"'), { status: 400 });
  }
  const amountRaw = body?.amount === undefined || body?.amount === null ? "0.1" : String(body.amount).trim();
  if (!/^\d+(\.\d+)?$/.test(amountRaw) || Number(amountRaw) <= 0 || Number(amountRaw) > MAX_AMOUNT_NEAR) {
    throw Object.assign(new Error(`amount must be a number between 0 and ${MAX_AMOUNT_NEAR} NEAR`), { status: 400 });
  }
  return { chain, token, amountNear: amountRaw };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && url.pathname === "/") {
      const html = await readFile(new URL("../public/index.html", import.meta.url), "utf-8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, service: "intentguard", dryOnly: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/vet") {
      const body = await readJsonBody(req);
      const { chain, token } = parseGateBody(body);
      const verdict = await vetToken(token, { chain });
      sendJson(res, 200, verdict);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/gate") {
      const body = await readJsonBody(req);
      const { chain, token, amountNear } = parseGateBody(body);
      const result = await gateSwap({
        originAsset: WNEAR_ASSET_ID,
        destinationChain: chain,
        destinationAddress: token,
        amount: nearToYocto(amountNear),
        refundTo: DEMO_REFUND_TO_NEAR,
        recipient: DEMO_RECIPIENT_EVM,
      });
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }

    sendJson(res, 404, { error: "not found" });
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : 500;
    sendJson(res, status, { error: err?.message ?? String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`IntentGuard UI running at http://localhost:${PORT}`);
  console.log(`  Health:  GET  http://localhost:${PORT}/api/health`);
  console.log(`  Vet:     POST http://localhost:${PORT}/api/vet  { chain, token }`);
  console.log(`  Gate:    POST http://localhost:${PORT}/api/gate { chain, token, amount }`);
  console.log(`Dry quotes only — no wallet, no funds, no keys.`);
});
