import { ImageResponse } from 'next/og'
import { NextResponse } from 'next/server'

import {
  getVestBlockSocialVisual,
  isVestBlockSocialVisualKey,
} from '@/lib/social/visualCards'
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
          color: '#f8fafc',
          background: '#050816',
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
              'linear-gradient(90deg, rgba(5,8,22,0.98) 0%, rgba(5,8,22,0.92) 45%, rgba(5,8,22,0.32) 100%), radial-gradient(circle at 88% 12%, rgba(71,203,177,0.28), transparent 29%), radial-gradient(circle at 21% 89%, rgba(107,114,255,0.18), transparent 34%)',
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
            border: '1px solid rgba(146, 255, 219, 0.42)',
            boxShadow: '0 0 0 22px rgba(146, 255, 219, 0.04), 0 0 100px rgba(71,203,177,0.23)',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            width: '100%',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '68px 70px 64px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <img src={absoluteUrl('/vestblock-mark-transparent.png')} alt="" width={62} height={62} />
              <div style={{ fontSize: 33, fontWeight: 800, letterSpacing: '-0.035em' }}>VestBlock</div>
            </div>
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                borderRadius: 999,
                border: '1px solid rgba(146,255,219,0.42)',
                background: 'rgba(146,255,219,0.09)',
                color: '#c8fff0',
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
            <div style={{ maxWidth: 700, fontSize: 31, lineHeight: 1.25, color: '#dce7ef' }}>
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
                    background: 'rgba(4,9,19,0.68)',
                    padding: '10px 13px',
                    color: '#dce7ef',
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
                background: '#a6f3dd',
                padding: '14px 20px',
                color: '#071018',
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
