// Dodo Payments webhook → NotebookTools plans.
//
// payment.succeeded for the NotebookTools Pro product records a purchase and
// switches the buyer's profile to "pro". The buyer is matched by
// metadata.user_id (set when checkout starts from the extension) or, failing
// that, by email. A purchase with no matching account is kept and applied when
// that email signs up (see public.handle_new_user). refund.succeeded reverts it.
//
// Secrets: DODO_WEBHOOK_SECRET (from the Dodo webhook endpoint, "whsec_...").
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

async function findUserId(metadataUserId: unknown, email: string): Promise<string | null> {
  if (typeof metadataUserId === "string" && UUID.test(metadataUserId)) {
    const { data } = await supabase.from("profiles").select("id").eq("id", metadataUserId).maybeSingle();
    if (data) return data.id;
  }
  const { data } = await supabase.from("profiles").select("id").ilike("email", email).limit(1).maybeSingle();
  return data?.id ?? null;
}

async function onPaymentSucceeded(data: any) {
  const cart: Array<{ product_id: string }> = data.product_cart ?? [];
  const item = cart.find((c) => PRODUCT_IDS.has(c.product_id));
  if (!item && data.metadata?.app !== "notebooktools") return { skipped: "not a NotebookTools purchase" };

  const email = String(data.customer?.email ?? "").trim().toLowerCase();
  if (!email) return { skipped: "no customer email" };

  const userId = await findUserId(data.metadata?.user_id, email);
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

  if (!userId) return { recorded: true, pending: "no account yet for this email" };
  const { data: plan, error: rpcError } = await supabase.rpc("refresh_plan", { target: userId });
  if (rpcError) throw rpcError;
  return { recorded: true, plan };
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
