import { useState } from "react";
import { Btn } from "./UI";

export function MarkDoneBtn({ payId, live, onMarkDone }) {
  const [busy, setBusy] = useState(false);
  return (
    <Btn small variant="green" disabled={busy}
      onClick={async () => { setBusy(true); await onMarkDone(payId, live); setBusy(false); }}
      style={{ marginTop: 10 }}>
      {busy ? "Marking…" : "✓ Mark Call Done"}
    </Btn>
  );
}