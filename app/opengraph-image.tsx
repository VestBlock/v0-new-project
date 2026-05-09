import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'VestBlock - DealVault, Visibility Growth, and AI Receptionist tools';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #06131d 0%, #0b2431 45%, #12384a 100%)',
          color: '#f8fafc',
          padding: '56px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            border: '1px solid rgba(103, 232, 249, 0.2)',
            borderRadius: '28px',
            padding: '42px',
            background: 'rgba(9, 20, 27, 0.5)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '24px',
                fontWeight: 700,
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '999px',
                  background: '#22d3ee',
                  boxShadow: '0 0 32px rgba(34, 211, 238, 0.6)',
                }}
              />
              VestBlock
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
              Premium business tools
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px' }}>
            <div style={{ fontSize: '68px', lineHeight: 1.02, fontWeight: 800 }}>
              DealVault, visibility growth, and AI receptionist tools.
            </div>
            <div style={{ fontSize: '28px', lineHeight: 1.35, color: '#cbd5e1' }}>
              Cleaner records, stronger authority, and better lead capture for serious teams.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {['DealVault', 'Visibility Growth', 'AI Receptionist', 'Private demos'].map(
              (item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    padding: '12px 18px',
                    borderRadius: '999px',
                    border: '1px solid rgba(148, 163, 184, 0.24)',
                    color: '#e2e8f0',
                    fontSize: '20px',
                  }}
                >
                  {item}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    ),
    size
  );
}
