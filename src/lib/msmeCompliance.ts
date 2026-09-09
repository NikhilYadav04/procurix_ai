export const STATUTORY_CAP_DAYS = 45;
export const NO_AGREEMENT_DAYS = 15;
export const WARN_AT_DAYS = 30;
export const ESCALATE_AT_DAYS = 40;

export type ComplianceState = 'safe' | 'due_soon' | 'urgent' | 'breached' | 'paid' | 'not_applicable';

export interface CompliancePo {
  id: string;
  po_number: string;
  vendor_name: string | null;
  vendor_email: string;
  vendor_is_msme: boolean | null;
  total_amount: number;
  payment_terms: string | null;
  invoice_received_at: string | null;
  paid_at: string | null;
  status: string;
}

export interface ComplianceRow extends CompliancePo {
  state: ComplianceState;
  deadline_days: number;
  days_elapsed: number | null;
  days_left: number | null;
  due_date: string | null;
  amount_at_risk: number;
  reason: string;
}

export function agreedTermDays(paymentTerms: string | null): number {
  if (!paymentTerms) return NO_AGREEMENT_DAYS;

  const net = paymentTerms.match(/net\s*(\d{1,3})/i);
  if (net) return Math.min(parseInt(net[1], 10), STATUTORY_CAP_DAYS);

  const days = paymentTerms.match(/(\d{1,3})\s*days?/i);
  if (days) return Math.min(parseInt(days[1], 10), STATUTORY_CAP_DAYS);

  const advance = /advance|upfront|immediate|delivery/i.test(paymentTerms);
  if (advance) return STATUTORY_CAP_DAYS;

  return STATUTORY_CAP_DAYS;
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0);
  return Math.floor(ms / 86400000);
}

export function assessPo(po: CompliancePo, now: Date = new Date()): ComplianceRow {
  const deadlineDays = agreedTermDays(po.payment_terms);

  const base: ComplianceRow = {
    ...po,
    state: 'not_applicable',
    deadline_days: deadlineDays,
    days_elapsed: null,
    days_left: null,
    due_date: null,
    amount_at_risk: 0,
    reason: '',
  };

  if (po.vendor_is_msme === false) {
    return { ...base, reason: 'This vendor is not a registered micro or small enterprise, so the 45-day rule does not apply.' };
  }

  if (po.vendor_is_msme !== true) {
    return {
      ...base,
      reason: 'It is not recorded whether this vendor is a Udyam-registered micro or small enterprise. Confirm with them, because if they are, the 45-day rule applies and the clock is already running.',
    };
  }

  if (po.paid_at) {
    const elapsed = po.invoice_received_at ? daysBetween(new Date(po.invoice_received_at), new Date(po.paid_at)) : null;
    return {
      ...base,
      state: 'paid',
      days_elapsed: elapsed,
      reason: elapsed !== null && elapsed > deadlineDays
        ? `Paid after ${elapsed} days, past the ${deadlineDays}-day limit. The deduction moves to the year of payment.`
        : `Paid${elapsed !== null ? ` in ${elapsed} days` : ''}. Within the limit.`,
    };
  }

  if (!po.invoice_received_at) {
    return { ...base, reason: 'No invoice received yet, so the clock has not started.' };
  }

  const invoiceDate = new Date(po.invoice_received_at);
  const elapsed = daysBetween(invoiceDate, new Date(now));
  const left = deadlineDays - elapsed;

  const due = new Date(invoiceDate);
  due.setDate(due.getDate() + deadlineDays);
  const dueDate = due.toISOString().slice(0, 10);

  let state: ComplianceState;
  let reason: string;

  if (left < 0) {
    state = 'breached';
    reason = `${Math.abs(left)} days past the ${deadlineDays}-day limit. The deduction on ${formatShort(po.total_amount)} is deferred to the year of payment, plus interest at three times the RBI bank rate.`;
  } else if (elapsed >= ESCALATE_AT_DAYS) {
    state = 'urgent';
    reason = `${left} days left. Pay now or the deduction on ${formatShort(po.total_amount)} is lost this year.`;
  } else if (elapsed >= WARN_AT_DAYS) {
    state = 'due_soon';
    reason = `${left} days left before the ${deadlineDays}-day limit.`;
  } else {
    state = 'safe';
    reason = `${left} days left. Comfortable.`;
  }

  return {
    ...base,
    state,
    days_elapsed: elapsed,
    days_left: left,
    due_date: dueDate,
    amount_at_risk: state === 'breached' || state === 'urgent' ? Number(po.total_amount) : 0,
    reason,
  };
}

export interface ComplianceSummary {
  total_msme_pos: number;
  breached: number;
  urgent: number;
  due_soon: number;
  safe: number;
  awaiting_invoice: number;
  paid_on_time: number;
  paid_late: number;
  amount_paid_late: number;
  amount_at_risk: number;
  worst: ComplianceRow | null;
  rows: ComplianceRow[];
}

export function summarise(pos: CompliancePo[], now: Date = new Date()): ComplianceSummary {
  const rows = pos.map((p) => assessPo(p, now));
  const msmeRows = rows.filter((r) => r.vendor_is_msme === true);

  const byUrgency: Record<ComplianceState, number> = {
    breached: 0, urgent: 1, due_soon: 2, safe: 3, paid: 4, not_applicable: 5,
  };

  const active = msmeRows
    .filter((r) => r.state !== 'paid' && r.state !== 'not_applicable')
    .sort((a, b) => byUrgency[a.state] - byUrgency[b.state] || (a.days_left ?? 0) - (b.days_left ?? 0));

  const paidRows = msmeRows.filter((r) => r.state === 'paid');
  const paidLate = paidRows.filter((r) => r.days_elapsed !== null && r.days_elapsed > r.deadline_days);

  return {
    total_msme_pos: msmeRows.length,
    breached: msmeRows.filter((r) => r.state === 'breached').length,
    urgent: msmeRows.filter((r) => r.state === 'urgent').length,
    due_soon: msmeRows.filter((r) => r.state === 'due_soon').length,
    safe: msmeRows.filter((r) => r.state === 'safe').length,
    awaiting_invoice: msmeRows.filter((r) => r.state === 'not_applicable' && !r.invoice_received_at).length,
    paid_on_time: paidRows.length - paidLate.length,
    paid_late: paidLate.length,
    amount_paid_late: paidLate.reduce((sum, r) => sum + Number(r.total_amount), 0),
    amount_at_risk: msmeRows.reduce((sum, r) => sum + r.amount_at_risk, 0),
    worst: active[0] || null,
    rows: rows.sort((a, b) => byUrgency[a.state] - byUrgency[b.state]),
  };
}

function formatShort(amount: number): string {
  if (amount >= 10000000) return '₹' + (Math.round((amount / 10000000) * 100) / 100).toFixed(2) + ' Cr';
  if (amount >= 100000) return '₹' + (Math.round((amount / 100000) * 100) / 100).toFixed(2) + ' L';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export { formatShort };
