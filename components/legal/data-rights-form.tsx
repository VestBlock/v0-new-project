'use client';

import { useState } from 'react';

const requestTypes = [
  ['access', 'Access my data'],
  ['correction', 'Correct my data'],
  ['export', 'Export my data'],
  ['deletion', 'Delete my data'],
  ['restriction', 'Restrict processing'],
] as const;

export function DataRightsForm() {
  const [requestType, setRequestType] = useState<(typeof requestTypes)[number][0]>('access');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setMessage('');

    try {
      const response = await fetch('/api/privacy/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID(), requestType, details }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to submit this request.');
      setStatus('sent');
      setMessage(`Request ${result.requestId} was recorded. Keep this reference for follow-up.`);
      setDetails('');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unable to submit this request.');
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 border border-white/10 bg-white/[0.025] p-5 sm:p-7">
      <h2 className="!mt-0">Submit an authenticated request</h2>
      <p>Sign in first so VestBlock can verify the account connected to the request. Do not include passwords, payment credentials, or unrelated personal information.</p>
      <label className="mt-6 block text-sm font-semibold text-[#f3efe6]" htmlFor="request-type">Request type</label>
      <select
        id="request-type"
        value={requestType}
        onChange={(event) => setRequestType(event.target.value as typeof requestType)}
        className="mt-2 min-h-12 w-full rounded-md border border-white/15 bg-[#11130f] px-3 text-[#f3efe6]"
      >
        {requestTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className="mt-5 block text-sm font-semibold text-[#f3efe6]" htmlFor="request-details">Details (optional)</label>
      <textarea
        id="request-details"
        value={details}
        onChange={(event) => setDetails(event.target.value.slice(0, 1000))}
        rows={5}
        className="mt-2 w-full rounded-md border border-white/15 bg-[#11130f] p-3 text-[#f3efe6]"
        placeholder="Tell us what account data or correction you mean."
      />
      <button type="submit" disabled={status === 'sending'} className="vb-button vb-button-primary mt-5 disabled:cursor-not-allowed disabled:opacity-60">
        {status === 'sending' ? 'Recording request…' : 'Submit request'}
      </button>
      {message ? <p role="status" className={`mt-4 text-sm ${status === 'error' ? 'text-red-300' : 'text-[#b7ff3c]'}`}>{message}</p> : null}
    </form>
  );
}
