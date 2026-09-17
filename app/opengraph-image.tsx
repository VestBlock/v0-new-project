import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt =
  'VestBlock — capital, property, and business growth in one connected private ledger';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

const acquisitionStages = ['Source', 'Underwrite', 'Contact', 'Offer', 'Under contract'];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          height: '100%',
          width: '100%',
          display: 'flex',
          overflow: 'hidden',
          background: '#123128',
          color: '#f4f0e7',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            display: 'flex',
            background:
              'radial-gradient(circle at 88% 8%, rgba(168,135,82,0.28), transparent 28%), linear-gradient(115deg, #10130f 0%, #123128 62%, #1d4438 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 28,
            bottom: 28,
            left: 28,
            display: 'flex',
            border: '1px solid rgba(244,240,231,0.22)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 14,
            height: '100%',
            display: 'flex',
            background: '#a88752',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            padding: '60px 70px 54px 80px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              <div
                style={{
                  width: 70,
                  height: 70,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(16,19,15,0.28)',
                  background: '#a88752',
                  color: '#10130f',
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: '-0.08em',
                }}
              >
                VB
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ fontSize: 35, lineHeight: 1, fontWeight: 800 }}>VestBlock</div>
                <div
                  style={{
                    color: '#d4ba8d',
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  The private growth ledger
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                padding: '11px 16px',
                border: '1px solid rgba(212,186,141,0.5)',
                color: '#f4f0e7',
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              DealVault · auditable execution
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: 980 }}>
            <div
              style={{
                color: '#d4ba8d',
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Capital · Property · Business growth
            </div>
            <div
              style={{
                maxWidth: 990,
                fontFamily: 'serif',
                fontSize: 70,
                fontWeight: 500,
                letterSpacing: '-0.045em',
                lineHeight: 0.98,
              }}
            >
              Turn the right next move into a recorded outcome.
            </div>
            <div
              style={{
                maxWidth: 850,
                color: '#dcd7cd',
                fontSize: 24,
                fontWeight: 500,
                lineHeight: 1.35,
              }}
            >
              Find opportunities, prepare capital, connect the right parties, and preserve the work in one connected platform.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {acquisitionStages.map((stage, index) => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    color: '#f4f0e7',
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  <span
                    style={{
                      width: 23,
                      height: 23,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(212,186,141,0.65)',
                      color: '#d4ba8d',
                      fontSize: 11,
                    }}
                  >
                    {index + 1}
                  </span>
                  {stage}
                </div>
                {index < acquisitionStages.length - 1 ? (
                  <div
                    style={{
                      width: 40,
                      height: 1,
                      display: 'flex',
                      margin: '0 13px',
                      background: 'rgba(244,240,231,0.24)',
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
