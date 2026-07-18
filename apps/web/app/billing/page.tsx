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
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pick a plan</h1>
        <p className="text-neutral-600">
          Cancel anytime. Everything after checkout happens over text — no
          dashboard to learn.
        </p>
      </div>

      <ul className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <li
            key={plan.name}
            className={`flex flex-col rounded-2xl border p-6 ${
              plan.highlight
                ? 'border-neutral-900 bg-white shadow-sm ring-1 ring-neutral-900'
                : 'border-neutral-200 bg-white'
            }`}
          >
            {plan.highlight && (
              <span className="mb-3 w-fit rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white">
                Most popular
              </span>
            )}
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
              <span className="text-sm text-neutral-500">{plan.cadence}</span>
            </div>
            <p className="mt-2 text-sm text-neutral-600">{plan.blurb}</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-neutral-700">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 text-neutral-900">
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium ${
                plan.highlight
                  ? 'bg-neutral-900 text-white hover:bg-neutral-700'
                  : 'border border-neutral-300 hover:border-neutral-500'
              }`}
            >
              Choose {plan.name}
            </button>
          </li>
        ))}
      </ul>

      <p className="text-xs text-neutral-500">
        Payments are processed securely by Stripe. We never store your card
        details.
      </p>
    </main>
  );
}
