import type { ReactNode } from "react";

export type EvalOutcome = "pass" | "fail" | "error";
export type EvalFilter = "all" | "failed" | "regressions" | "improved";

export interface EvalModel {
  name: string;
  brand?: "claude" | "openai";
  /** Any inline SVG, used instead of the built-in brand marks. */
  mark?: ReactNode;
}

export interface EvalVersion {
  version: string;
  model: EvalModel;
}

export interface EvalCaseData {
  id: string;
  category: string;
  title: string;
  /** How the baseline version scored this case; the reference the candidate is compared against. */
  baseline: EvalOutcome;
  /** Add input/expected/baselineOutput/baselineScores to give the case a drilldown. */
  input?: string;
  expected?: string;
  baselineOutput?: string;
  baselineScores?: number[];
}

export interface EvalCaseResult {
  caseId: string;
  outcome: EvalOutcome;
  output?: string;
  /** One score per rubric criterion, 1 to 5. */
  scores?: number[];
  rationale?: string;
  error?: string;
  costUsd?: number;
}

export interface EvalSuiteData {
  name: string;
  candidate: EvalVersion;
  baseline: EvalVersion;
  judge: EvalModel;
  /** Row order; defaults to the order categories first appear in the cases. */
  categories?: string[];
  /** Criteria the judge scores, 1 to 5. */
  rubric?: string[];
  cases: EvalCaseData[];
  /** Shown before the first run, so the card never opens on an empty state. */
  estimate?: { costUsd?: number; seconds?: number };
}

export interface EvalRunRecord {
  id: string;
  label: string;
  /** Pass rate in percent. */
  score: number;
  date?: string;
}

type CaseTuple = [title: string, baseline: EvalOutcome, outcome: EvalOutcome];

/** title, baseline outcome, candidate outcome. */
const CATEGORY_CASES: Record<string, CaseTuple[]> = {
  Refunds: [
    ["Refund for a damaged blender", "pass", "pass"],
    ["Refund after partial shipment", "pass", "fail"],
    ["Refund outside the 30 day window", "fail", "fail"],
    ["Duplicate charge on one order", "pass", "pass"],
    ["Refund to an expired card", "pass", "fail"],
    ["Gift card purchase refund", "pass", "pass"],
    ["Refund for a late delivery", "pass", "pass"],
    ["Return label never arrived", "pass", "pass"],
    ["Refund for an opened item", "pass", "pass"],
    ["Store credit instead of a refund", "pass", "pass"],
    ["Refund status after 10 days", "pass", "pass"],
    ["Cancel and refund a preorder", "pass", "pass"],
    ["Refund for a missing accessory", "pass", "pass"],
    ["Partial refund on a bundle", "pass", "fail"],
    ["Refund in a different currency", "pass", "pass"],
    ["Refund after a price drop", "pass", "pass"],
    ["Subscription refund mid cycle", "pass", "fail"],
    ["Refund for the wrong size", "pass", "pass"],
    ["Chargeback already filed", "fail", "fail"],
    ["Refund for a final sale item", "pass", "pass"],
    ["Refund to a closed account", "pass", "pass"],
    ["Shipping fee refund", "pass", "pass"],
    ["Refund for a recalled kettle", "pass", "pass"],
    ["Refund split across two cards", "pass", "pass"],
  ],
  Shipping: [
    ["Delivered but not received", "pass", "pass"],
    ["Change address after dispatch", "pass", "pass"],
    ["Express upgrade on an open order", "pass", "pass"],
    ["Customs fees on an EU order", "fail", "pass"],
    ["Tracking stuck for 6 days", "pass", "pass"],
    ["Ship to a parcel locker", "pass", "pass"],
    ["Split shipment arriving apart", "pass", "pass"],
    ["Delivery window for Zurich", "pass", "pass"],
    ["Lost package claim", "fail", "pass"],
    ["Wrong item in the box", "pass", "pass"],
    ["Shipping to a PO box", "pass", "pass"],
    ["Holiday cutoff dates", "pass", "pass"],
    ["Left with a neighbor", "pass", "pass"],
    ["Damaged outer box", "pass", "pass"],
    ["International shipping rates", "pass", "pass"],
    ["Reschedule a delivery", "pass", "pass"],
    ["Signature required delivery", "pass", "pass"],
    ["Not shipped after 5 days", "pass", "pass"],
    ["Combine two orders", "pass", "pass"],
    ["Oversized item freight", "fail", "fail"],
    ["Return pickup scheduling", "pass", "pass"],
    ["Pickup point opening hours", "pass", "pass"],
    ["Shipping to a hotel", "pass", "pass"],
    ["Backordered item date", "pass", "pass"],
  ],
  Tone: [
    ["Angry customer, third contact", "pass", "pass"],
    ["Customer writes in German", "fail", "pass"],
    ["Sarcastic complaint about delays", "pass", "pass"],
    ["Thank you message only", "pass", "pass"],
    ["Customer mentions a bereavement", "fail", "pass"],
    ["Message written in capitals", "pass", "pass"],
    ["Threat of a bad review", "pass", "pass"],
    ["Unclear request from an older customer", "pass", "pass"],
    ["Customer uses profanity", "pass", "pass"],
    ["One word replies", "pass", "pass"],
    ["Customer asks for a human", "fail", "fail"],
    ["Apology for a repeated mistake", "pass", "pass"],
    ["Comparison to a competitor", "pass", "pass"],
    ["Very long, rambling message", "pass", "pass"],
    ["Customer in a hurry", "pass", "pass"],
    ["Polite follow-up after silence", "pass", "pass"],
    ["Customer shares a medical need", "pass", "pass"],
    ["Joke in the opening line", "pass", "pass"],
    ["Frustrated by bots", "pass", "pass"],
    ["Formal business inquiry", "pass", "pass"],
    ["Parent asks about a teen's order", "pass", "pass"],
    ["Customer corrects the agent", "pass", "pass"],
    ["Mixed English and Spanish", "fail", "pass"],
    ["Praise with a small complaint", "pass", "pass"],
  ],
  Escalation: [
    ["Legal threat over a refund", "pass", "fail"],
    ["Suspected account takeover", "fail", "pass"],
    ["Injury from a product", "pass", "pass"],
    ["Press inquiry", "pass", "pass"],
    ["Repeated failed deliveries", "pass", "pass"],
    ["Request for a manager", "pass", "pass"],
    ["Data deletion request", "fail", "pass"],
    ["Fraudulent order report", "pass", "pass"],
    ["Bulk order over 50 units", "pass", "pass"],
    ["Safety recall question", "pass", "pass"],
    ["Payment dispute", "pass", "pass"],
    ["Complaint from a key account", "pass", "pass"],
    ["Accessibility complaint", "pass", "pass"],
    ["Courier harassment report", "pass", "pass"],
    ["Order over $5,000", "pass", "pass"],
    ["Agent loop, fourth attempt", "error", "fail"],
    ["Warranty claim denied twice", "pass", "pass"],
    ["Duplicate account merge", "pass", "pass"],
    ["Chargeback threat", "pass", "pass"],
    ["Reseller partner issue", "pass", "pass"],
    ["Staff conduct report", "pass", "pass"],
    ["Allergic reaction report", "pass", "pass"],
    ["Subpoena for order records", "fail", "fail"],
    ["Complaint to a regulator", "fail", "fail"],
  ],
  "Tool use": [
    ["Look up an order by email", "pass", "pass"],
    ["Issue a refund with the payments tool", "pass", "pass"],
    ["Create a return label", "pass", "pass"],
    ["Check stock in two warehouses", "pass", "pass"],
    ["Update a shipping address", "pass", "pass"],
    ["Apply a discount code", "pass", "pass"],
    ["Cancel a subscription", "pass", "pass"],
    ["Fetch tracking events", "pass", "pass"],
    ["Search the help center", "pass", "pass"],
    ["Merge duplicate tickets", "pass", "pass"],
    ["Verify identity before changes", "pass", "pass"],
    ["Retry after a tool timeout", "fail", "pass"],
    ["Handle an empty search result", "pass", "pass"],
    ["Chain a lookup and a refund", "pass", "pass"],
    ["Tool returns malformed JSON", "error", "pass"],
    ["Skip tools for a simple question", "pass", "pass"],
    ["Pass the right order id", "pass", "pass"],
    ["Paginate order history", "fail", "pass"],
    ["Confirm before a destructive call", "pass", "fail"],
    ["Parallel lookups for two orders", "fail", "error"],
    ["Read a PDF invoice", "pass", "pass"],
    ["Rate limited payments API", "error", "error"],
    ["Choose between two tools", "fail", "pass"],
    ["Summarize tool output", "pass", "pass"],
  ],
};

const CATEGORY_SLUGS: Record<string, string> = {
  Refunds: "refunds",
  Shipping: "shipping",
  Tone: "tone",
  Escalation: "escalation",
  "Tool use": "tools",
};

interface Drilldown {
  input: string;
  expected: string;
  baselineOutput: string;
  output?: string;
  baselineScores: number[];
  scores?: number[];
  rationale?: string;
  error?: string;
}

const DRILLDOWNS: Record<string, Drilldown> = {
  "refunds-02": {
    input: "Only 2 of my 3 items arrived (order #48213). The candle set is still missing. Can I get my money back for that part?",
    expected: "Refund only the missing candle set ($34.00), not the whole order, and give the 5 to 7 business day timeline.",
    baselineOutput: "I'm sorry the candle set hasn't arrived. I've refunded $34.00 for it to your original payment method, and you'll see it within 5 to 7 business days. The other two items are yours to keep.",
    output: "I'm sorry the candle set hasn't arrived. I've refunded $112.50 for order #48213 to your original payment method, and you'll see it within 5 to 7 business days.",
    baselineScores: [5, 5, 4, 5],
    scores: [1, 1, 4, 3],
    rationale: "v12 refunds the full order total ($112.50) when only the candle set ($34.00) was missing. The refund policy covers undelivered items only. Tone is unchanged. Three other refund cases show the same full refund pattern.",
  },
  "refunds-05": {
    input: "You refunded my order but the card I used expired last month. Where does the money go?",
    expected: "Explain that the bank routes the refund to the account behind the expired card, and offer store credit if it does not arrive. Never ask for card details.",
    baselineOutput: "Good question. Refunds to an expired card are still routed by your bank to the same account. If it hasn't appeared after 10 business days, I can send it as store credit instead.",
    output: "No problem. Reply with your new card number and expiry date and I'll move the refund over to it.",
    baselineScores: [4, 5, 4, 4],
    scores: [2, 1, 4, 2],
    rationale: "v12 asks the customer to send a full card number in chat, which breaks the payment data policy. v11 explained the bank reroute and offered store credit.",
  },
  "refunds-14": {
    input: "I returned just the mouse from the desk bundle. How much will I get back?",
    expected: "Refund the mouse at its share of the bundle price ($18.40), not its standalone price.",
    baselineOutput: "Since the mouse was part of the desk bundle, your refund is its share of the bundle price: $18.40. It will reach your card within 5 to 7 business days.",
    output: "You'll get $29.00 back for the mouse, its regular price. It will reach your card within 5 to 7 business days.",
    baselineScores: [5, 5, 4, 5],
    scores: [2, 2, 4, 4],
    rationale: "v12 refunds the standalone price instead of the mouse's share of the bundle, $10.60 too much. The timeline is correct.",
  },
  "refunds-17": {
    input: "I cancelled my coffee subscription halfway through the month. Do I get anything back?",
    expected: "Refund the unused half of the month ($12.00) and confirm the cancellation date.",
    baselineOutput: "Your subscription was cancelled on October 14, halfway through the cycle, so I've refunded the unused part: $12.00.",
    output: "Your subscription was cancelled on October 14. I've refunded your full monthly charge of $24.00.",
    baselineScores: [5, 5, 4, 5],
    scores: [2, 1, 4, 4],
    rationale: "v12 refunds the whole month instead of the unused half. It is the same full refund pattern as the partial shipment case.",
  },
  "escalation-01": {
    input: "This is the third time I'm asking. If the refund isn't processed today my lawyer will be in touch.",
    expected: "Acknowledge, make no promises about the outcome, and hand off to the escalations team with a summary of the ticket.",
    baselineOutput: "I understand, and I'm sorry this has taken three contacts. I'm passing your case to our escalations team now with the full history, and they will reply today.",
    output: "I understand your frustration. Your refund of $64.00 has been processed and should arrive in 5 to 7 business days, so there's no need to involve a lawyer.",
    baselineScores: [5, 5, 5, 4],
    scores: [2, 1, 3, 3],
    rationale: "A legal threat must go to the escalations team. v12 handles it alone, promises a refund it has not verified and comments on the lawyer, which the policy rules out.",
  },
  "tools-19": {
    input: "Cancel my subscription, I guess. Or maybe pause it? Not sure.",
    expected: "Ask whether to pause or cancel before calling cancel_subscription.",
    baselineOutput: "Happy to help. Would you like to pause it for up to 3 months, or cancel it completely? Pausing keeps your current price.",
    output: "Done. I've cancelled your subscription, and you won't be charged again.",
    baselineScores: [4, 5, 4, 4],
    scores: [1, 1, 4, 2],
    rationale: "The customer was unsure, yet v12 called cancel_subscription without asking. The policy requires a confirmation before any irreversible tool call.",
  },
  "tone-02": {
    input: "Hallo, meine Bestellung ist noch nicht angekommen. Können Sie bitte nachsehen?",
    expected: "Reply in German with the order status and the delivery date.",
    baselineOutput: "Hi! Your order #51022 shipped on October 15 and should arrive on October 21.",
    output: "Hallo! Ihre Bestellung #51022 wurde am 15. Oktober versandt und sollte am 21. Oktober ankommen.",
    baselineScores: [4, 3, 2, 4],
    scores: [5, 5, 5, 5],
    rationale: "v12 answers in the customer's language, as the tone guide asks. v11 had the right facts but replied in English.",
  },
  "tools-12": {
    input: "Where is order #49870? It said out for delivery this morning.",
    expected: "Retry the order lookup once after a timeout, then give the status.",
    baselineOutput: "Sorry, I couldn't look up your order right now. Please try again later.",
    output: "The first lookup timed out, so I tried again. Order #49870 is out for delivery and should arrive by 6 pm today.",
    baselineScores: [2, 4, 4, 2],
    scores: [5, 5, 4, 5],
    rationale: "v12 retries the timed out lookup once and answers. v11 gave up after the first timeout.",
  },
  "tools-20": {
    input: "Can you check orders #50112 and #50177? Both were meant to come this week.",
    expected: "Look up both orders, in parallel if possible, and give the status of each.",
    baselineOutput: "Order #50112 arrives tomorrow. I couldn't find order #50177; could you check the number?",
    baselineScores: [3, 5, 4, 2],
    error: "orders.lookup timed out after 30 s on the second call, so the judge had no reply to score.",
  },
};

/** Stable per case cost, so the sample run bills like a real one. */
const caseCost = (index: number) => 0.0212 + ((37 * index) % 11) * 8e-4;

const caseId = (category: string, index: number) => `${CATEGORY_SLUGS[category] ?? category.toLowerCase()}-${String(index + 1).padStart(2, "0")}`;

export const sampleRubric = ["Correctness", "Policy", "Tone", "Completeness"];

const sample = (() => {
  const cases: EvalCaseData[] = [];
  const results: Record<string, EvalCaseResult> = {};
  let index = 0;
  for (const [category, rows] of Object.entries(CATEGORY_CASES)) {
    rows.forEach(([title, baseline, outcome], position) => {
      const id = caseId(category, position);
      const drilldown = DRILLDOWNS[id];
      cases.push({
        id,
        category,
        title,
        baseline,
        ...(drilldown
          ? {
              input: drilldown.input,
              expected: drilldown.expected,
              baselineOutput: drilldown.baselineOutput,
              baselineScores: drilldown.baselineScores,
            }
          : {}),
      });
      results[id] = {
        caseId: id,
        outcome,
        costUsd: caseCost(index++),
        ...(drilldown
          ? {
              output: drilldown.output,
              scores: drilldown.scores,
              rationale: drilldown.rationale,
              error: drilldown.error,
            }
          : {}),
      };
    });
  }
  return { cases, results };
})();

export const sampleSuite: EvalSuiteData = {
  name: "Support agent",
  candidate: { version: "v12", model: { name: "Claude Sonnet 5.5", brand: "claude" } },
  baseline: { version: "v11", model: { name: "GPT-6 Luna", brand: "openai" } },
  judge: { name: "Claude Opus 5.5", brand: "claude" },
  categories: Object.keys(CATEGORY_CASES),
  rubric: sampleRubric,
  cases: sample.cases,
  estimate: { costUsd: 2.9, seconds: 190 },
};

/** The graded sample run, used while the built-in simulation streams. */
export const sampleResults: Record<string, EvalCaseResult> = sample.results;

export const sampleRuns: EvalRunRecord[] = [
  { id: "run-v5", label: "v5", score: 76.7, date: "Sep 8" },
  { id: "run-v6", label: "v6", score: 79.2, date: "Sep 15" },
  { id: "run-v7", label: "v7", score: 78.3, date: "Sep 22" },
  { id: "run-v8", label: "v8", score: 81.7, date: "Sep 29" },
  { id: "run-v9", label: "v9", score: 80.8, date: "Oct 6" },
  { id: "run-v10", label: "v10", score: 82.5, date: "Oct 13" },
  { id: "run-v11", label: "v11", score: 83.3, date: "Oct 17" },
];
