import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { SKUS } from "@/lib/catalog";
import { getApiOverrides, setApiOverride } from "@/lib/settings";

// PATCH { disabled?: boolean, inrPer1k?: number, note?: string }
export async function PATCH(request, { params }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { sku } = await params;
  if (!SKUS[sku]) return fail(404, "Unknown API");
  const body = await request.json().catch(() => ({}));

  const patch = {};
  if (body.disabled !== undefined) patch.disabled = Boolean(body.disabled);
  if (body.inrPer1k !== undefined && body.inrPer1k !== "") {
    const price = Number(body.inrPer1k);
    if (!Number.isFinite(price) || price < 0 || price > 100000) return fail(400, "Price must be between ₹0 and ₹1,00,000 per 1,000");
    patch.inrPer1k = Math.round(price * 100) / 100;
  }
  if (body.note !== undefined) patch.note = String(body.note || "").trim().slice(0, 200) || null;
  if (!Object.keys(patch).length) return fail(400, "Nothing to change");

  const before = (await getApiOverrides())[sku] || {};
  const after = await setApiOverride(sku, patch);
  const action =
    patch.disabled !== undefined && patch.disabled !== Boolean(before.disabled)
      ? patch.disabled
        ? "api.disable"
        : "api.enable"
      : "api.update";
  await audit(session.user, action, sku, { before, after });
  return Response.json({ sku, override: after });
}

const fail = (status, message) => Response.json({ error: { message } }, { status });
