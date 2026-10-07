// SPDX-License-Identifier: MIT OR Apache-2.0
// Verifying a Dark disclosure link, end to end, in the reader's browser.
//
// A disclosure link looks like https://darkwallet.cash/d/<id>#k=<key>. The id names an encrypted
// blob stored by the Dark API; the key, in the URL fragment, decrypts it. Browsers never send a
// fragment to a server, so the API stores a document it cannot read.
//
// The point of verifying is to NOT trust the server that served the blob. So the only things taken
// from the Dark API are the encrypted bytes; the facts the proof is checked against (the account's
// encrypted balance and its registered public key) are read from the chain, at the pinned contract
// addresses in the SDK, never at addresses named by the document.
import {
  fromBase64url,
  openDisclosure,
  parseDisclosureLink,
  verifyDisclosure,
  type DarkDisclosureV2,
  type DisclosureVerdict,
} from "@darkwalletrh/dark-sdk/disclosure";
import {
  CHAIN_ID_MAINNET,
  CHAIN_ID_TESTNET,
  Point,
  add,
  darkKeyRegistryAbi,
  darkVaultAbi,
  decode,
  encode,
  type AffinePoint,
} from "@darkwalletrh/dark-sdk";
import { BaseError, isAddress } from "viem";
import { NETWORKS, type Network } from "./networks";
import { verifyRangeProof } from "./rangeProof";

export type LinkResult =
  /** The API has nothing under this id: mistyped, or never created. */
  | { status: "not_found"; network: Network }
  /** Revoked by its owner or past its expiry; the API has already deleted the blob. */
  | { status: "gone"; network: Network }
  /** Wrong key, a tampered blob, or a blob stored under a different id. */
  | { status: "undecryptable"; network: Network }
  /** A transfer or flow claim. See the note in `checkDisclosureLink`. */
  | { status: "unsupported_kind"; network: Network; kind: string }
  /** The SDK's verdict. Only `verified` and `public_balance` say anything about the document. */
  | { status: "checked"; network: Network; doc: DarkDisclosureV2; verdict: DisclosureVerdict; reason?: string | undefined };

type Ciphertext = { c: AffinePoint; d: AffinePoint };

const PAYMENT_KINDS: readonly string[] = ["transfer_exact", "flow_total_exact", "flow_total_range"];

/** The chain stores the identity point as (0, 0), which `decode` rightly rejects as a public key. */
const point = (p: AffinePoint) => (p.x === 0n && p.y === 0n ? Point.ZERO : decode(p));

/** Homomorphic sum of two ElGamal ciphertexts: the encryption of available + pending. */
const sum = (a: Ciphertext, b: Ciphertext): Ciphertext => ({
  c: encode(add(point(a.c), point(b.c))),
  d: encode(add(point(a.d), point(b.d))),
});

/**
 * Resolves to a result for every outcome the link itself can cause. Throws only when something
 * outside the document fails (the API or RPC is unreachable, the range verifier will not load), so
 * an infrastructure problem is never shown as a verdict about the claim.
 */
export async function checkDisclosureLink(link: string): Promise<LinkResult> {
  // 1. Split the link. `parseDisclosureLink` throws on anything that is not a disclosure link.
  const { id, key } = parseDisclosureLink(link.trim());

  // 2. Testnet ids start with `t_`. That prefix decides which API, chain and contracts are used.
  const network = NETWORKS[id.startsWith("t_") ? CHAIN_ID_TESTNET : CHAIN_ID_MAINNET];

  // 3. Fetch the sealed blob. This is the only request that reaches Dark, and it carries the id
  //    only: the key stays in this tab. Only the Dark API's own answers count as statements about
  //    the link: a 404 from the host itself (the /dark-api proxy is missing) or from a CDN in the
  //    path is an infrastructure problem, not a missing disclosure, and so is a host that answers
  //    every path with index.html.
  const res = await fetch(`${network.apiBase}/v1/disclosures/${encodeURIComponent(id)}`, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as { blob?: unknown; error?: { code?: unknown } } | null;
  if (res.status === 404 && body?.error?.code === "NOT_FOUND") return { status: "not_found", network };
  if (res.status === 410 && body?.error?.code === "GONE") return { status: "gone", network };
  const blob = body?.blob;
  if (!res.ok || typeof blob !== "string") {
    throw new Error(
      `the disclosure proxy answered HTTP ${res.status} without a Dark API response; is ${network.apiBase}/ forwarded? See "Deploying" in the README`,
    );
  }

  // 4. Decrypt locally. `openDisclosure` returns null rather than throwing on a bad key or blob.
  const doc = openDisclosure(fromBase64url(blob), key, id);
  if (!doc) return { status: "undecryptable", network };
  const verdict = (v: DisclosureVerdict, reason: string) => ({ status: "checked" as const, network, doc, verdict: v, reason });

  // 5. Transfer and flow claims are about payments, and checking one means recomputing it from the
  //    chain's event logs. This template reads account balances only. Running such a document
  //    through the balance check below would let an owner present a proof about their balance as
  //    a proof about a payment, so it gets no verdict at all. The kind is still unverified text, so
  //    only the SDK's own kind names are ever shown; anything else is a malformed document.
  if (doc.kind !== "balance_exact" && doc.kind !== "balance_range") {
    return PAYMENT_KINDS.includes(doc.kind)
      ? { status: "unsupported_kind", network, kind: doc.kind }
      : verdict("invalid", "the document has an unknown kind");
  }
  if (doc.chainId !== network.chainId) return verdict("invalid", "the document names a different chain than its link");
  if (!isAddress(doc.account, { strict: false })) return verdict("invalid", "the document does not name an account");
  if (typeof doc.block !== "string" || !/^(0|[1-9][0-9]*)$/.test(doc.block)) {
    return verdict("invalid", "the document does not name a block");
  }

  // 6. Read the facts from chain, at the block the claim is about, from the PINNED contracts.
  const block = BigInt(doc.block);
  const { vault, registry } = network.deployment;
  const [account, registryKey] = await Promise.all([
    network.client.readContract({ address: vault, abi: darkVaultAbi, functionName: "getAccount", args: [doc.account], blockNumber: block }),
    network.client.readContract({ address: registry, abi: darkKeyRegistryAbi, functionName: "keyOf", args: [doc.account], blockNumber: block }),
  ]).catch((e: unknown) => {
    // Public endpoints keep only recent state (a few thousand blocks, minutes). A link about an
    // older block can only be checked against an archive endpoint; see .env.example.
    const detail = e instanceof BaseError ? e.details : String(e);
    const pruned = /historical state|missing trie node|state.*not available/i.test(detail);
    throw new Error(
      `could not read ${network.name} at block ${block}: ${detail}` +
        (pruned ? ". This RPC endpoint does not keep state that old; set an archive endpoint in .env.local" : ""),
    );
  });
  // A `total` claim is about available + pending. The sum is computed here, not taken from anyone.
  const onChain = doc.component === "total" ? sum(account.available, account.pending) : account.available;

  // 7. Verify. The SDK checks the version, expiry, pinned addresses, registry key, ciphertext,
  //    context hash, the owner's EIP-712 signature and the proof itself, and returns a verdict for
  //    every malformed document instead of throwing. The SDK would also turn an exception from the
  //    range verifier into "invalid"; it is caught here instead, so a verifier that fails to load is
  //    reported as a failure to check, not as a bad proof. Its message is logged, not shown: a hex
  //    error from viem quotes its input, which here is the document's proof field.
  let loadError: unknown;
  const result = await verifyDisclosure({
    doc,
    onChain,
    registryKey,
    verifyRangeProof: (proof, inputs) =>
      verifyRangeProof(proof, inputs).catch((e: unknown) => {
        loadError = e;
        throw e;
      }),
  });
  if (loadError) {
    console.error(loadError);
    throw new Error("the range verifier could not run");
  }
  return { status: "checked", network, doc, verdict: result.verdict, reason: result.reason };
}
