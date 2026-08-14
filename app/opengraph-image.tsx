import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const alt =
  'VestBlock AI-guided next-move platform for Capital, Real Estate, Opportunity, and DealVault';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

const lanes = [
  ['01', 'Capital'],
  ['02', 'Real Estate'],
  ['03', 'Opportunity'],
  ['04', 'DealVault'],
];

const socialCardDescription =
  'Plan and coordinate practical next moves across capital, real estate, opportunity, and DealVault.';

export default async function OpenGraphImage() {
  const markBuffer = await readFile(
    join(process.cwd(), 'public', 'vestblock-mark-platform-ai-3d.png')
  );
  const markSrc = `data:image/png;base64,${markBuffer.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          height: '100%',
          width: '100%',
          display: 'flex',
          overflow: 'hidden',
          background: '#06090c',
          color: '#f1f3ed',
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
              'linear-gradient(112deg, rgba(215,248,11,0.08), transparent 32%), radial-gradient(circle at 88% 18%, rgba(182,176,109,0.10), transparent 28rem)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 76,
            width: 1,
            display: 'flex',
            background: 'rgba(241,243,237,0.12)',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            padding: '46px 58px 42px 100px',
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  color: '#f1f3ed',
                  fontSize: '42px',
                  fontWeight: 850,
                  letterSpacing: '-0.045em',
                }}
              >
                VestBlock
              </span>
              <span
                style={{
                  display: 'flex',
                  color: '#d7f80b',
                  fontSize: '14px',
                  fontWeight: 750,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                }}
              >
                Find your next move
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: '#d7f80b',
                fontSize: '17px',
                fontWeight: 800,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  width: '10px',
                  height: '10px',
                  background: '#d7f80b',
                }}
              />
              AI-guided platform
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: '48px',
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                maxWidth: '690px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '72px',
                  lineHeight: 0.94,
                  letterSpacing: '-0.055em',
                  fontWeight: 850,
                }}
              >
                Find your next move.
              </div>
              <div
                style={{
                  display: 'flex',
                  maxWidth: '670px',
                  fontSize: '28px',
                  lineHeight: 1.35,
                  color: '#d3d8d0',
                  fontWeight: 550,
                }}
              >
                {socialCardDescription}
              </div>
            </div>

            <img
              src={markSrc}
              alt=""
              width={275}
              height={275}
              style={{
                width: '275px',
                height: '275px',
                objectFit: 'contain',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              width: '100%',
              borderTop: '1px solid rgba(241,243,237,0.24)',
              borderBottom: '1px solid rgba(241,243,237,0.13)',
            }}
          >
            {lanes.map(([number, label], index) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  flex: 1,
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRight:
                    index < lanes.length - 1
                      ? '1px solid rgba(241,243,237,0.13)'
                      : 'none',
                }}
              >
                <span style={{ color: '#87909a', fontSize: '15px' }}>{number}</span>
                <span style={{ color: '#f1f3ed', fontSize: '20px', fontWeight: 750 }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
