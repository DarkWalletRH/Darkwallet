// Where to go from here. Static content: edit freely.
const REPOS = [
  {
    name: "dark-sdk",
    href: "https://github.com/DarkWalletRH/dark-sdk",
    body: "The TypeScript library behind every Dark client: key derivation, twisted ElGamal over Grumpkin, witness builders and provers, a viem-backed live client, and disclosure creation and verification.",
    code: "npm install github:DarkWalletRH/dark-sdk#v0.4.1 viem",
  },
  {
    name: "dark-contracts",
    href: "https://github.com/DarkWalletRH/dark-contracts",
    body: "The vault, the key registry, the Noir circuits and their verifiers, with a single command that rebuilds every deployed contract and compares it with the bytecode on chain.",
    code: "git clone https://github.com/DarkWalletRH/dark-contracts.git",
  },
  {
    name: "dark-exit",
    href: "https://github.com/DarkWalletRH/dark-exit",
    body: "Withdraw from the vault with nothing but a JSON-RPC endpoint. A compact, complete reference for the private-balance flow: derive keys, recover the balance, apply pending transfers, prove, withdraw.",
    code: "git clone https://github.com/DarkWalletRH/dark-exit.git",
  },
];

const FILES: [string, string][] = [
  ["src/lib/networks.ts", "Chains, RPC endpoints, API paths and the viem clients."],
  ["src/lib/verifyLink.ts", "The complete disclosure verification flow, framework-free."],
  ["src/lib/rangeProof.ts", "The lazily loaded bb.js range-proof verifier and its pinned key."],
  ["src/pages/", "One React component per page. Replace them with your own."],
];

export function Build() {
  return (
    <section>
      <h1>Build your own</h1>
      <p className="lead">
        This template is deliberately small and read-only. Everything that holds keys, proves or sends transactions
        lives in the SDK, and the open-source tools below show it in use.
      </p>

      <div className="cards">
        {REPOS.map((r) => (
          <article key={r.name} className="card">
            <h2>
              <a href={r.href} target="_blank" rel="noreferrer">
                DarkWalletRH/{r.name}
              </a>
            </h2>
            <p>{r.body}</p>
            <pre>
              <code>{r.code}</code>
            </pre>
          </article>
        ))}
      </div>

      <h2>In this template</h2>
      <div className="table-wrap">
        <table>
          <tbody>
            {FILES.map(([path, what]) => (
              <tr key={path}>
                <th scope="row" className="mono">
                  {path}
                </th>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Ground rules</h2>
      <ul className="plain">
        <li>Take contract addresses from the SDK's <code>deployments</code>, never from user input or a document.</li>
        <li>Check claims against the chain. Treat anything an API returns as unverified until a proof says otherwise.</li>
        <li>
          Pin <code>@aztec/bb.js</code> to exactly the version the SDK names. Other versions reject valid proofs.
        </li>
        <li>
          Never put a private key, seed phrase or API key in a <code>VITE_</code> variable. They are compiled into the
          bundle that every visitor downloads.
        </li>
      </ul>

      <p className="muted small">
        Protocol and product documentation: <a href="https://darkwallet.cash/docs">darkwallet.cash/docs</a> ·{" "}
        <a href="https://darkwallet.cash/whitepaper">whitepaper</a>.
      </p>
    </section>
  );
}
