// SPDX-License-Identifier: MIT OR Apache-2.0
// Range disclosures ("the balance was between lo and hi") carry an UltraHonk proof of the
// dark_disclose_range circuit. Checking one needs bb.js, several megabytes of WebAssembly, so it is
// imported here lazily: a reader who only ever opens exact-amount links never downloads it.
//
// Two rules this file exists to keep:
//
// 1. The verification key is compiled in, never fetched. A key fetched at verification time is a
//    key an attacker can swap for one that accepts their forgery. Its SHA-256 below is the
//    `vk_sha256` that DarkWalletRH/dark-contracts records for dark_disclose_range in
//    circuits/manifest.json, and the bytes are re-hashed against it before every use.
//
// 2. @aztec/bb.js must be EXACTLY the version the SDK pins in its peerDependencies. Proofs and keys
//    are not portable across bb versions, and a mismatch does not throw: it returns `false` for
//    every valid proof.
import { hexToBytes, sha256, type Hex } from "viem";

export const DISCLOSE_RANGE_VK_SHA256 = "66b2d395d42daebfc4b2a4fa5da65b875736d2994cc4fef9a3476e27edccdb43";

const VK_BASE64 =
  "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";

// A verifier needs only the first two G1 points and the G2 point of the BN254 reference string
// (256 bytes). Handing them to bb.js stops it from downloading ~16 MiB of reference string
// from a third-party CDN, which would tell that CDN who opened a disclosure, and when.
const SRS_G1_BASE64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAi02Bigon/lD/2vRqHu+TmKr5/thuoPv/SZvIr3PMeb5JrkqeeVjw/SCUszn/uyi8PjTPctO97BkO/B71AVwCqo=";
const SRS_G2_BASE64 = "ARjE1bg3vMK8ibWzmLWXTp9ZRAc7MgeLfiMf7JOIg7AmDgGyUfbxx+f/TlgHkd7o6lHYejWOA4tO/jD6wJODwSL+vaPAwGMqVkdbQhTlYV4R5t0/lubOooVKh9TazF5VBPxjafcRD+PSUVbBu5pyhZzyoEZB+Zuk7kE8gNpqX+Q=";

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** The `verifyRangeProof` callback that the SDK's `verifyDisclosure` expects for range kinds. */
export async function verifyRangeProof(proof: Hex, publicInputs: Hex[]): Promise<boolean> {
  const verificationKey = fromBase64(VK_BASE64);
  if (sha256(verificationKey) !== `0x${DISCLOSE_RANGE_VK_SHA256}`) {
    throw new Error("the compiled-in verification key does not match its pinned SHA-256");
  }

  const { Barretenberg, UltraHonkVerifierBackend } = await import("@aztec/bb.js");
  // skipSrsInit + srsInitSrs: use the 256 bytes above instead of downloading the reference string.
  const api = await Barretenberg.new({ threads: 1, skipSrsInit: true });
  try {
    await api.srsInitSrs({ pointsBuf: fromBase64(SRS_G1_BASE64), numPoints: 2, g2Point: fromBase64(SRS_G2_BASE64) });
    // "evm" must match how the proof was produced (bb --verifier_target evm, which keeps ZK on).
    return await new UltraHonkVerifierBackend(api).verifyProof(
      { proof: hexToBytes(proof), publicInputs, verificationKey },
      { verifierTarget: "evm" },
    );
  } finally {
    await api.destroy();
  }
}
