import { supabase } from "./supabase";

export function safeArr(val) {
  if (Array.isArray(val)) return val.filter(v => v && v !== "[]" && v !== "{}");
  if (typeof val === "string" && val.length > 0) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter(v => v && v !== "[]" && v !== "{}");
    } catch {}
    if (val === "[]" || val === "{}") return [];
    return val.split(",").map(t => t.trim()).filter(v => v && v !== "[]" && v !== "{}");
  }
  return [];
}

export function normaliseUser(row) {
  return {
    ...row,
    contactNumber:         row.contact_number         ?? row.contactNumber         ?? "",
    profilePhoto:          row.profile_photo           ?? row.profilePhoto           ?? null,
    photos:                safeArr(row.photos),
    tags:                  safeArr(row.tags),
    wallet:                Number(row.wallet ?? 0),
    online:                row.online  ?? true,
    role:                  row.role    ?? "host",
    email:                 row.email   ?? "",
    payoutName:            row.payout_name            ?? row.payoutName            ?? "",
    payoutNumber:          row.payout_number          ?? row.payoutNumber          ?? "",
    payoutProvider:        row.payout_provider        ?? row.payoutProvider        ?? "",
    paystackRecipientCode: row.paystack_recipient_code ?? row.paystackRecipientCode ?? "",
    contactRevealedAt:     row.contact_revealed_at    ?? null,
    avatar: (row.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
  };
}

export async function uploadFile(bucket, file) {
  const ext = file.name.split(".").pop();
  const path = `public/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
  if (error) { console.error("Upload error:", error); return null; }
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}