// Network overview: the deployed contracts for a chain, and the vault's public state read live.
//
// Everything on this page is public. Balances in Dark are encrypted, but the vault's total value
// locked, its caps and its pause flag are plain contract state that anyone can read.
import { useEffect, useState } from "react";
import { CHAIN_ID_MAINNET, ZERO_ADDRESS, darkVaultAbi, isDeployed } from "@darkwalletrh/dark-sdk";
import { BaseError } from "viem";
import { NETWORKS, formatUsdg, type ChainId, type Network } from "../lib/networks";

async function readVault(network: Network) {
  const vault = { address: network.deployment.vault, abi: darkVaultAbi } as const;
  // Every value is read at the same block, so the numbers describe one moment. Two blocks behind the
  // tip: the public RPC is load-balanced, and a backend that has not reached the newest block yet
  // answers "unsupported block number".
  const blockNumber = (await network.client.getBlockNumber()) - 2n;
  const [tvl, caps, paused] = await Promise.all([
    network.client.readContract({ ...vault, functionName: "tvl", blockNumber }),
    network.client.readContract({ ...vault, functionName: "caps", blockNumber }),
    network.client.readContract({ ...vault, functionName: "paused", blockNumber }),
  ]);
  return { blockNumber, tvl, caps, paused };
}

/** viem's full message lists the request body, the call and its version; its first line is enough here. */
const shortMessage = (e: unknown) =>
  e instanceof BaseError ? e.shortMessage : e instanceof Error ? e.message : String(e);

type VaultState = Awaited<ReturnType<typeof readVault>>;
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: VaultState };

const CAP_LABELS: [keyof VaultState["caps"], string][] = [
  ["minDeposit", "Minimum deposit"],
  ["maxDeposit", "Maximum deposit"],
  ["maxAccountInflow", "Maximum inflow per account"],
  ["minTransfer", "Minimum transfer"],
  ["maxTransfer", "Maximum transfer"],
  ["tvlCap", "Total value locked cap"],
];

export function Overview() {
  const [chainId, setChainId] = useState<ChainId>(CHAIN_ID_MAINNET);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const network = NETWORKS[chainId];
  const d = network.deployment;

  useEffect(() => {
    if (!isDeployed(chainId)) return;
    let current = true;
    setLoad({ status: "loading" });
    readVault(NETWORKS[chainId]).then(
      (data) => current && setLoad({ status: "ok", data }),
      (e: unknown) => current && setLoad({ status: "error", message: shortMessage(e) }),
    );
    return () => {
      current = false;
    };
  }, [chainId]);

  const contracts: [string, `0x${string}`][] = [
    ["DarkVault", d.vault],
    ["DarkKeyRegistry", d.registry],
    ["Register verifier", d.verifiers.register],
    ["Transfer verifier", d.verifiers.transfer],
    ["Withdraw verifier", d.verifiers.withdraw],
    ["Timelock (owner)", d.timelock],
    ["Guardian", d.guardian],
    ["USDG", d.usdg],
  ];

  return (
    <section>
      <h1>Network overview</h1>
      <p className="lead">
        Contract addresses come from the SDK's <code>deployments</code> record. Vault state is read directly from the
        chain's JSON-RPC endpoint with viem.
      </p>

      <div className="segmented" role="group" aria-label="Network">
        {Object.values(NETWORKS).map((n) => (
          <button key={n.chainId} type="button" aria-pressed={n.chainId === chainId} onClick={() => setChainId(n.chainId)}>
            {n.name} <span className="muted">{n.chainId}</span>
          </button>
        ))}
      </div>

      {!isDeployed(chainId) ? (
        <p className="notice">Dark is not deployed on this network.</p>
      ) : (
        <>
          <h2>Vault state</h2>
          {load.status === "loading" && <p className="muted">Reading the chain…</p>}
          {load.status === "error" && <p className="notice">Could not read the vault: {load.message}</p>}
          {load.status === "ok" && (
            <dl className="stats">
              <div>
                <dt>Total value locked</dt>
                <dd>{formatUsdg(load.data.tvl)}</dd>
              </div>
              <div>
                <dt>Deposits and transfers</dt>
                <dd>{load.data.paused ? "Paused" : "Open"}</dd>
              </div>
              <div>
                <dt>Block</dt>
                <dd>{load.data.blockNumber.toLocaleString("en-US")}</dd>
              </div>
              {CAP_LABELS.map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{formatUsdg(load.data.caps[key])}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="muted small">
            Withdrawals, applying pending transfers and key registration cannot be paused.
          </p>

          <h2>Deployed contracts</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {contracts
                  .filter(([, address]) => address !== ZERO_ADDRESS)
                  .map(([label, address]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>
                        <a className="mono" href={`${d.explorer}/address/${address}`} target="_blank" rel="noreferrer">
                          {address}
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Deployed at block {d.deployBlock.toLocaleString("en-US")}. Explorer links open {new URL(d.explorer).host}.
          </p>
        </>
      )}
    </section>
  );
}
