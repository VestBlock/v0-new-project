import { ImageResponse } from 'next/og';
import { absoluteUrl } from '@/lib/seo/site';

export const runtime = 'edge';
export const alt =
  'VestBlock - connect real estate opportunities with the right partners';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

const pillars = ['Sell', 'Buy', 'Fund', 'Build'];

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
          background: '#030712',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <img
          src={absoluteUrl('/vestblock-city-hero-poster.png')}
          alt=""
          width={1200}
          height={630}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.58,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            display: 'flex',
            background:
              'linear-gradient(90deg, rgba(3,7,18,0.96) 0%, rgba(3,7,18,0.78) 48%, rgba(3,7,18,0.45) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            display: 'flex',
            background:
              'radial-gradient(circle at 74% 22%, rgba(34,211,238,0.22), transparent 34%), radial-gradient(circle at 86% 72%, rgba(168,85,247,0.2), transparent 36%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            padding: '54px 64px 50px',
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
              <img
                src={absoluteUrl('/vestblock-mark.png')}
                alt=""
                width={74}
                height={74}
                style={{
                  borderRadius: '18px',
                  boxShadow: '0 0 38px rgba(34,211,238,0.4)',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                }}
              >
                <div style={{ fontSize: '35px', lineHeight: 1, fontWeight: 800 }}>
                  VestBlock
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: '#a5f3fc',
                    fontWeight: 700,
                  }}
                >
                  Real estate partner network
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '10px',
                padding: '11px 15px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(15,23,42,0.56)',
                color: '#e0f2fe',
                fontSize: '18px',
                fontWeight: 700,
              }}
            >
              <span>DealVault</span>
              <span style={{ color: '#67e8f9' }}>+</span>
              <span>Partner network</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              maxWidth: '890px',
            }}
          >
            <div
              style={{
                display: 'flex',
                padding: '11px 17px',
                borderRadius: '999px',
                border: '1px solid rgba(103,232,249,0.22)',
                background: 'rgba(255,255,255,0.07)',
                color: '#cffafe',
                fontSize: '19px',
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              Sell · Buy · Fund · Build
            </div>
            <div
              style={{
                fontSize: '70px',
                lineHeight: 0.96,
                letterSpacing: '-0.045em',
                fontWeight: 900,
              }}
            >
              Connect real estate opportunities with the right partners.
            </div>
            <div
              style={{
                maxWidth: '780px',
                fontSize: '27px',
                lineHeight: 1.28,
                color: '#dbeafe',
                fontWeight: 500,
              }}
            >
              Sellers, buyers, lenders, developers, contractors, operators, and
              capital partners connected through DealVault records and
              funding-ready next steps.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '13px', flexWrap: 'wrap' }}>
            {pillars.map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  padding: '12px 20px',
                  borderRadius: '999px',
                  background: 'rgba(15, 23, 42, 0.72)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: '#f8fafc',
                  fontSize: '22px',
                  fontWeight: 700,
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
