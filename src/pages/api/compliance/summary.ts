import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { summarise } from '@/lib/msmeCompliance';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const customerEmail = String(req.query.customerEmail || '').toLowerCase();
  if (!customerEmail) {
    return res.status(400).json({ success: false, error: 'customerEmail is required' });
  }

  try {
    const { data: pos, error } = await supabase
      .from('purchase_orders')
      .select('id, po_number, vendor_name, vendor_email, vendor_is_msme, total_amount, payment_terms, invoice_received_at, paid_at, status')
      .eq('customer_email', customerEmail);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    const emails = Array.from(new Set((pos || []).map((p) => p.vendor_email.toLowerCase())));
    const { data: vendors } = await supabase
      .from('vendors')
      .select('email, is_msme')
      .eq('customer_email', customerEmail)
      .in('email', emails.length ? emails : ['none']);

    const msmeByEmail = new Map((vendors || []).map((v) => [v.email.toLowerCase(), v.is_msme]));

    const resolved = (pos || []).map((p) => ({
      ...p,
      vendor_is_msme: p.vendor_is_msme ?? msmeByEmail.get(p.vendor_email.toLowerCase()) ?? null,
    }));

    const summary = summarise(resolved as any);

    return res.status(200).json({
      success: true,
      amount_at_risk: summary.amount_at_risk,
      breached: summary.breached,
      urgent: summary.urgent,
      due_soon: summary.due_soon,
      safe: summary.safe,
      awaiting_invoice: summary.awaiting_invoice,
      paid_on_time: summary.paid_on_time,
      paid_late: summary.paid_late,
      amount_paid_late: summary.amount_paid_late,
      total_msme_pos: summary.total_msme_pos,
      total_pos: (pos || []).length,
      worst: summary.worst,
      rows: summary.rows,
    });
  } catch (error: any) {
    console.error('[COMPLIANCE SUMMARY] Failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
