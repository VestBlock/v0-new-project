import type { Answers, GrantCard } from './match';

// export function grantLetterHtml(opts: {
//   user: Answers;
//   cards: GrantCard[];
//   dateISO?: string;
// }) {
//   const { user, cards, dateISO = new Date().toISOString().slice(0, 10) } = opts;
//   const biz = user.business_name || 'your business';

//   console.log('🚀 ~ grantLetterHtml ~ user:', user, cards);
//   return `
//   <div style="font-family:Arial, sans-serif;line-height:1.5;color:#fff;">
//     <div style="text-align:right;>${dateISO}</div>
//     <p >To the Grant Committee,</p>
//     <p >
//       I’m writing from <strong >${biz}</strong> in ${
//     user.state
//   } (${user.business_status.replace('_', ' ')}).
//       We operate in the <strong>${
//         user.industry
//       }</strong> industry with annual revenue in the ${user.revenue_range} range
//       ${user.has_ein ? 'and we have an EIN on file' : ''}.
//       ${
//         user.founder_attributes?.length
//           ? `We are ${user.founder_attributes.join(', ').replace(/-/g, ' ')}.`
//           : ''
//       }
//     </p>

//     <p>Based on your program criteria, we believe we are a strong fit. Here are
//     three programs we’re pursuing:</p>

//     <ol>
//       ${cards
//         .slice(0, 3)
//         .map(
//           (c) => `
//         <li>
//           <strong>${c.name}</strong> – ${c.description}
//           ${c.typical_award ? ` <em>(${c.typical_award})</em>` : ''}.
//           ${
//             c.why_fit
//               ? ` <span style="color:#555">Why we fit: ${c.why_fit}.</span>`
//               : ''
//           }
//         </li>`
//         )
//         .join('')}
//     </ol>

//     <p>
//       If awarded, funds will be used to grow ${biz}, including inventory,
//       marketing, and job creation in our community. We appreciate your consideration
//       and are happy to provide any additional documentation.
//     </p>

//     <p>Thank you,<br/>${biz}</p>
//   </div>`;
// }

const esc = (s?: string) =>
  (s ?? '').replace(
    /[&<>"']/g,
    (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        m
      ]!)
  );

export function grantLetterHtml({
  user,
  cards,
  dateISO = new Date().toISOString().slice(0, 10),
}: {
  user: Answers;
  cards: GrantCard[];
  dateISO?: string;
}) {
  const biz = user.business_name?.trim() || 'your business';

  const li = (c: GrantCard) => `
    <li>
      <b>${esc(c.name)}</b>
      ${c.typical_award ? ` — <em>${esc(c.typical_award)}</em>` : ''}.
      <span>${esc(c.description)}</span>
      ${
        c.why_fit
          ? ` <small class="muted">Why we fit: ${esc(c.why_fit)}.</small>`
          : ''
      }
    </li>`;

  return `
  <div style="color:#fff">
  <p>To the Grant Committee,</p>
  <p>
    I’m writing on behalf of <strong>${esc(biz)}</strong> in ${esc(user.state)}
    (${esc(user.business_status.replace('_', ' '))}) in the ${esc(
    user.industry
  )} industry, with annual revenue ${esc(user.revenue_range)}
    ${user.has_ein ? 'and an EIN on file' : ''}.
    ${
      user.founder_attributes?.length
        ? `We are ${esc(
            user.founder_attributes.join(', ').replace(/-/g, ' ')
          )}.`
        : ''
    }
  </p>
  <p>Programs we’re pursuing:</p>
  <ul>
    ${cards.slice(0, 3).map(li).join('')}
  </ul>
  <p>
    If awarded, funds will be used to grow ${esc(biz)} — including inventory,
    marketing, and job creation in our community. We appreciate your consideration
    and can provide any additional documentation.
  </p>
  <p>Thank you,<br/>${esc(biz)}</p>
  </div>`;
}
