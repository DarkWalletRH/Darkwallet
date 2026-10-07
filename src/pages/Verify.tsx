// Verify a disclosure link. The work happens in ../lib/verifyLink.ts; this page only renders it.
//
// One rule governs the rendering: a document that did not verify has had nothing about it
// confirmed, so none of its fields (label, account, amount) are shown. They are attacker-chosen
// strings until the proof says otherwise. That includes the verifier's `reason`, which the SDK
// builds from those fields: each verdict gets fixed wording instead.
import { useState, type FormEvent, type ReactNode } from "react";
import type { DarkDisclosureV2, DisclosureVerdict } from "@darkwalletrh/dark-sdk/disclosure";
import { checkDisclosureLink, type LinkResult } from "../lib/verifyLink";
import { formatUsdg } from "../lib/networks";

type State =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "error"; message: string }
  | { phase: "done"; result: LinkResult };

export function Verify() {
  const [link, setLink] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState({ phase: "checking" });
    try {
      const result = await checkDisclosureLink(link);
      // The SDK's reason quotes document fields, so it is never rendered; it is still useful when
      // debugging a link.
      if (result.status === "checked" && result.reason) console.debug("verifyDisclosure:", result.reason);
      setState({ phase: "done", result });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <section>
      <h1>Verify a disclosure</h1>
      <p className="lead">
        A disclosure link proves one statement about a private balance. Paste one below. It is decrypted and checked in
        this browser tab, against the chain. Only the id is sent to the Dark API, to fetch the encrypted document. The
        key after <code>#</code> never leaves the page.
      </p>

      <form className="verify-form" onSubmit={onSubmit}>
        <label htmlFor="link">Disclosure link</label>
        <input
          id="link"
          type="url"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="https://darkwallet.cash/d/…#k=…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button type="submit" disabled={state.phase === "checking"}>
          {state.phase === "checking" ? "Checking…" : "Verify"}
        </button>
      </form>

      <div className="result" aria-live="polite">
        {state.phase === "error" && <Panel title="Could not be checked">{state.message}</Panel>}
        {state.phase === "done" && <Result result={state.result} />}
      </div>

      <h2>What a verdict covers</h2>
      <ul className="plain">
        <li>A disclosure proves one fact about one account at one block. It says nothing about the balance before or since.</li>
        <li>It does not prove who sent you the link. Anyone who holds a link can forward it.</li>
        <li>The label is written by whoever created the link. It is shown, never verified.</li>
        <li>
          Claims about payments (<code>transfer_exact</code>, <code>flow_total_*</code>) must be recomputed from event
          logs. This template does not check them and gives them no verdict.
        </li>
      </ul>
    </section>
  );
}

function Result({ result }: { result: LinkResult }) {
  const testnet = result.network.testnet && (
    <p className="notice">Test network. This link concerns test tokens, which anyone can mint and which have no value.</p>
  );
  switch (result.status) {
    case "not_found":
      return <Panel title="No such disclosure">Nothing is stored under this id. The link may be mistyped.</Panel>;
    case "gone":
      return (
        <Panel title="Revoked or expired">
          The owner revoked this link, or it passed its expiry, and the server has deleted the document.
        </Panel>
      );
    case "undecryptable":
      return (
        <Panel title="Does not decrypt">
          The key in the link does not open the stored document. The link may be truncated, or the document altered.
        </Panel>
      );
    case "unsupported_kind":
      return (
        <Panel title="Not checked">
          This link makes a claim about a payment (<code>{result.kind}</code>). Checking it requires recomputing the
          payment from the chain's event logs, which this template does not do, so it gives no verdict.
        </Panel>
      );
    case "checked":
      return (
        <>
          {testnet}
          <Verdict doc={result.doc} verdict={result.verdict} />
        </>
      );
  }
}

const HEADLINE: Record<DisclosureVerdict, string> = {
  verified: "Verified",
  public_balance: "True, but proves nothing",
  invalid: "Not verified",
  expired: "Expired",
  unsupported_version: "Unsupported document version",
};

function Verdict({ doc, verdict }: { doc: DarkDisclosureV2; verdict: DisclosureVerdict }) {
  const confirmed = verdict === "verified" || verdict === "public_balance";
  // Only read the claim once the SDK has validated it: an unverified document can hold anything.
  const claim = !confirmed
    ? ""
    : "value" in doc.claim
      ? formatUsdg(BigInt(doc.claim.value))
      : `between ${formatUsdg(BigInt(doc.claim.lo))} and ${formatUsdg(BigInt(doc.claim.hi))}`;

  return (
    <Panel title={HEADLINE[verdict]} tone={verdict === "verified" ? "ok" : confirmed ? "warn" : "bad"}>
      {verdict === "verified" && (
        <p>
          The proof checks out against the ciphertext recorded on chain. This account's{" "}
          {doc.component === "total" ? "total" : "available"} balance was <strong>{claim}</strong> at block {doc.block}.
        </p>
      )}
      {verdict === "public_balance" && (
        <p>
          The claim of <strong>{claim}</strong> matches the chain, but this account has only ever received deposits, so
          its balance is already public. Anyone could have read it from the chain. It is not evidence that the sender
          controls the account.
        </p>
      )}
      {!confirmed && (
        <p>
          {verdict === "unsupported_version"
            ? "This document uses a format this viewer does not support."
            : "The document did not pass verification."}{" "}
          Nothing in it has been confirmed, so none of it is shown.
        </p>
      )}
      {confirmed && (
        <dl className="fields">
          <dt>Account</dt>
          <dd className="mono">{doc.account}</dd>
          <dt>Block</dt>
          <dd>{doc.block}</dd>
          <dt>Kind</dt>
          <dd>{doc.kind}</dd>
          <dt>Expires</dt>
          <dd>{formatExpiry(doc.expiresAt)}</dd>
          {doc.label && (
            <>
              <dt>Label</dt>
              <dd>
                {doc.label} <span className="muted">(written by the sender, not verified)</span>
              </dd>
            </>
          )}
        </dl>
      )}
    </Panel>
  );
}

// The owner signs any expiry they like. One past the year 275760 is an Invalid Date, and calling
// toISOString on it throws, which would take the whole page down.
function formatExpiry(seconds: number) {
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime())
    ? `${seconds} (unix seconds)`
    : `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function Panel({ title, tone, children }: { title: string; tone?: "ok" | "warn" | "bad"; children: ReactNode }) {
  return (
    <div className={`panel ${tone ?? ""}`}>
      <p className="panel-title">{title}</p>
      <div className="panel-body">{children}</div>
    </div>
  );
}
