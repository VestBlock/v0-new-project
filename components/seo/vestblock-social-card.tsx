type VestBlockSocialCardProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
};

type VestBlockSocialMarkProps = {
  size?: number;
};

const GRAPHITE = '#0B0D0C';
const IVORY = '#F4F2EA';
const LIME = '#C8FF36';
const MUTED_IVORY = '#C7C9C1';

export function VestBlockSocialMark({ size = 72 }: VestBlockSocialMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 7h13.2L32 40.1 45.8 7H59L37.4 57H26.6L5 7Z" fill={IVORY} />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M38.4 7H46c8.5 0 13.2 4.3 13.2 11.3 0 4.9-2.5 8.4-7.2 10.3 5.3 1.8 8 5.6 8 11.1C60 50.1 52.9 57 41.6 57H31.2l4.5-10.1h6.6c5.4 0 8.1-2.2 8.1-6.4 0-4-2.8-6.1-8.3-6.1H37l4.4-10h3.7c3.2 0 4.9-1.4 4.9-4.2 0-2.8-1.9-4.2-5.6-4.2h-10L38.4 7Z"
        fill={LIME}
      />
    </svg>
  );
}

/**
 * Shared 1200 x 630 social preview artwork for Open Graph and X/Twitter.
 * Keep this component self-contained: next/og renders inline styles and SVG,
 * not the website stylesheet.
 */
export function VestBlockSocialCard({
  eyebrow = 'Funding · Real estate · Business growth',
  title = 'Find your next move.',
  description =
    'Understand your options, prepare what matters, and follow a focused roadmap in one coordinated place.',
}: VestBlockSocialCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: GRAPHITE,
        color: IVORY,
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 28,
          display: 'flex',
          border: '1px solid rgba(244,242,234,0.18)',
          borderRadius: 22,
        }}
      />

      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '62px 68px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: 730,
            height: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 17 }}>
            <VestBlockSocialMark size={58} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: 32, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.04em' }}>
                VestBlock
              </div>
              <div
                style={{
                  color: LIME,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                Capital + Deals + Opportunity
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                color: LIME,
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: '0.13em',
                textTransform: 'uppercase',
              }}
            >
              {eyebrow}
            </div>
            <div
              style={{
                maxWidth: 710,
                fontFamily: 'Georgia, Times New Roman, serif',
                fontSize: 79,
                fontWeight: 500,
                letterSpacing: '-0.052em',
                lineHeight: 0.94,
              }}
            >
              {title}
            </div>
            <div
              style={{
                maxWidth: 680,
                color: MUTED_IVORY,
                fontSize: 22,
                fontWeight: 500,
                lineHeight: 1.35,
              }}
            >
              {description}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: MUTED_IVORY,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.06em',
            }}
          >
            <span style={{ display: 'flex', width: 42, height: 2, background: LIME }} />
            vestblock.io
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              display: 'flex',
              width: 48,
              height: 48,
              borderTop: `2px solid ${LIME}`,
              borderRight: `2px solid ${LIME}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              display: 'flex',
              width: 48,
              height: 48,
              borderRight: '2px solid rgba(244,242,234,0.42)',
              borderBottom: '2px solid rgba(244,242,234,0.42)',
            }}
          />

          <svg
            aria-hidden="true"
            width="380"
            height="440"
            viewBox="0 0 380 440"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M18 64H114L222 220H348" fill="none" stroke={IVORY} strokeWidth="2" />
            <path d="M18 220H348" fill="none" stroke={LIME} strokeWidth="3" />
            <path d="M18 376H114L222 220" fill="none" stroke={IVORY} strokeWidth="2" />
            <circle cx="18" cy="64" r="8" fill={GRAPHITE} stroke={IVORY} strokeWidth="2" />
            <circle cx="18" cy="220" r="8" fill={LIME} />
            <circle cx="18" cy="376" r="8" fill={GRAPHITE} stroke={IVORY} strokeWidth="2" />
            <circle cx="222" cy="220" r="13" fill={GRAPHITE} stroke={LIME} strokeWidth="3" />
            <circle cx="348" cy="220" r="19" fill={LIME} />
          </svg>

          <div
            style={{
              position: 'absolute',
              top: 64,
              left: 0,
              display: 'flex',
              color: MUTED_IVORY,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
              transform: 'translateY(-30px)',
            }}
          >
            Funding
          </div>
          <div
            style={{
              position: 'absolute',
              top: 245,
              left: 0,
              display: 'flex',
              color: LIME,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
              transform: 'translateY(-30px)',
            }}
          >
            Real estate
          </div>
          <div
            style={{
              position: 'absolute',
              top: 376,
              left: 0,
              display: 'flex',
              color: MUTED_IVORY,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
              transform: 'translateY(-30px)',
            }}
          >
            Business growth
          </div>
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 220,
              display: 'flex',
              color: IVORY,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.13em',
              textTransform: 'uppercase',
            }}
          >
            Your next move
          </div>
        </div>
      </div>
    </div>
  );
}
