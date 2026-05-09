import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'DealVault by VestBlock - blockchain-backed proof, payout, and milestone tracking';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

const cards = [
  'Proof records',
  'Payout ledger',
  'Milestone tracking',
  'Live on Polygon',
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #071018 0%, #10253a 52%, #1e3a5f 100%)',
          color: '#f8fafc',
          padding: '54px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRadius: '30px',
            border: '1px solid rgba(103, 232, 249, 0.22)',
            background: 'linear-gradient(180deg, rgba(6, 19, 29, 0.75), rgba(8, 18, 26, 0.92))',
            padding: '42px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#a5f3fc' }}>DealVault by VestBlock</div>
              <div style={{ fontSize: '18px', color: '#cbd5e1' }}>
                Proof and payout records for serious deal teams
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                padding: '10px 16px',
                borderRadius: '999px',
                background: 'rgba(34, 211, 238, 0.14)',
                color: '#a5f3fc',
                fontSize: '18px',
                fontWeight: 600,
              }}
            >
              Transparent event records
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px' }}>
            <div style={{ fontSize: '68px', lineHeight: 1.02, fontWeight: 800 }}>
              Real estate proof, payout, and milestone tracking.
            </div>
            <div style={{ fontSize: '28px', lineHeight: 1.35, color: '#dbeafe' }}>
              Private documents stay off-chain. Hashes, timestamps, and status records stay easy to audit.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {cards.map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  padding: '12px 18px',
                  borderRadius: '16px',
                  background: 'rgba(15, 23, 42, 0.66)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: '#f8fafc',
                  fontSize: '22px',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
