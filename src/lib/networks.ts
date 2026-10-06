// The two networks Dark is deployed on, and how this app reaches each of them.
//
// Every contract address comes from the SDK's `deployments` record. Do not copy addresses into
// your own code: the SDK is the single source of truth, and a stale copy is exactly what a
// phishing fork would hope you ship.
import { createPublicClient, formatUnits, http } from "viem";
import { CHAIN_ID_MAINNET, CHAIN_ID_TESTNET, deployments } from "@darkwalletrh/dark-sdk";

export type ChainId = typeof CHAIN_ID_MAINNET | typeof CHAIN_ID_TESTNET;

function network(chainId: ChainId, name: string, rpcOverride: string | undefined, apiBase: string) {
  const deployment = deployments[chainId];
  if (!deployment) throw new Error(`the SDK has no deployment record for chain ${chainId}`);
  const rpcUrl = rpcOverride || deployment.rpcUrl;
  return {
    chainId,
    name,
    testnet: chainId === CHAIN_ID_TESTNET,
    deployment,
    rpcUrl,
    /** Same-origin path that the dev server (or your production proxy) forwards to the Dark API. */
    apiBase,
    /** Read-only. This template never holds a key and never sends a transaction. */
    client: createPublicClient({ transport: http(rpcUrl) }),
  };
}

export type Network = ReturnType<typeof network>;

export const NETWORKS: Record<ChainId, Network> = {
  [CHAIN_ID_MAINNET]: network(CHAIN_ID_MAINNET, "Robinhood Chain mainnet", import.meta.env.VITE_MAINNET_RPC_URL, "/dark-api"),
  [CHAIN_ID_TESTNET]: network(CHAIN_ID_TESTNET, "Robinhood Chain testnet", import.meta.env.VITE_TESTNET_RPC_URL, "/dark-api-testnet"),
};

/** USDG has 6 decimals; every amount the vault and the disclosure documents carry is in base units. */
export const formatUsdg = (units: bigint) =>
  `${Number(formatUnits(units, 6)).toLocaleString("en-US", { maximumFractionDigits: 6 })} USDG`;
