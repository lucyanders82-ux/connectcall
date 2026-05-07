import { useState } from "react";
import { Btn } from "./UI";

export function AdminRefundActions({ r, onApproveRefund, onDenyRefund }) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <Btn small variant="green" disabled={busy} onClick={async () => { setBusy(true); await onApproveRefund(r.id); setBusy(false); }}>
        {busy ? "Processing…" : "✅ Approve & Refund"}
      </Btn>
      <Btn small variant="red" disabled={busy} onClick={async () => { setBusy(true); await onDenyRefund(r.id); setBusy(false); }}>
        {busy ? "Processing…" : "❌ Deny Refund"}
      </Btn>
    </div>
  );
}