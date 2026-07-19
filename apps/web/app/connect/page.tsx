const PLATFORMS = [
  { name: 'Instagram', glyph: 'IG' },
  { name: 'Facebook', glyph: 'f' },
  { name: 'TikTok', glyph: '♪' },
  { name: 'X', glyph: '𝕏' },
  { name: 'LinkedIn', glyph: 'in' },
  { name: 'Threads', glyph: '@' },
  { name: 'YouTube', glyph: '▶' },
] as const;

/**
 * Account connect surface. OAuth to each platform is brokered by Post for Me —
 * owners connect *their* accounts to *our* app (§2). The buttons below are the
 * entry points; each kicks off a Post for Me connect flow (wired server-side).
 */
export default function ConnectPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-20">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Connect your accounts
        </h1>
        <p className="text-ink/60">
          Link the platforms you’d like us to post to. You can revoke access at
          any time, and we’ll only ever post what you approve.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {PLATFORMS.map((p) => (
          <li key={p.name}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl border border-clay-100 bg-white px-4 py-3.5 text-left text-sm font-medium shadow-soft transition hover:border-clay-300"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-clay-50 font-display text-clay-600">
                {p.glyph}
              </span>
              <span>Connect {p.name}</span>
              <span className="ml-auto text-ink/30">→</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border border-clay-100 bg-clay-50/50 px-5 py-4 text-xs leading-relaxed text-ink/55">
        Connections are handled securely through Post for Me. We never see your
        passwords, and access tokens are encrypted at rest.
      </div>
    </main>
  );
}
