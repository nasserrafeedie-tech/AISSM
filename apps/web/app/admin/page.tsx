'use client';

import { useState } from 'react';

/** Operator-only view. Token lives in your head; nothing renders without it. */
export default function AdminPage() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const [token, setToken] = useState('');
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');

  async function load() {
    setErr('');
    try {
      const res = await fetch(`${api}/admin/overview`, { headers: { 'x-admin-token': token } });
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
    } catch {
      setErr('No dice — check the token.');
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 font-mono text-sm">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Operator view ✳</h1>
      {!data ? (
        <div className="mt-8 flex max-w-sm gap-3">
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="admin token"
            className="flex-1 rounded-xl border border-ink/15 bg-white px-4 py-2.5 focus:border-clay-500 focus:outline-none" />
          <button onClick={load} className="btn-primary !py-2.5">Open</button>
          {err && <p className="self-center text-clay-700">{err}</p>}
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          <div className="flex flex-wrap gap-6 text-[13px]">
            {Object.entries(data.counts).map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-ink/10 bg-white px-5 py-3 shadow-soft">
                <span className="block font-display text-2xl font-bold">{String(v)}</span>{k}
              </div>
            ))}
          </div>
          <Section title={`Leads (${data.leads.length})`}
            rows={data.leads.map((l: any) => [l.phone, l.email ?? '—', l.source, new Date(l.createdAt).toLocaleString()])}
            head={['phone', 'email', 'source', 'when']} />
          <Section title={`Customers (${data.customers.length})`}
            rows={data.customers.map((c: any) => [c.phone, c.businessName ?? '—', c.plan, c.status, c.trust, c.onboarded ? '✓' : '…', c.referralCode ?? '—'])}
            head={['phone', 'business', 'plan', 'status', 'trust', 'onboarded', 'ref code']} />
          <Section title="Recent posts"
            rows={data.recentPosts.map((p: any) => [p.platform, p.status, p.approvalState, (p.caption ?? '').slice(0, 50)])}
            head={['platform', 'status', 'approval', 'caption']} />
          <Section title={`Failed posts (${data.failedPosts.length})`}
            rows={data.failedPosts.map((p: any) => [p.id.slice(0, 8), (p.failureReason ?? '').slice(0, 70)])}
            head={['post', 'reason']} />
        </div>
      )}
    </main>
  );
}

function Section({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-medium">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white shadow-soft">
        <table className="w-full text-left text-[12px]">
          <thead><tr className="border-b border-ink/10 text-ink/50">
            {head.map((h) => <th key={h} className="px-4 py-2.5">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="px-4 py-3 text-ink/40" colSpan={head.length}>none yet</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-ink/5 last:border-0">
                {r.map((c, j) => <td key={j} className="px-4 py-2.5">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
