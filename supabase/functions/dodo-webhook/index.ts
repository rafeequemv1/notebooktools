// Dodo Payments webhook → NotebookTools plans.
//
// payment.succeeded for the NotebookTools Pro product records a purchase and
// switches the buyer's profile to "pro". The buyer is matched by
// metadata.user_id (set when checkout starts from the extension) or, failing
// that, by email. A purchase with no matching account is kept and applied when
// that email signs up (see public.handle_new_user). refund.succeeded reverts it.
//
// After a new purchase it emails the buyer a "Pro is active" confirmation
// through Resend (skipped when RESEND_API_KEY is not set; never blocks the webhook).
//
// Secrets: DODO_WEBHOOK_SECRET (from the Dodo webhook endpoint, "whsec_..."),
// RESEND_API_KEY, optional RESEND_FROM (default "NotebookTools <noreply@notebooktools.com>";
// must be on a domain verified in Resend).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PRODUCT_IDS = new Set(["pdt_0NqwhiU4r4xHT1O5izA99"]);
const TOLERANCE_SECONDS = 5 * 60;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Standard Webhooks signature: base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)).
async function verify(req: Request, body: string): Promise<boolean> {
  const secret = Deno.env.get("DODO_WEBHOOK_SECRET");
  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const signatures = req.headers.get("webhook-signature");
  if (!secret || !id || !timestamp || !signatures) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  return signatures.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && !!sig && timingSafeEqual(sig, expected);
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Finds the buyer's account by checkout metadata or email (creating a missing
// profile row). Null when no account exists yet for this email.
async function findUserId(metadataUserId: unknown, email: string): Promise<string | null> {
  const targetId = typeof metadataUserId === "string" && UUID.test(metadataUserId) ? metadataUserId : null;
  const { data, error } = await supabase.rpc("profile_id_for", { target_id: targetId, target_email: email });
  if (error) throw error;
  return (data as string | null) ?? null;
}

function proEmailHtml(hasAccount: boolean, email: string): string {
  const safe = email.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const body = hasAccount
    ? `NotebookTools Pro is now active on <strong>${safe}</strong>, for life. Open the NotebookTools side panel in Chrome; if it still shows Free, sign out and back in.`
    : `Thanks for buying NotebookTools Pro. To switch it on, open the NotebookTools side panel in Chrome and create an account with <strong>${safe}</strong>. Pro activates as soon as you sign in.`;
  return `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#f6f8fc;font-family:'Google Sans',Roboto,Arial,Helvetica,sans-serif;color:#1f1f1f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f8fc;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="padding:0 4px 20px;"><a href="https://www.notebooktools.com" style="text-decoration:none;color:#1f1f1f;"><img src="https://www.notebooktools.com/assets/logo-mark.png" width="28" height="28" alt="" style="vertical-align:middle;border:0;border-radius:6px;"><span style="font-size:17px;font-weight:600;vertical-align:middle;padding-left:8px;">NotebookTools</span></a></td></tr>
<tr><td style="background:#ffffff;border:1px solid #e3e8f0;border-radius:16px;padding:32px 28px;">
<p style="margin:0 0 12px;"><span style="display:inline-block;background:#e8f0fe;color:#0b57d0;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:999px;">Pro &middot; lifetime</span></p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:600;">${hasAccount ? "Your Pro plan is active" : "One step to activate Pro"}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444746;">${body}</p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#444746;">Pro unlocks the notebooks dashboard, folders and tags, the source manager, blog and carousel makers, snapshots, the prompt library and chat export.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;"><tr><td style="border-radius:999px;background:#1f1f1f;"><a href="https://notebooklm.google.com/" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">Open NotebookLM</a></td></tr></table>
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#5f6368;">Your payment receipt comes separately from Dodo Payments. Questions? Reply to this email or visit <a href="https://www.notebooktools.com/support" style="color:#0b57d0;">support</a>.</p>
</td></tr>
<tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.6;color:#80868b;">NotebookTools, the Chrome extension for NotebookLM. An independent tool, not affiliated with Google.</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendProEmail(email: string, hasAccount: boolean) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return "skipped: RESEND_API_KEY not set";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") || "NotebookTools <noreply@notebooktools.com>",
        to: [email],
        subject: hasAccount ? "Your NotebookTools Pro is active" : "Activate your NotebookTools Pro",
        html: proEmailHtml(hasAccount, email),
      }),
    });
    if (!response.ok) {
      console.error("resend error", response.status, await response.text());
      return `failed: ${response.status}`;
    }
    return "sent";
  } catch (err) {
    console.error("resend error", err);
    return "failed";
  }
}

async function onPaymentSucceeded(data: any) {
  const cart: Array<{ product_id: string }> = data.product_cart ?? [];
  const item = cart.find((c) => PRODUCT_IDS.has(c.product_id));
  if (!item && data.metadata?.app !== "notebooktools") return { skipped: "not a NotebookTools purchase" };

  const email = String(data.customer?.email ?? "").trim().toLowerCase();
  if (!email) return { skipped: "no customer email" };

  const userId = await findUserId(data.metadata?.user_id, email);
  const { data: existing } = await supabase
    .from("purchases")
    .select("status")
    .eq("payment_id", data.payment_id)
    .maybeSingle();
  const isNew = existing?.status !== "succeeded";

  const { error } = await supabase.from("purchases").upsert(
    {
      payment_id: data.payment_id,
      email,
      user_id: userId,
      product_id: item?.product_id ?? null,
      amount: data.total_amount ?? null,
      currency: data.currency ?? null,
      status: "succeeded",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "payment_id" },
  );
  if (error) throw error;

  let plan: unknown = null;
  if (userId) {
    const { data: refreshed, error: rpcError } = await supabase.rpc("refresh_plan", { target: userId });
    if (rpcError) throw rpcError;
    plan = refreshed;
  }
  // Email once per payment (Dodo retries must not send duplicates).
  const emailed = isNew ? await sendProEmail(email, Boolean(userId)) : "skipped: already processed";
  if (!userId) return { recorded: true, pending: "no account yet for this email", emailed };
  return { recorded: true, plan, emailed };
}

async function onRefundSucceeded(data: any) {
  const { data: purchase } = await supabase
    .from("purchases")
    .update({ status: "refunded", updated_at: new Date().toISOString() })
    .eq("payment_id", data.payment_id)
    .select("user_id")
    .maybeSingle();
  if (!purchase) return { skipped: "unknown payment" };
  if (!purchase.user_id) return { refunded: true };
  const { data: plan, error } = await supabase.rpc("refresh_plan", { target: purchase.user_id });
  if (error) throw error;
  return { refunded: true, plan };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const body = await req.text();
  if (!(await verify(req, body))) return json(401, { error: "Invalid signature" });

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  try {
    let result: Record<string, unknown> = { ignored: event.type };
    if (event.type === "payment.succeeded") result = await onPaymentSucceeded(event.data ?? {});
    else if (event.type === "refund.succeeded") result = await onRefundSucceeded(event.data ?? {});
    return json(200, { ok: true, type: event.type, ...result });
  } catch (err) {
    console.error("dodo-webhook error", err);
    // 500 makes Dodo retry the delivery.
    return json(500, { error: "Processing failed" });
  }
});
