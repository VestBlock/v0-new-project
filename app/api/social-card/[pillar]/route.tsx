import { ImageResponse } from 'next/og'
import { NextResponse } from 'next/server'

import {
  getVestBlockSocialVisual,
  isVestBlockSocialVisualKey,
} from '@/lib/social/visualCards'
import { VestBlockSocialMark } from '@/components/seo/vestblock-social-card'
import { absoluteUrl } from '@/lib/seo/site'

export const runtime = 'edge'
export const contentType = 'image/png'

export async function GET(_request: Request, context: { params: Promise<{ pillar: string }> }) {
  const { pillar } = await context.params
  if (!isVestBlockSocialVisualKey(pillar)) {
    return NextResponse.json({ error: 'Unknown social visual.' }, { status: 404 })
  }

  const visual = getVestBlockSocialVisual(pillar)
  return new ImageResponse(
    (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          color: '#F4F2EA',
          background: '#0B0D0C',
          fontFamily: 'sans-serif',
        }}
      >
        <img
          src={absoluteUrl('/hero/material-ledger/assistant.png')}
          alt=""
          width={1200}
          height={1500}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: '68% center',
            opacity: 0.52,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            background:
              'linear-gradient(90deg, rgba(11,13,12,0.99) 0%, rgba(11,13,12,0.94) 48%, rgba(11,13,12,0.48) 100%), radial-gradient(circle at 88% 12%, rgba(200,255,54,0.20), transparent 29%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 58,
            top: 58,
            display: 'flex',
            width: 238,
            height: 238,
            borderRadius: 999,
            border: '1px solid rgba(200,255,54,0.48)',
            boxShadow: '0 0 0 22px rgba(200,255,54,0.04)',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            width: '100%',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '68px 70px 64px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <VestBlockSocialMark size={62} />
              <div style={{ fontSize: 33, fontWeight: 800, letterSpacing: '-0.035em' }}>VestBlock</div>
            </div>
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                borderRadius: 999,
                border: '1px solid rgba(200,255,54,0.48)',
                background: 'rgba(200,255,54,0.08)',
                color: '#C8FF36',
                padding: '10px 16px',
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              {visual.eyebrow}
            </div>
          </div>

          <div style={{ display: 'flex', maxWidth: 790, flexDirection: 'column', gap: 30 }}>
            <div style={{ fontSize: 88, lineHeight: 0.93, letterSpacing: '-0.062em', fontWeight: 800 }}>
              {visual.headline}
            </div>
            <div style={{ maxWidth: 700, fontSize: 31, lineHeight: 1.25, color: '#C7C9C1' }}>
              {visual.supporting}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {['CAPITAL', 'DEALS', 'OPPORTUNITY'].map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.17)',
                    background: 'rgba(11,13,12,0.72)',
                    padding: '10px 13px',
                    color: '#F4F2EA',
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                borderRadius: 999,
                background: '#C8FF36',
                padding: '14px 20px',
                color: '#0B0D0C',
                fontSize: 19,
                fontWeight: 800,
              }}
            >
              {visual.routeLabel}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 1500 }
  )
}
