require('dotenv').config({ path: '.env.local' });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' };

const CUSTOMER = process.argv.find((a) => a.includes('@')) || 'tejas12951@gmail.com';
const RESET = process.argv.includes('--reset');
const TOPUP = !process.argv.includes('--no-credits');

const BUYER = {
  company: 'Navicon Infra Pvt Ltd',
  contact: 'Nikhil Yadav',
  address: 'Hinjewadi Phase 1, Pune, Maharashtra 411057',
  gstin: '27AAPFU0939F1ZV',
};

async function retry(fn, n = 4) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); } catch (e) { if (i === n - 1) throw e; await new Promise((r) => setTimeout(r, 1200)); }
  }
}

const req = (p, o = {}) => retry(async () => {
  const r = await fetch(URL + '/rest/v1/' + p, { headers: H, ...o });
  const t = await r.text();
  let b = null; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  if (!r.ok) throw new Error(r.status + ' on ' + p.split('?')[0] + ' -> ' + JSON.stringify(b).slice(0, 220));
  return b;
});

const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
const ahead = (h) => new Date(Date.now() + h * 3600000).toISOString();
const inr = (n) => 'Rs ' + Number(n).toLocaleString('en-IN');

const VENDORS = {
  sharma:    { name: 'Sharma Steel Works',        email: 'sales@sharmasteel.example.com',      gstin: '27AAPFU0939F1ZV', state_code: '27', is_msme: true,  udyam_number: 'UDYAM-MH-03-0041882', phone: '+91 98200 41882', address: 'Bhosari MIDC, Pune, Maharashtra',             wins: 4, auctions: 9 },
  kumar:     { name: 'Kumar Furniture Pvt Ltd',   email: 'quotes@kumarfurniture.example.com',  gstin: '24AAACC1206D1ZM', state_code: '24', is_msme: true,  udyam_number: 'UDYAM-GJ-11-0009317', phone: '+91 99250 09317', address: 'Odhav Industrial Estate, Ahmedabad, Gujarat', wins: 2, auctions: 7 },
  rapid:     { name: 'Rapid Office Supplies',     email: 'bids@rapidoffice.example.com',       gstin: '29AAGCB7383J1Z4', state_code: '29', is_msme: true,  udyam_number: 'UDYAM-KR-03-0017740', phone: '+91 80471 17740', address: 'Peenya Industrial Area, Bengaluru, Karnataka', wins: 1, auctions: 6 },
  precision: { name: 'Precision Fasteners Co',    email: 'sales@precisionfast.example.com',    gstin: '33AABCP4521M1Z8', state_code: '33', is_msme: true,  udyam_number: 'UDYAM-TN-02-0028461', phone: '+91 44286 28461', address: 'Ambattur Industrial Estate, Chennai, Tamil Nadu', wins: 2, auctions: 5 },
  godrej:    { name: 'Godrej Interio',            email: 'enterprise@godrejinterio.example.com', gstin: '07AAACG2115R1ZJ', state_code: '07', is_msme: false, udyam_number: null,                phone: '+91 11402 28810', address: 'Okhla Phase II, New Delhi',                   wins: 2, auctions: 6 },
  nilkamal:  { name: 'Nilkamal Seating',          email: 'corporate@nilkamalseating.example.com', gstin: '27AAACN2571P1ZK', state_code: '27', is_msme: false, udyam_number: null,              phone: '+91 22671 63000', address: 'Andheri East, Mumbai, Maharashtra',            wins: 0, auctions: 4 },
  bharat:    { name: 'Bharat Industrial Traders', email: 'info@bharatindustrial.example.com',  gstin: null,              state_code: null, is_msme: null,  udyam_number: null,                  phone: '+91 79820 11245', address: 'Naroda Road, Ahmedabad, Gujarat',             wins: 0, auctions: 2 },
};

async function wipe() {
  console.log('clearing existing procurement data');
  for (const t of ['negotiations', 'purchase_orders', 'quotes', 'bids', 'auction_invitations', 'auction_documents', 'rfps', 'auctions', 'vendors']) {
    await req(t + '?id=not.is.null', { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
  }
}

async function seedCompanyProfile() {
  const body = {
    company_name: BUYER.company,
    company_address: BUYER.address,
    company_gstin: BUYER.gstin,
    contact_title: 'Procurement Manager',
    contact_phone: '+91 98765 43210',
  };
  try {
    await req('userprofile?email=eq.' + encodeURIComponent(CUSTOMER), { method: 'PATCH', body: JSON.stringify(body) });
    console.log('  company profile set');
  } catch (e) {
    console.log('  company profile SKIPPED -- run database/phase5-company-profile.sql in the Supabase SQL editor');
  }
}

async function seedCredits() {
  if (!TOPUP) return;
  try {
    await req('customers?email=eq.' + encodeURIComponent(CUSTOMER), {
      method: 'PATCH',
      body: JSON.stringify({ monthly_chat_credit: 500, monthly_doc_credit: 100 }),
    });
    console.log('  credits topped up to 500 chat / 100 doc');
  } catch {
    console.log('  credit top-up skipped');
  }
}

async function seedVendors() {
  const out = {};
  for (const [k, v] of Object.entries(VENDORS)) {
    const payload = {
      name: v.name, email: v.email, customer_email: CUSTOMER,
      phone: v.phone, address: v.address, gstin: v.gstin, legal_name: v.name,
      state_code: v.state_code, is_msme: v.is_msme, udyam_number: v.udyam_number,
      msme_verified_at: v.gstin ? ago(28) : null,
      total_wins: v.wins, total_auctions_participated: v.auctions,
    };
    const existing = await req(`vendors?select=id&email=eq.${encodeURIComponent(v.email)}`);
    const row = existing.length
      ? (await req(`vendors?id=eq.${existing[0].id}`, { method: 'PATCH', body: JSON.stringify(payload) }))[0]
      : (await req('vendors', { method: 'POST', body: JSON.stringify(payload) }))[0];
    out[k] = { ...v, id: row.id };
  }
  const msme = Object.values(out).filter((x) => x.is_msme === true).length;
  const large = Object.values(out).filter((x) => x.is_msme === false).length;
  const unknown = Object.values(out).filter((x) => x.is_msme === null).length;
  console.log('  ' + Object.keys(out).length + ' vendors (' + msme + ' MSME, ' + large + ' large, ' + unknown + ' unverified)');
  return out;
}

async function seedRfps() {
  const mk = (num, title, status, days, sentTo) => ({
    rfp_number: num, title, customer_email: CUSTOMER, status,
    company_name: BUYER.company, contact_name: BUYER.contact, contact_email: CUSTOMER,
    created_at: ago(days), sent_at: status === 'draft' ? null : ago(days - 1),
    sent_to: sentTo || null, metadata: { seeded: true, buyer: BUYER.company },
  });

  const defs = [
    ['RFP-9001', 'Supply of 120 MS Storage Racks', 'awarded', 68, [VENDORS.sharma.email, VENDORS.godrej.email]],
    ['RFP-9002', 'Annual Contract for Industrial Fasteners', 'awarded', 55, [VENDORS.precision.email, VENDORS.nilkamal.email]],
    ['RFP-9003', 'Supply of 250 Workstation Desks', 'quoting', 7, [VENDORS.kumar.email, VENDORS.rapid.email, VENDORS.godrej.email]],
    ['RFP-9004', 'Supply of 500 Ergonomic Office Chairs', 'awarded', 74, [VENDORS.sharma.email, VENDORS.kumar.email, VENDORS.rapid.email]],
    ['RFP-9005', 'Site Safety Equipment - Q3 Requirement', 'sent', 2, [VENDORS.rapid.email, VENDORS.bharat.email]],
  ];

  const rfps = {};
  for (const d of defs) rfps[d[0]] = (await req('rfps', { method: 'POST', body: JSON.stringify(mk(...d)) }))[0];

  await req('rfp_counter?id=eq.1', { method: 'PATCH', body: JSON.stringify({ last_number: 9005 }) });
  console.log('  5 RFPs (3 awarded, 1 live with quotes, 1 sent and awaiting) -- counter set to 9005');
  return rfps;
}

async function seedQuotes(rfps, v) {
  const q = (rfp, vendor, amount, days, terms, warranty, status, recvDays, items) => ({
    rfp_id: rfp.id, rfp_number: rfp.rfp_number, customer_email: CUSTOMER,
    vendor_email: vendor.email, vendor_name: vendor.name,
    total_amount: amount, currency: 'INR', delivery_days: days,
    payment_terms: terms, warranty, line_items: items || [], notes: 'GST @ 18% extra as applicable.',
    source: 'email', raw_email_id: null, raw_text: null,
    confidence: 1, status, received_at: ago(recvDays), revision_of: null,
  });

  const desks = (unit) => [{ description: 'Workstation Desk 1200x600mm, powder-coated MS frame', quantity: 250, unit_price: unit, amount: unit * 250 }];
  const chairs = (unit) => [{ description: 'Ergonomic Office Chair, mesh back, 5-year frame warranty', quantity: 500, unit_price: unit, amount: unit * 500 }];
  const racks = (unit) => [{ description: 'MS Storage Rack, 5 shelves, 2000x1000x500mm', quantity: 120, unit_price: unit, amount: unit * 120 }];

  await req('quotes', { method: 'POST', body: JSON.stringify([
    q(rfps['RFP-9001'], v.sharma, 1840000, 35, 'Net 30', '3 years', 'awarded', 64, racks(15333)),
    q(rfps['RFP-9001'], v.godrej, 2120000, 28, 'Net 45', '5 years', 'rejected', 63, racks(17666)),

    q(rfps['RFP-9002'], v.precision, 960000, 21, 'Net 45', '1 year', 'awarded', 51, []),
    q(rfps['RFP-9002'], v.nilkamal, 1085000, 30, '50% advance', '1 year', 'rejected', 51, []),

    q(rfps['RFP-9003'], v.kumar,  3120000, 45, 'Net 30',      '5 years', 'received', 5, desks(12480)),
    q(rfps['RFP-9003'], v.rapid,  3350000, 21, '50% advance', '3 years', 'received', 4, desks(13400)),
    q(rfps['RFP-9003'], v.godrej, 3480000, 30, 'Net 45',      '7 years', 'received', 3, desks(13920)),

    q(rfps['RFP-9004'], v.sharma, 2450000, 40, 'Net 30', '5 years', 'awarded', 70, chairs(4900)),
    q(rfps['RFP-9004'], v.rapid,  2580000, 25, 'Net 45', '3 years', 'rejected', 70, chairs(5160)),
    q(rfps['RFP-9004'], v.kumar,  2610000, 30, 'Net 30', '5 years', 'rejected', 69, chairs(5220)),
  ]) });
  console.log('  10 quotes (3 live on RFP-9003, ready to compare and award)');
}

async function seedPurchaseOrders(rfps, v) {
  const awarded = {};
  for (const n of ['RFP-9001', 'RFP-9002', 'RFP-9004']) {
    awarded[n] = (await req(`quotes?select=id&rfp_id=eq.${rfps[n].id}&status=eq.awarded`))[0];
  }

  const po = (num, rfpNum, vendor, amount, days, terms, savings, invoiceDays, paidDays, status, title) => ({
    po_number: num,
    rfp_id: rfpNum ? rfps[rfpNum].id : null,
    quote_id: rfpNum ? awarded[rfpNum].id : null,
    rfp_number: rfpNum || null,
    customer_email: CUSTOMER, buyer_company: BUYER.company,
    buyer_contact: BUYER.contact, buyer_email: CUSTOMER,
    vendor_email: vendor.email, vendor_name: vendor.name, vendor_is_msme: vendor.is_msme,
    title: title || (rfpNum ? rfps[rfpNum].title : num),
    total_amount: amount, currency: 'INR', delivery_days: days,
    payment_terms: terms, warranty: null, line_items: [], savings_vs_highest: savings,
    status,
    issued_at: ago(invoiceDays === null ? 3 : invoiceDays + 6),
    sent_at: ago(invoiceDays === null ? 3 : invoiceDays + 5),
    invoice_received_at: invoiceDays === null ? null : ago(invoiceDays),
    paid_at: paidDays === null ? null : ago(paidDays),
  });

  await req('purchase_orders', { method: 'POST', body: JSON.stringify([
    po('PO-9001', 'RFP-9001', v.sharma,    1840000, 35, 'Net 30', 280000, 41, null, 'invoiced'),
    po('PO-9002', 'RFP-9002', v.precision,  960000, 21, 'Net 45', 125000, 42, null, 'invoiced'),
    po('PO-9004', 'RFP-9004', v.sharma,    2450000, 40, 'Net 30', 160000, 60,   20, 'paid'),
    po('PO-9003', null,       v.kumar,     1240000, 30, 'Net 45',   null, 33, null, 'invoiced', 'Modular Storage Cabinets - Pune Site'),
    po('PO-9005', null,       v.rapid,      480000, 14, 'Net 45',   null,  6, null, 'invoiced', 'Stationery and Consumables - Q3'),
    po('PO-9006', null,       v.precision,  620000, 18, 'Net 30',   null, 50,   38, 'paid',     'Fastener Top-up Order - Nashik'),
    po('PO-9007', null,       v.godrej,    1980000, 30, 'Net 45',   null, 50, null, 'invoiced', 'Reception and Lounge Furniture'),
    po('PO-9008', null,       v.bharat,     340000, 21, 'Net 30',   null, 20, null, 'invoiced', 'Site Consumables - Trial Order'),
  ]) });

  console.log('  8 purchase orders spanning every compliance state:');
  console.log('      PO-9001  Sharma Steel     BREACHED   11 days past a 30-day term  ' + inr(1840000) + ' at risk');
  console.log('      PO-9002  Precision        URGENT     3 days left on a 45-day term');
  console.log('      PO-9003  Kumar Furniture  DUE SOON   12 days left');
  console.log('      PO-9005  Rapid Office     SAFE       39 days left');
  console.log('      PO-9004  Sharma Steel     PAID LATE  paid on day 40 of 30');
  console.log('      PO-9006  Precision        PAID OK    paid on day 12 of 30');
  console.log('      PO-9007  Godrej Interio   N/A        large enterprise, rule does not apply');
  console.log('      PO-9008  Bharat Traders   UNKNOWN    MSME status never confirmed');
}

async function seedNegotiations(rfps, v) {
  const awardedA = (await req(`quotes?select=id&rfp_id=eq.${rfps['RFP-9001'].id}&status=eq.awarded`))[0];
  const liveGodrej = (await req(`quotes?select=id&rfp_id=eq.${rfps['RFP-9003'].id}&vendor_email=eq.${encodeURIComponent(v.godrej.email)}`))[0];

  await req('negotiations', { method: 'POST', body: JSON.stringify([
    {
      rfp_id: rfps['RFP-9001'].id, quote_id: awardedA.id, rfp_number: 'RFP-9001', customer_email: CUSTOMER,
      vendor_email: v.sharma.email, vendor_name: v.sharma.name,
      current_amount: 1980000, target_amount: 1840000,
      leverage: 'A competing bid came in lower on comparable specification and a shorter delivery window.',
      subject: 'Counter-offer: RFP-9001 - Supply of 120 MS Storage Racks',
      body: 'Dear Sharma Steel Works,\n\nThank you for your quotation against RFP-9001.\n\nWe have received a competing offer on comparable specification at a lower price. Your delivery schedule and warranty are stronger, and we would prefer to place this order with you.\n\nWe request you to revise your price to Rs. 18,40,000 inclusive of the same scope. On confirmation we will release the purchase order the same day.\n\nRegards,\nNikhil Yadav\nProcurement Manager\nNavicon Infra Pvt Ltd',
      status: 'replied', sent_at: ago(66), replied_at: ago(65), result_amount: 1840000,
    },
    {
      rfp_id: rfps['RFP-9003'].id, quote_id: liveGodrej.id, rfp_number: 'RFP-9003', customer_email: CUSTOMER,
      vendor_email: v.godrej.email, vendor_name: v.godrej.name,
      current_amount: 3480000, target_amount: 3150000,
      leverage: 'Two lower quotes are on the table, one of them from a Udyam-registered supplier.',
      subject: 'Counter-offer: RFP-9003 - Supply of 250 Workstation Desks',
      body: 'Dear Godrej Interio,\n\nThank you for your quotation against RFP-9003.\n\nYours is currently the highest of three offers received. Your 7-year warranty is the strongest in the set, but the price gap is significant.\n\nIf you can revise to Rs. 31,50,000 we can place the order this week.\n\nRegards,\nNikhil Yadav\nProcurement Manager\nNavicon Infra Pvt Ltd',
      status: 'sent', sent_at: ago(1), replied_at: null, result_amount: null,
    },
  ]) });
  console.log('  2 negotiations (1 closed at ' + inr(140000) + ' saved, 1 awaiting reply)');
}

async function seedAuctions(v) {
  const inviteJson = (vendors) => JSON.stringify(vendors.map((x) => ({ id: x.id, name: x.name, email: x.email })));

  const liveVendors = [v.sharma, v.kumar, v.rapid, v.precision];
  const doneVendors = [v.sharma, v.godrej, v.nilkamal];

  const live = (await req('auctions', { method: 'POST', body: JSON.stringify({
    auction_number: 'AUC-9001',
    title: 'Reverse Auction - 250 Workstation Desks',
    description: 'Live reverse auction against RFP-9003. Lowest valid bid at close wins the order.',
    scheduled_start: ago(0.04), scheduled_end: ahead(20),
    duration_hours: 24, auction_type: 'percentage_decrement', decrement_value: 1,
    base_price: 3480000, current_price: 3012000,
    status: 'active', rfp_sent: true,
    invited_vendors: inviteJson(liveVendors), total_bids: 6,
    created_by: CUSTOMER,
  }) }))[0];

  const done = (await req('auctions', { method: 'POST', body: JSON.stringify({
    auction_number: 'AUC-9002',
    title: 'Reverse Auction - 120 MS Storage Racks',
    description: 'Completed reverse auction against RFP-9001.',
    scheduled_start: ago(67), scheduled_end: ago(66),
    actual_start: ago(67), actual_end: ago(66),
    duration_hours: 24, auction_type: 'amount_decrement', decrement_value: 25000,
    base_price: 2200000, current_price: 1840000, winning_bid: 1840000,
    status: 'completed', rfp_sent: true,
    winner_vendor_id: v.sharma.id, winner_vendor_email: v.sharma.email, winner_vendor_name: v.sharma.name,
    invited_vendors: inviteJson(doneVendors), total_bids: 5,
    created_by: CUSTOMER,
  }) }))[0];

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  for (const a of [live, done]) {
    await req('auctions?id=eq.' + a.id, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ auction_url: base + '/auction/' + a.id }) });
  }

  const bid = (auction, vendor, amount, prev, n, minsAgo) => ({
    auction_id: auction.id, vendor_id: vendor.id, vendor_email: vendor.email, vendor_name: vendor.name,
    amount, previous_price: prev, bid_number: n, is_valid: true,
    created_at: new Date(Date.now() - minsAgo * 60000).toISOString(),
  });

  await req('bids', { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify([
    bid(live, v.kumar,     3410000, 3480000, 1, 52),
    bid(live, v.rapid,     3330000, 3410000, 2, 44),
    bid(live, v.sharma,    3240000, 3330000, 3, 35),
    bid(live, v.kumar,     3150000, 3240000, 4, 24),
    bid(live, v.precision, 3080000, 3150000, 5, 13),
    bid(live, v.sharma,    3012000, 3080000, 6,  4),

    bid(done, v.godrej,   2150000, 2200000, 1, 96300),
    bid(done, v.nilkamal, 2050000, 2150000, 2, 96240),
    bid(done, v.sharma,   1960000, 2050000, 3, 96180),
    bid(done, v.godrej,   1900000, 1960000, 4, 96120),
    bid(done, v.sharma,   1840000, 1900000, 5, 96060),
  ]) });

  const invites = [];
  for (const x of liveVendors) invites.push({ auction_id: live.id, vendor_id: x.id, vendor_email: x.email, vendor_name: x.name, invitation_status: 'sent', invitation_sent_at: ago(1), vendor_viewed: true, vendor_viewed_at: ago(0.5), vendor_participated: true });
  for (const x of doneVendors) invites.push({ auction_id: done.id, vendor_id: x.id, vendor_email: x.email, vendor_name: x.name, invitation_status: 'sent', invitation_sent_at: ago(68), vendor_viewed: true, vendor_viewed_at: ago(67), vendor_participated: true });
  const savedInvites = await req('auction_invitations', { method: 'POST', body: JSON.stringify(invites) });

  console.log('  2 auctions: AUC-9001 live with 6 bids, AUC-9002 completed (Sharma won at ' + inr(1840000) + ')');
  return { live, done, invites: savedInvites };
}

async function main() {
  if (!URL || !KEY) { console.error('Missing Supabase env vars in .env.local'); process.exit(1); }

  console.log('Database: ' + URL);
  console.log('Seeding as: ' + CUSTOMER + '\n');

  if (RESET) await wipe();

  await seedCompanyProfile();
  await seedCredits();
  const v = await seedVendors();
  const rfps = await seedRfps();
  await seedQuotes(rfps, v);
  await seedPurchaseOrders(rfps, v);
  await seedNegotiations(rfps, v);
  const auctions = await seedAuctions(v);

  const liveInvite = auctions.invites.find((i) => i.auction_id === auctions.live.id && i.vendor_email === VENDORS.sharma.email);
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  console.log('\n----------------------------------------------------------');
  console.log('DEMO IS READY');
  console.log('----------------------------------------------------------');
  console.log('Money on record');
  console.log('  ' + inr(565000) + ' saved, every rupee backed by a losing quote you can open');
  console.log('  ' + inr(2800000) + ' of tax deduction at risk across PO-9001 and PO-9002');
  console.log('');
  console.log('The three things to show a judge');
  console.log('  1. RFP-9003 has 3 quotes waiting. Compare, move the weights, award.');
  console.log('  2. The MSME radar is red. PO-9001 is 11 days past its agreed 30-day term.');
  console.log('  3. AUC-9001 is live with 6 bids and the price still falling.');
  console.log('');
  console.log('Live auction links');
  console.log('  buyer view   ' + base + '/auction/' + auctions.live.id + '/client');
  if (liveInvite && liveInvite.token) {
    console.log('  vendor view  ' + base + '/auction/' + auctions.live.id + '/vendor?token=' + liveInvite.token);
    console.log('               (sign in on that page as ' + VENDORS.sharma.email + ')');
  }
  console.log('');
  console.log('Reset and reseed at any time:  node scripts/seed-demo.js --reset');
  console.log('----------------------------------------------------------');
}

main().catch((e) => { console.error('\nSEED FAILED: ' + e.message); process.exit(1); });
