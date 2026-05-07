import { c } from "../constants";
import { Modal, Btn } from "../components/UI";

export function TermsView({ onAccept, onDecline }) {
  return (
    <Modal title="Terms & Conditions" wide onClose={() => onDecline()}>
      <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 8, fontSize: 13, color: c.sub, lineHeight: 1.8 }}>
        <p style={{ color: c.text, fontWeight: 600, marginBottom: 12 }}>Last updated: 2026-05-03</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>1. Acceptance of Terms</h4>
        <p style={{ marginBottom: 16 }}>By creating an account on ConnectCall, you agree to be bound by these Terms & Conditions. If you do not agree, do not use the platform.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>2. Platform Role</h4>
        <p style={{ marginBottom: 16 }}>ConnectCall is an escrow and connection platform only. We facilitate payments between watchers (clients) and hosts (consultants). We are not responsible for the content, quality, or outcome of any consultation or call.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>3. Payments & Escrow</h4>
        <p style={{ marginBottom: 16 }}>All payments are processed securely through Paystack. Funds are held in escrow until the call is confirmed complete by the watcher. Platform fees (20%) are added to the host's rate and displayed before payment. Hosts receive their full stated rate after call confirmation.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>4. Refunds</h4>
        <p style={{ marginBottom: 8 }}><strong>Before host contact is revealed:</strong> Watchers receive a 70% automatic refund upon cancellation. 30% is retained as a cancellation fee.</p>
        <p style={{ marginBottom: 16 }}><strong>After host contact is revealed:</strong> Refunds require host approval or admin review. Full refunds are issued if the host fails to provide the service.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>5. Host Responsibilities</h4>
        <p style={{ marginBottom: 16 }}>Hosts must: (a) Provide accurate profile information, (b) Be available for scheduled calls, (c) Conduct themselves professionally, (d) Have a valid MoMo number for payouts. Hosts who repeatedly fail to appear will be removed.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>6. Watcher Responsibilities</h4>
        <p style={{ marginBottom: 16 }}>Watchers must: (a) Provide accurate contact information, (b) Confirm call completion honestly, (c) Not misuse the refund system. False disputes may result in account suspension.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>7. Prohibited Conduct</h4>
        <p style={{ marginBottom: 16 }}>Illegal activities, harassment, hate speech, fraud, sharing others' contact info without consent, and any violation of Ghanaian law are strictly prohibited and will result in immediate account termination.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>8. Privacy</h4>
        <p style={{ marginBottom: 16 }}>Host contact information is only revealed to watchers after payment is verified. Payout details (MoMo numbers) are NEVER shared with watchers. We do not sell or share your data with third parties except as required for payment processing via Paystack.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>9. Limitation of Liability</h4>
        <p style={{ marginBottom: 16 }}>ConnectCall is not liable for disputes between users, quality of consultations, technical issues during calls, or Paystack processing delays. Our maximum liability is limited to the platform fee charged on the disputed transaction.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>10. Account Termination</h4>
        <p style={{ marginBottom: 16 }}>We reserve the right to suspend or terminate accounts for violation of these terms, with or without notice. Users may delete their accounts at any time through their dashboard.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>11. Changes to Terms</h4>
        <p style={{ marginBottom: 16 }}>We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.</p>

        <h4 style={{ color: c.goldL, marginBottom: 8 }}>12. Contact</h4>
        <p style={{ marginBottom: 20 }}>For questions or disputes, contact us through the report feature on the platform.</p>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${c.border}` }}>
        <Btn variant="red" onClick={() => onDecline()} small>Decline</Btn>
        <Btn onClick={() => onAccept()} full>I Accept</Btn>
      </div>
    </Modal>
  );
}