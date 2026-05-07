import { useState } from "react";
import { Btn } from "./UI";
import { c } from "../constants";

export function HostRefundRow({ r, onHostApproveRefund }) {
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
      <span style={{ color: c.sub, fontSize: 13, flex: 1 }}>{r.watcher_name} requests refund: {r.reason}</span>
      <Btn variant="green" small disabled={busy} onClick={async () => { setBusy(true); await onHostApproveRefund(r.id); setBusy(false); }}>
        {busy ? "Approving…" : "Approve Refund"}
      </Btn>
    </div>
  );
}