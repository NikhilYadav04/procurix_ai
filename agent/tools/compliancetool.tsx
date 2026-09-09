import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function inr(amount: number): string {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

export const checkMsmeComplianceTool = tool(
  async ({ only_at_risk }, config?: any) => {
    const customerEmail = config?.configurable?.customerEmail;
    if (!customerEmail) {
      return { success: false, error: "Customer email not available in context." };
    }

    const { summarise } = await import("@/lib/msmeCompliance");

    const { data: pos, error } = await supabase
      .from("purchase_orders")
      .select("id, po_number, vendor_name, vendor_email, vendor_is_msme, total_amount, payment_terms, invoice_received_at, paid_at, status")
      .eq("customer_email", customerEmail.toLowerCase());

    if (error) {
      return { success: false, error: `Could not read purchase orders: ${error.message}` };
    }

    if (!pos || pos.length === 0) {
      return { success: true, count: 0, message: "No purchase orders yet, so nothing is exposed to the 45-day rule." };
    }

    const emails = Array.from(new Set(pos.map((p) => p.vendor_email.toLowerCase())));
    const { data: vendors } = await supabase
      .from("vendors")
      .select("email, is_msme")
      .eq("customer_email", customerEmail.toLowerCase())
      .in("email", emails.length ? emails : ["none"]);

    const msmeByEmail = new Map((vendors || []).map((v) => [v.email.toLowerCase(), v.is_msme]));

    const resolved = pos.map((p) => ({
      ...p,
      vendor_is_msme: p.vendor_is_msme ?? msmeByEmail.get(p.vendor_email.toLowerCase()) ?? null,
    }));

    const s = summarise(resolved as any);

    const rows = (only_at_risk ? s.rows.filter((r) => r.state === "breached" || r.state === "urgent") : s.rows)
      .filter((r) => r.state !== "not_applicable" || !only_at_risk)
      .map((r) => ({
        po: r.po_number,
        vendor: r.vendor_name,
        amount: inr(Number(r.total_amount)),
        msme: r.vendor_is_msme === true ? "yes" : r.vendor_is_msme === false ? "no" : "unknown",
        state: r.state,
        days_elapsed: r.days_elapsed,
        days_left: r.days_left,
        due_date: r.due_date,
        note: r.reason,
      }));

    return {
      success: true,
      amount_at_risk: inr(s.amount_at_risk),
      amount_at_risk_raw: s.amount_at_risk,
      breached: s.breached,
      urgent: s.urgent,
      due_soon: s.due_soon,
      safe: s.safe,
      awaiting_invoice: s.awaiting_invoice,
      msme_purchase_orders: s.total_msme_pos,
      paid_late: s.paid_late,
      paid_on_time: s.paid_on_time,
      amount_paid_late: inr(s.amount_paid_late),
      headline:
        s.amount_at_risk > 0
          ? `${inr(s.amount_at_risk)} of tax deduction is at risk across ${s.breached + s.urgent} purchase order(s).`
          : s.paid_late > 0
          ? `Nothing is currently at risk, but ${s.paid_late} payment(s) worth ${inr(s.amount_paid_late)} were settled after the deadline. That deduction is already deferred to the year of payment and interest accrues at three times the RBI bank rate. Paying late does not undo it.`
          : s.total_msme_pos === 0
          ? "No MSME vendors on any purchase order yet."
          : "Nothing is at risk. Every MSME payment is inside its deadline.",
      worst: s.worst ? `${s.worst.po_number} to ${s.worst.vendor_name}: ${s.worst.reason}` : null,
      rows,
    };
  },
  {
    name: "check_msme_compliance",
    description:
      "Check every purchase order against India's 45-day MSME payment rule (Section 43B(h)). Reports how much tax deduction is at risk, which suppliers are close to or past their deadline, and how many days remain on each. Use whenever the user asks about payments, overdue invoices, MSME suppliers, compliance, tax exposure, what is due, or what needs paying.",
    schema: z.object({
      only_at_risk: z
        .boolean()
        .optional()
        .describe("Set true to return only breached and urgent orders. Defaults to false, which returns everything."),
    }),
  }
);

export const recordInvoiceTool = tool(
  async ({ po_number, invoice_date, mark_paid }, config?: any) => {
    const customerEmail = config?.configurable?.customerEmail;
    if (!customerEmail) {
      return { success: false, error: "Customer email not available in context." };
    }

    const { data: po } = await supabase
      .from("purchase_orders")
      .select("id, po_number, vendor_name, vendor_email, total_amount, payment_terms, vendor_is_msme, invoice_received_at")
      .eq("po_number", po_number.toUpperCase())
      .eq("customer_email", customerEmail.toLowerCase())
      .maybeSingle();

    if (!po) {
      return { success: false, error: `${po_number} not found.` };
    }

    let isMsme = po.vendor_is_msme;
    if (isMsme === null || isMsme === undefined) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("is_msme")
        .eq("email", (po as any).vendor_email?.toLowerCase() || "")
        .eq("customer_email", customerEmail.toLowerCase())
        .maybeSingle();
      isMsme = vendor?.is_msme ?? null;
    }

    const update: Record<string, any> = { updated_at: new Date().toISOString() };

    if (mark_paid) {
      update.paid_at = new Date().toISOString();
      update.status = "paid";
    } else {
      update.invoice_received_at = invoice_date ? new Date(invoice_date).toISOString() : new Date().toISOString();
      update.status = "invoiced";
    }

    const { error } = await supabase.from("purchase_orders").update(update).eq("id", po.id);

    if (error) {
      return { success: false, error: `Could not update ${po_number}: ${error.message}` };
    }

    const { assessPo } = await import("@/lib/msmeCompliance");
    const assessed = assessPo({
      ...(po as any),
      ...update,
      vendor_is_msme: isMsme,
      invoice_received_at: update.invoice_received_at ?? po.invoice_received_at,
    });

    return {
      success: true,
      po_number: po.po_number,
      vendor: po.vendor_name,
      amount: inr(Number(po.total_amount)),
      action: mark_paid ? "marked as paid" : "invoice recorded",
      state: assessed.state,
      days_left: assessed.days_left,
      due_date: assessed.due_date,
      note: assessed.reason,
    };
  },
  {
    name: "record_invoice",
    description:
      "Record that a vendor invoice has arrived against a purchase order, which starts the 45-day MSME payment clock, or mark a purchase order as paid, which stops it. Use when the user says an invoice has been received or a supplier has been paid.",
    schema: z.object({
      po_number: z.string().describe("The purchase order, for example PO-0002."),
      invoice_date: z
        .string()
        .optional()
        .describe("Date the invoice was received in YYYY-MM-DD form. Defaults to today."),
      mark_paid: z
        .boolean()
        .optional()
        .describe("Set true to mark the order paid instead of recording an invoice."),
    }),
  }
);

export default checkMsmeComplianceTool;
