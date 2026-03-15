import type { Roadmap, BizAnswers } from './match';

const esc = (s?: string) =>
  (s ?? '').replace(
    /[&<>"']/g,
    (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        m
      ]!)
  );

export function roadmapHtml({
  a,
  r,
  dateISO = new Date().toISOString().slice(0, 10),
}: {
  a: BizAnswers;
  r: Roadmap;
  dateISO?: string;
}) {
  const rev = a.monthly_revenue
    ? `$${a.monthly_revenue.toLocaleString()}/mo`
    : 'n/a';
  return `
  <div style="text-align:right" class="muted">${esc(dateISO)}</div>
  </br>
  <h1>Business Credit Roadmap</h1>
  </br>
  <p class="muted">Profile: EIN ${a.has_ein ? 'Yes' : 'No'} · Bank ${
    a.has_bank ? 'Yes' : 'No'
  } · Credit ${esc(a.credit_score_range)} · Revenue ${esc(rev)}</p>

  ${
    r.steps.prerequisites.length
      ? `
    <h2>Before you start</h2>
    <ul>${r.steps.prerequisites.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
      : ''
  }

  <h2>Step 1 · Starter vendors</h2>
  </br>
  <ul>${r.steps.vendors
    .map(
      (v) => `<li><b>${esc(v.name)}</b> — ${esc(v.notes || '')}
    <span class="chip">Vendor</span> <a style="color=#00FFFF" href="${esc(
      v.link
    )}">${esc(v.link)}</a></li>`
    )
    .join('')}</ul>

  <h2>Step 2 · Credit monitoring</h2>
  </br>
  <ul>${r.steps.monitoring
    .map(
      (m) => `<li><b>${esc(m.name)}</b> — ${esc(m.notes || '')}
    <span class="chip">Monitoring</span> <a style="color=#00FFFF" href="${esc(
      m.link
    )}">${esc(m.link)}</a></li>`
    )
    .join('')}</ul>

  <h2>Step 3 · Starter cards</h2>
  </br>
  <ul>${r.steps.cards
    .map(
      (c) => `<li><b>${esc(c.name)}</b> — ${esc(c.notes || '')}
    <span class="chip">Card</span> <a style="color=#00FFFF" href="${esc(
      c.link
    )}">${esc(c.link)}</a></li>`
    )
    .join('')}</ul>

  <h2>Step 4 · Lenders & resources</h2>
  </br>
  <ul>${r.steps.lenders
    .map(
      (l) => `<li><b>${esc(l.name)}</b> — ${esc(l.notes || '')}
    <span class="chip">Lender</span> <a style="color=#00FFFF" href="${esc(
      l.link
    )}">${esc(l.link)}</a></li>`
    )
    .join('')}</ul>
`;
}
