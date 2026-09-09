'use client';

/**
 * The six scenes the pinned sequence walks through.
 *
 * These are deliberately diagrammatic, not simulated screenshots: no fake
 * window chrome, no invented browser bar. They abstract one stage each so a
 * first-time reader understands what the agent actually does.
 *
 * The worked example is the real one from the Round 1 deck: 250 workstation
 * desks quoted by Kumar, Rapid and Godrej.
 */

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FileText, Mail, Inbox, SlidersHorizontal, ShieldCheck, Check } from 'lucide-react';
import { spring, ease, dur } from '@/lib/motion';

export type Step = {
  key: string;
  label: string;
  headline: string;
  body: string;
  icon: React.ReactNode;
};

export const STEPS: Step[] = [
  {
    key: 'describe',
    label: 'Describe it',
    headline: 'Say what you need to buy.',
    body: 'Plain English, the way you would put it to a colleague. No form, no category tree, no supplier codes.',
    icon: <Inbox className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'rfp',
    label: 'RFP drafted',
    headline: 'It writes the RFP and numbers it.',
    body: 'Requirements become a formatted, numbered document ready to send. You review it before anything leaves.',
    icon: <FileText className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'sent',
    label: 'Sent to vendors',
    headline: 'It emails your suppliers from your own inbox.',
    body: 'Sent through your Gmail, so replies come back to you and the thread stays yours.',
    icon: <Mail className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'read',
    label: 'Quotes read',
    headline: 'It reads whatever comes back.',
    body: 'A PDF, a photographed letterhead, four lines in a mail body. All three are parsed into the same fields.',
    icon: <Inbox className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'rank',
    label: 'Ranked on your weights',
    headline: 'You decide what matters. It re-ranks.',
    body: 'Raise the delivery weight and the order changes. Every score is computed by a plain function, never by the model.',
    icon: <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />,
  },
  {
    key: 'award',
    label: 'Awarded, clock watched',
    headline: 'You award. It watches the payment deadline.',
    body: 'The purchase order is issued and the 45-day Section 43B(h) clock starts. You get told on day 42, not at audit.',
    icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
  },
];

const VENDORS = [
  { name: 'Kumar Furnishings', amount: '₹31,20,000', days: '45 days', note: 'Cheapest' },
  { name: 'Rapid Interiors', amount: '₹33,50,000', days: '21 days', note: 'Fastest' },
  { name: 'Godrej Interio', amount: '₹34,80,000', days: '30 days', note: 'Longest warranty' },
];

/* -------------------------------------------------------------------------- */

const Frame: React.FC<{ children: React.ReactNode; caption?: string }> = ({ children, caption }) => (
  <div className="w-full">
    <div className="rounded-[var(--radius)] border border-border bg-surface p-6 shadow-[0_24px_60px_-32px_hsl(220_12%_9%/0.35)] sm:p-8">
      {children}
    </div>
    {caption ? (
      <p className="mt-3 text-label text-muted-foreground">{caption}</p>
    ) : null}
  </div>
);

const rowIn = (i: number, reduce: boolean) =>
  reduce
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: dur.enter, ease: ease.standard, delay: 0.06 + i * 0.08 },
      };

/* -------------------------------------------------------------------------- */

const SceneDescribe: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="What you type">
    <div className="rounded-[var(--radius-inner)] border border-border bg-sunken px-4 py-4">
      <p className="text-pretty text-base leading-relaxed text-foreground sm:text-lg">
        I need 250 workstation desks. Get quotes from Kumar, Rapid and Godrej.
        {!reduce && (
          <motion.span
            aria-hidden="true"
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
            className="ml-0.5 inline-block h-5 w-[2px] translate-y-0.5 bg-primary"
          />
        )}
      </p>
    </div>
  </Frame>
);

const SceneRfp: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="Drafted in about nine seconds">
    <div className="flex items-center justify-between border-b border-border pb-4">
      <div>
        <div className="figure text-sm font-semibold text-foreground">RFP-0042</div>
        <div className="text-label text-muted-foreground">250 workstation desks</div>
      </div>
      <span className="rounded-[var(--radius-inner)] border border-border bg-sunken px-2.5 py-1 text-label text-muted-foreground">
        12 line items
      </span>
    </div>
    <div className="mt-5 space-y-2.5">
      {[100, 82, 91, 64, 74].map((w, i) => (
        <motion.div
          key={i}
          {...(reduce
            ? {}
            : {
                initial: { scaleX: 0, opacity: 0 },
                animate: { scaleX: 1, opacity: 1 },
                transition: { duration: 0.34, ease: ease.standard, delay: i * 0.07 },
              })}
          style={{ width: `${w}%`, transformOrigin: '0% 50%' }}
          className="h-2.5 rounded-full bg-secondary"
        />
      ))}
    </div>
  </Frame>
);

const SceneSent: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="Sent from your own Gmail">
    <ul className="divide-y divide-border">
      {VENDORS.map((v, i) => (
        <motion.li key={v.name} {...rowIn(i, reduce)} className="flex items-center gap-3 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-inner)] border border-border bg-sunken">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{v.name}</span>
          <span className="inline-flex items-center gap-1.5 text-label text-safe">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Sent
          </span>
        </motion.li>
      ))}
    </ul>
  </Frame>
);

const FORMATS = [
  { fmt: 'PDF attachment', vendor: 'Kumar Furnishings', amount: '₹31,20,000' },
  { fmt: 'Photographed letterhead', vendor: 'Rapid Interiors', amount: '₹33,50,000' },
  { fmt: 'Four lines in the mail body', vendor: 'Godrej Interio', amount: '₹34,80,000' },
];

const SceneRead: React.FC<{ reduce: boolean }> = ({ reduce }) => (
  <Frame caption="Three formats, one set of fields">
    <div className="grid gap-3 sm:grid-cols-3">
      {FORMATS.map((f, i) => (
        <motion.div
          key={f.vendor}
          {...rowIn(i, reduce)}
          className="rounded-[var(--radius-inner)] border border-border bg-sunken p-4"
        >
          <div className="text-label text-muted-foreground">{f.fmt}</div>
          <div className="mt-3 truncate text-sm font-medium text-foreground">{f.vendor}</div>
          <div className="figure mt-1 text-base font-semibold text-foreground">{f.amount}</div>
        </motion.div>
      ))}
    </div>
  </Frame>
);

const SceneRank: React.FC<{ reduce: boolean }> = ({ reduce }) => {
  // Delivery is weighted up, so the fastest supplier takes the top slot.
  const ranked = [VENDORS[1], VENDORS[0], VENDORS[2]];
  const widths = [100, 88, 72];

  return (
    <Frame caption="Delivery weighted up, so the ranking flipped">
      <div className="mb-5 flex flex-wrap gap-2">
        {['Price 30%', 'Delivery 50%', 'Quality 20%'].map((chip) => (
          <span
            key={chip}
            className="figure rounded-[var(--radius-inner)] border border-border bg-sunken px-2.5 py-1 text-label text-muted-foreground"
          >
            {chip}
          </span>
        ))}
      </div>
      <ul className="space-y-4">
        {ranked.map((v, i) => (
          <motion.li key={v.name} layout transition={spring.reorder}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-foreground">
                {i === 0 ? <span className="text-primary">1. </span> : `${i + 1}. `}
                {v.name}
              </span>
              <span className="figure shrink-0 text-sm text-muted-foreground">
                {v.amount}, {v.days}
              </span>
            </div>
            <motion.div
              {...(reduce
                ? {}
                : {
                    initial: { scaleX: 0 },
                    animate: { scaleX: 1 },
                    transition: { duration: 0.45, ease: ease.standard, delay: i * 0.08 },
                  })}
              style={{ width: `${widths[i]}%`, transformOrigin: '0% 50%' }}
              className={`mt-2 h-2.5 rounded-full ${i === 0 ? 'bg-series-1' : 'bg-secondary'}`}
            />
          </motion.li>
        ))}
      </ul>
    </Frame>
  );
};

const SceneAward: React.FC<{ reduce: boolean }> = ({ reduce }) => {
  const R = 34;
  const C = 2 * Math.PI * R;
  const elapsed = 42 / 45;

  return (
    <Frame caption="Example data">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="min-w-0 flex-1">
          <div className="text-label text-muted-foreground">Purchase order issued</div>
          <div className="figure mt-1 text-sm font-semibold text-foreground">PO-0007</div>
          <div className="mt-3 truncate text-base font-semibold text-foreground">Rapid Interiors</div>
          <div className="figure mt-1 text-2xl font-semibold text-foreground">₹33,50,000</div>
          <p className="mt-3 text-sm leading-relaxed text-watch">
            Pay by 12 Feb to keep the deduction.
          </p>
        </div>

        <div className="flex shrink-0 items-center justify-center">
          <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="Day 42 of the 45-day MSME payment window">
            <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }} transform="rotate(-90 48 48)">
              <circle cx="48" cy="48" r={R} fill="none" strokeWidth="8" className="stroke-secondary" />
              <motion.circle
                cx="48"
                cy="48"
                r={R}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className="stroke-watch"
                strokeDasharray={C}
                {...(reduce
                  ? { strokeDashoffset: C * (1 - elapsed) }
                  : {
                      initial: { strokeDashoffset: C },
                      animate: { strokeDashoffset: C * (1 - elapsed) },
                      transition: { duration: 0.9, ease: ease.standard },
                    })}
              />
            </g>
            <text
              x="48"
              y="52"
              textAnchor="middle"
              className="fill-foreground font-mono text-[15px] font-semibold"
            >
              42/45
            </text>
          </svg>
        </div>
      </div>
    </Frame>
  );
};

/* -------------------------------------------------------------------------- */

export const SCENES: Record<string, React.FC<{ reduce: boolean }>> = {
  describe: SceneDescribe,
  rfp: SceneRfp,
  sent: SceneSent,
  read: SceneRead,
  rank: SceneRank,
  award: SceneAward,
};

export const Scene: React.FC<{ stepKey: string }> = ({ stepKey }) => {
  const reduce = !!useReducedMotion();
  const Cmp = SCENES[stepKey];
  return <Cmp reduce={reduce} />;
};
