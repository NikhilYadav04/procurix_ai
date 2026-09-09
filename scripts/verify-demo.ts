import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { summarise, formatShort } from '../src/lib/msmeCompliance';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log('  PASS  ' + m); };
const bad = (m: string) => { fail++; console.log('  FAIL  ' + m); };

async function get(path: string): Promise<any[]> {
  const r = await fetch(URL + '/rest/v1/' + path, { headers: H });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

function expect(label: string, actual: any, wanted: any) {
  if (actual === wanted) ok(`${label} = ${actual}`);
  else bad(`${label} = ${actual}, expected ${wanted}`);
}

async function main() {
  const email = process.argv.find((a) => a.includes('@')) || 'tejas12951@gmail.com';
  console.log('Verifying seeded demo for ' + email);
  console.log(URL);

  console.log('\nROW COUNTS\n');
  const [vendors, rfps, quotes, pos, negs, auctions, bids, invites] = await Promise.all([
    get('vendors?select=*'),
    get('rfps?select=*&order=rfp_number'),
    get('quotes?select=*'),
    get('purchase_orders?select=*'),
    get('negotiations?select=*'),
    get('auctions?select=*&order=auction_number'),
    get('bids?select=*'),
    get('auction_invitations?select=*'),
  ]);

  expect('vendors', vendors.length, 7);
  expect('rfps', rfps.length, 5);
  expect('quotes', quotes.length, 10);
  expect('purchase_orders', pos.length, 8);
  expect('negotiations', negs.length, 2);
  expect('auctions', auctions.length, 2);
  expect('bids', bids.length, 11);
  expect('auction_invitations', invites.length, 7);

  console.log('\nOWNERSHIP  (every row must belong to the demo account)\n');
  for (const [name, rows] of [['rfps', rfps], ['quotes', quotes], ['purchase_orders', pos], ['negotiations', negs], ['vendors', vendors]] as const) {
    const strays = rows.filter((r: any) => r.customer_email !== email);
    strays.length ? bad(`${name} has ${strays.length} row(s) under another account`) : ok(`${name} all owned by ${email}`);
  }
  const auctionStrays = auctions.filter((a: any) => a.created_by !== email);
  auctionStrays.length ? bad('auctions not created_by the demo account') : ok('auctions all created_by ' + email);

  console.log('\nLINK INTEGRITY\n');
  const rfpIds = new Set(rfps.map((r: any) => r.id));
  const orphanQuotes = quotes.filter((q: any) => !rfpIds.has(q.rfp_id));
  orphanQuotes.length ? bad(orphanQuotes.length + ' quote(s) point at a missing RFP') : ok('every quote resolves to a real RFP');

  const auctionIds = new Set(auctions.map((a: any) => a.id));
  const orphanBids = bids.filter((b: any) => !auctionIds.has(b.auction_id));
  orphanBids.length ? bad(orphanBids.length + ' bid(s) point at a missing auction') : ok('every bid resolves to a real auction');

  const vendorEmails = new Set(vendors.map((v: any) => v.email));
  const unknownQuoteVendors = quotes.filter((q: any) => !vendorEmails.has(q.vendor_email));
  unknownQuoteVendors.length ? bad(unknownQuoteVendors.length + ' quote(s) from a vendor not in the vendor list') : ok('every quote comes from a known vendor');

  const unknownPoVendors = pos.filter((p: any) => !vendorEmails.has(p.vendor_email));
  unknownPoVendors.length ? bad(unknownPoVendors.length + ' PO(s) to a vendor not in the vendor list') : ok('every PO goes to a known vendor');

  const tokenless = invites.filter((i: any) => !i.token);
  tokenless.length ? bad(tokenless.length + ' invitation(s) have no token, vendor link will not open') : ok('every auction invitation has a login token');

  console.log('\nTHE LIVE COMPARISON  (RFP-9003)\n');
  const live = rfps.find((r: any) => r.rfp_number === 'RFP-9003');
  const liveQuotes = quotes.filter((q: any) => q.rfp_id === live?.id);
  expect('quotes waiting on RFP-9003', liveQuotes.length, 3);
  expect('RFP-9003 status', live?.status, 'quoting');
  const allReceived = liveQuotes.every((q: any) => q.status === 'received');
  allReceived ? ok('all 3 are unawarded, so the award flow is demonstrable') : bad('some RFP-9003 quotes are already decided');
  const spread = Math.max(...liveQuotes.map((q: any) => +q.total_amount)) - Math.min(...liveQuotes.map((q: any) => +q.total_amount));
  spread > 100000 ? ok('price spread is ' + formatShort(spread) + ', wide enough to show trade-offs') : bad('price spread too narrow to be interesting');

  console.log('\nMSME RADAR  (running the app\'s own compliance code)\n');
  const msmeByEmail = new Map(vendors.map((v: any) => [v.email.toLowerCase(), v.is_msme]));
  const resolved = pos.map((p: any) => ({
    ...p,
    vendor_is_msme: p.vendor_is_msme ?? msmeByEmail.get(p.vendor_email.toLowerCase()) ?? null,
  }));
  const s = summarise(resolved as any);

  for (const r of s.rows) {
    console.log(
      '        ' + String(r.po_number).padEnd(9) +
      String(r.state).toUpperCase().padEnd(16) +
      String(r.vendor_name).padEnd(24) +
      (r.days_elapsed === null ? '' : 'day ' + r.days_elapsed + ' of ' + r.deadline_days)
    );
  }
  console.log('');

  expect('breached', s.breached, 1);
  expect('urgent', s.urgent, 1);
  expect('due_soon', s.due_soon, 1);
  expect('safe', s.safe, 1);
  expect('paid on time', s.paid_on_time, 1);
  expect('paid late', s.paid_late, 1);
  s.worst?.po_number === 'PO-9001'
    ? ok('worst offender is PO-9001, the one the demo talks about')
    : bad('worst offender is ' + s.worst?.po_number + ', expected PO-9001');
  s.amount_at_risk > 0
    ? ok('amount at risk is ' + formatShort(s.amount_at_risk) + ', radar will render red')
    : bad('amount at risk is zero, radar will look calm');

  console.log('\nLIVE AUCTION  (AUC-9001)\n');
  const auc = auctions.find((a: any) => a.auction_number === 'AUC-9001');
  expect('AUC-9001 status', auc?.status, 'active');
  const started = new Date(auc.scheduled_start).getTime() < Date.now();
  const ends = new Date(auc.scheduled_end).getTime() > Date.now();
  started && ends ? ok('auction window is open right now') : bad('auction window is not open: start ' + auc.scheduled_start + ' end ' + auc.scheduled_end);
  const aucBids = bids.filter((b: any) => b.auction_id === auc.id).sort((a: any, b: any) => a.bid_number - b.bid_number);
  expect('bids on the live auction', aucBids.length, 6);
  const descending = aucBids.every((b: any, i: number) => i === 0 || +b.amount < +aucBids[i - 1].amount);
  descending ? ok('every bid undercuts the one before it, so the chart falls cleanly') : bad('bid amounts are not strictly descending');
  const lowest = Math.min(...aucBids.map((b: any) => +b.amount));
  +auc.current_price === lowest
    ? ok('current_price matches the lowest bid (' + formatShort(lowest) + ')')
    : bad('current_price is ' + auc.current_price + ' but the lowest bid is ' + lowest);

  console.log('\nCOMPANY PROFILE\n');
  const prof = await fetch(URL + '/rest/v1/userprofile?select=company_name,company_gstin&email=eq.' + encodeURIComponent(email), { headers: H });
  if (!prof.ok) {
    bad('userprofile is missing the company columns -- run database/phase5-company-profile.sql, then reseed');
  } else {
    const row = (await prof.json())[0];
    row?.company_name
      ? ok('company profile set to "' + row.company_name + '" (POs and emails will be branded)')
      : bad('company columns exist but are empty -- rerun the seed');
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail > 0) console.log('\nFix the failures above before the demo.');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('VERIFY FAILED: ' + e.message); process.exit(1); });
