const PLANS = [
  {
    name: 'Starter',
    price: '$149',
    cadence: '/mo',
    blurb: 'For a single location just getting consistent.',
    features: ['3 posts / week', '1 platform', 'Text approval', 'Monthly recap'],
    highlight: false,
  },
  {
    name: 'Growth',
    price: '$349',
    cadence: '/mo',
    blurb: 'The sweet spot — more posts, more places, less work for you.',
    features: [
      '7 posts / week',
      'Up to 3 platforms',
      'Carousels & graphics',
      'Weekly performance tuning',
    ],
    highlight: true,
  },
  {
    name: 'Pro',
    price: '$699',
    cadence: '/mo',
    blurb: 'Full autopilot across every channel you care about.',
    features: [
      'Daily posting',
      'All platforms',
      'Priority drafts',
      'Auto-publish (once trusted)',
    ],
    highlight: false,
  },
] as const;

/**
 * Billing surface. Each "Choose" button starts a Stripe Checkout session
 * (wired server-side once STRIPE_SECRET_KEY is set). Until then it's a clear,
 * honest placeholder — the real subscription lives in Stripe.
 */
export default function BillingPage() {
  return (
    <main className="bg-warm-radial">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-20">
        <div className="flex flex-col gap-3 text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Simple plans, plain pricing.
          </h1>
          <p className="mx-auto max-w-md text-ink/60">
            Cancel anytime. Everything after checkout happens over text — no
            dashboard to learn.
          </p>
        </div>

        <ul className="grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <li
              key={plan.name}
              className={`flex flex-col rounded-4xl border p-7 shadow-soft transition ${
                plan.highlight
                  ? 'border-clay-300 bg-white ring-2 ring-clay-400'
                  : 'border-clay-100 bg-white/80'
              }`}
            >
              {plan.highlight && (
                <span className="mb-3 w-fit rounded-full bg-clay-500 px-3 py-0.5 text-xs font-medium text-white">
                  Most popular
                </span>
              )}
              <h2 className="font-display text-2xl font-medium">{plan.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold tracking-tight">
                  {plan.price}
                </span>
                <span className="text-sm text-ink/45">{plan.cadence}</span>
              </div>
              <p className="mt-3 text-sm text-ink/60">{plan.blurb}</p>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm text-ink/75">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-clay-100 text-[10px] text-clay-600"
                    >
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`mt-8 w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
                  plan.highlight
                    ? 'bg-clay-500 text-white hover:bg-clay-600'
                    : 'border border-ink/15 text-ink hover:border-ink/40'
                }`}
              >
                Choose {plan.name}
              </button>
            </li>
          ))}
        </ul>

        <p className="text-center text-xs text-ink/45">
          Payments are processed securely by Stripe. We never store your card
          details.
        </p>
      </div>
    </main>
  );
}
