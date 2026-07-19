'use client';

import { useState } from 'react';

/** Pre-launch capture: the SMS-native ask — leave a number, get the first text. */
export function LeadForm({ source = 'website' }: { source?: string }) {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!api || phone.replace(/\D/g, '').length < 10) return setState('error');
    try {
      setState('busy');
      const res = await fetch(`${api}/leads`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, source }),
      });
      if (!res.ok) throw new Error();
      setState('done');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <p className="rounded-2xl bg-paper/10 px-5 py-4 text-center text-sm text-paper/90 backdrop-blur-sm">
        You're on the list ✳ The first text you get from us will be your welcome.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="tel"
        required
        value={phone}
        onChange={(e) => { setPhone(e.target.value); if (state === 'error') setState('idle'); }}
        placeholder="Your cell number"
        className="flex-1 rounded-full border border-paper/25 bg-paper/10 px-5 py-3.5 text-sm text-paper placeholder:text-paper/50 backdrop-blur-sm focus:border-clay-300 focus:outline-none"
      />
      <button type="submit" disabled={state === 'busy'} className="btn-clay justify-center disabled:opacity-60">
        {state === 'busy' ? 'Saving…' : 'Text me when it opens'}
      </button>
      {state === 'error' && (
        <p className="text-xs text-clay-300 sm:absolute sm:mt-14">That number didn't look right — try again?</p>
      )}
    </form>
  );
}
