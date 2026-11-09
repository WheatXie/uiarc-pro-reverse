import type { ReactNode, SVGProps } from "react";

/** Sample account, period data and brand marks behind the account health block. */

export type HealthStatus = "good" | "watch" | "risk";

export interface Signal {
  id: string;
  label: string;
  detail: string;
  value: string;
  status: HealthStatus;
  /** Twelve readings, oldest first. The sparkline normalises them to its own range. */
  trend: number[];
  source: ReactNode;
  /** Spoken suffix so the logo alone never has to carry the meaning. */
  sourceLabel: string;
}

export interface PeriodAction {
  label: string;
  title: string;
  reason: string;
  /** Replaces the reason once the action has run. */
  doneLabel: string;
}

export interface Period {
  id: string;
  label: string;
  /** Long form used in the spoken trend line, such as "30 days". */
  spanLabel?: string;
  score: number;
  previousScore: number;
  signals: Signal[];
  summary?: string;
  action?: PeriodAction;
}

export interface Account {
  name: string;
  plan?: string;
  arr?: string;
  logo?: ReactNode;
  /** ISO dates. The term bar fills between them, so leave the start out to infer a year back from renewal. */
  termStart?: string;
  renewalDate: string;
}

type MarkProps = SVGProps<SVGSVGElement> & { title?: string };

export function LinearMark({ title = "Linear", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
    <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
  </svg>;
}

function PostHogMark({ title = "PostHog", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
    <path d="M9.854 14.5 5 9.647.854 5.5A.5.5 0 0 0 0 5.854V8.44a.5.5 0 0 0 .146.353L5 13.647l.147.146L9.854 18.5l.146.147v-.049c.065.03.134.049.207.049h2.586a.5.5 0 0 0 .353-.854L9.854 14.5zm0-5-4-4a.487.487 0 0 0-.409-.144.515.515 0 0 0-.356.21.493.493 0 0 0-.089.288V8.44a.5.5 0 0 0 .147.353l9 9a.5.5 0 0 0 .853-.354v-2.585a.5.5 0 0 0-.146-.354l-5-5zm1-4a.5.5 0 0 0-.854.354V8.44a.5.5 0 0 0 .147.353l4 4a.5.5 0 0 0 .853-.354V9.854a.5.5 0 0 0-.146-.354l-4-4zm12.647 11.515a3.863 3.863 0 0 1-2.232-1.1l-4.708-4.707a.5.5 0 0 0-.854.354v6.585a.5.5 0 0 0 .5.5H23.5a.5.5 0 0 0 .5-.5v-.6c0-.276-.225-.497-.499-.532zm-5.394.032a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zM.854 15.5a.5.5 0 0 0-.854.354v2.293a.5.5 0 0 0 .5.5h2.293c.222 0 .39-.135.462-.309a.493.493 0 0 0-.109-.545L.854 15.501zM5 14.647.854 10.5a.5.5 0 0 0-.854.353v2.586a.5.5 0 0 0 .146.353L4.854 18.5l.146.147h2.793a.5.5 0 0 0 .353-.854L5 14.647z" />
  </svg>;
}

function OktaMark({ title = "Okta", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
    <path d="M12 0C5.389 0 0 5.35 0 12s5.35 12 12 12 12-5.35 12-12S18.611 0 12 0zm0 18c-3.325 0-6-2.675-6-6s2.675-6 6-6 6 2.675 6 6-2.675 6-6 6z" />
  </svg>;
}

function ZendeskMark({ title = "Zendesk", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
    <path d="M12.914 2.904V16.29L24 2.905H12.914zM0 2.906C0 5.966 2.483 8.45 5.543 8.45s5.542-2.484 5.543-5.544H0zm11.086 4.807L0 21.096h11.086V7.713zm7.37 7.84c-3.063 0-5.542 2.48-5.542 5.543H24c0-3.06-2.48-5.543-5.543-5.543z" />
  </svg>;
}

function IntercomMark({ title = "Intercom", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
    <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.658 1.343 3 3 3h18c1.658 0 3-1.342 3-3V3c0-1.657-1.342-3-3-3zm-5.801 4.399c0-.44.36-.8.802-.8.44 0 .8.36.8.8v10.688c0 .442-.36.801-.8.801-.443 0-.802-.359-.802-.801V4.399zM11.2 3.994c0-.44.357-.799.8-.799s.8.359.8.799v11.602c0 .44-.357.8-.8.8s-.8-.36-.8-.8V3.994zm-4 .405c0-.44.359-.8.799-.8.443 0 .802.36.802.8v10.688c0 .442-.36.801-.802.801-.44 0-.799-.359-.799-.801V4.399zM3.199 6c0-.442.36-.8.802-.8.44 0 .799.358.799.8v7.195c0 .441-.359.8-.799.8-.443 0-.802-.36-.802-.8V6zM20.52 18.202c-.123.105-3.086 2.593-8.52 2.593-5.433 0-8.397-2.486-8.521-2.593-.335-.288-.375-.792-.086-1.128.285-.334.79-.375 1.125-.09.047.041 2.693 2.211 7.481 2.211 4.848 0 7.456-2.186 7.479-2.207.334-.289.839-.25 1.128.086.289.336.25.84-.086 1.128zm.281-5.007c0 .441-.36.8-.801.8-.441 0-.801-.36-.801-.8V6c0-.442.361-.8.801-.8.441 0 .801.357.801.8v7.195z" />
  </svg>;
}

function StripeMark({ title = "Stripe", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
  </svg>;
}

/** The mark in the summary header. Swap it through the `model` prop to label a different model. */
export function ClaudeMark({ title = "Claude", ...props }: MarkProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>;
}

export const demoAccount: Account = {
  name: "Linear",
  plan: "Enterprise",
  arr: "$184,000 ARR",
  logo: <LinearMark />,
  termStart: "2025-12-13",
  renewalDate: "2026-12-13",
};

/** Two ranges for the same account, so the periods control and the trend copy both have something to switch to. */
export const demoPeriods: Period[] = [
  {
    id: "30d",
    label: "30d",
    spanLabel: "30 days",
    score: 62,
    previousScore: 71,
    signals: [
      { id: "usage", label: "Product usage", detail: "Analytics down 18%", value: "61%", status: "risk", trend: [78, 77, 79, 76, 75, 74, 72, 70, 68, 66, 63, 61], source: <PostHogMark />, sourceLabel: "From PostHog" },
      { id: "seats", label: "Seat utilization", detail: "188 of 212 seats active", value: "89%", status: "good", trend: [84, 85, 85, 86, 87, 86, 88, 88, 89, 88, 89, 89], source: <OktaMark />, sourceLabel: "From Okta" },
      { id: "support", label: "Support tickets", detail: "3 P1 on CSV exports", value: "14 open", status: "risk", trend: [5, 6, 5, 7, 6, 8, 9, 8, 10, 11, 13, 14], source: <ZendeskMark />, sourceLabel: "From Zendesk" },
      { id: "nps", label: "NPS", detail: "Was +41 last quarter", value: "+32", status: "watch", trend: [44, 43, 41, 42, 40, 39, 38, 37, 36, 34, 33, 32], source: <IntercomMark />, sourceLabel: "From Intercom" },
      { id: "invoice", label: "Invoice status", detail: "Paid Oct 1, net 30", value: "Paid", status: "good", trend: [12, 11, 13, 12, 10, 11, 9, 10, 9, 8, 9, 8], source: <StripeMark />, sourceLabel: "From Stripe" },
    ],
    summary: "Analytics usage fell 18% after their data team moved weekly reporting to Looker, and 3 P1 tickets about CSV export timeouts are still open. Seats and billing are healthy, so this reads as a product gap, not a budget cut.",
    action: { label: "Schedule QBR", title: "Schedule a QBR with Linear", reason: "Usage dropped 18% in Analytics", doneLabel: "Invite drafted for Tue, Nov 3, 10:00" },
  },
  {
    id: "90d",
    label: "90d",
    spanLabel: "90 days",
    score: 62,
    previousScore: 76,
    signals: [
      { id: "usage", label: "Product usage", detail: "Analytics down 31% since July", value: "61%", status: "risk", trend: [84, 85, 83, 82, 80, 79, 77, 75, 72, 68, 64, 61], source: <PostHogMark />, sourceLabel: "From PostHog" },
      { id: "seats", label: "Seat utilization", detail: "Up from 171 seats in July", value: "89%", status: "good", trend: [78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89], source: <OktaMark />, sourceLabel: "From Okta" },
      { id: "support", label: "Support tickets", detail: "Tripled since July", value: "14 open", status: "risk", trend: [4, 4, 5, 4, 5, 6, 6, 7, 9, 10, 12, 14], source: <ZendeskMark />, sourceLabel: "From Zendesk" },
      { id: "nps", label: "NPS", detail: "Was +48 in July", value: "+32", status: "watch", trend: [48, 48, 47, 46, 45, 43, 42, 40, 38, 36, 34, 32], source: <IntercomMark />, sourceLabel: "From Intercom" },
      { id: "invoice", label: "Invoice status", detail: "3 of 3 paid on time", value: "Paid", status: "good", trend: [10, 11, 10, 9, 10, 9, 9, 8, 9, 8, 8, 8], source: <StripeMark />, sourceLabel: "From Stripe" },
    ],
    summary: "Health has slid for a full quarter. Analytics usage is down 31% since July while tickets tripled, mostly CSV export timeouts. Seat growth and on time payments show the budget is there, so fix exports before the December renewal.",
    action: { label: "Schedule QBR", title: "Schedule a QBR with Linear", reason: "Usage down 31% in Analytics since July", doneLabel: "Invite drafted for Tue, Nov 3, 10:00" },
  },
];

/** The model card above the summary. The mark defaults to the Claude glyph. */
export const demoModel = { name: "Claude Sonnet 5.5" };
