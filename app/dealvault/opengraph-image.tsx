import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const alt =
  'DealVault by VestBlock — continuity and accountability for active work';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

const records = ['Agreement record', 'Milestone history', 'Payout reference'];

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
          padding: '54px 62px',
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
              'linear-gradient(118deg, rgba(215,248,11,0.075), transparent 34%), radial-gradient(circle at 88% 18%, rgba(182,176,109,0.10), transparent 27rem)',
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            borderTop: '1px solid rgba(241,243,237,0.22)',
            borderBottom: '1px solid rgba(241,243,237,0.15)',
            padding: '30px 0 26px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              <img
                src={markSrc}
                alt=""
                width={96}
                height={96}
                style={{ width: '96px', height: '96px', objectFit: 'contain' }}
              />
              <span style={{ color: '#f1f3ed', fontSize: '28px', fontWeight: 800 }}>
                DealVault
                <span style={{ marginLeft: '8px', color: '#d7f80b' }}>by VestBlock</span>
              </span>
            </div>
            <span style={{ color: '#d7f80b', fontSize: '18px', fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase' }}>
              Keep active work connected
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '940px' }}>
            <div style={{ display: 'flex', fontSize: '70px', lineHeight: 0.98, letterSpacing: '-0.05em', fontWeight: 850 }}>
              Keep the record that supports the work.
            </div>
            <div style={{ display: 'flex', maxWidth: '880px', color: '#d3d8d0', fontSize: '29px', lineHeight: 1.35 }}>
              DealVault keeps agreements, milestones, and payout references connected while sensitive material remains private.
            </div>
          </div>

          <div style={{ display: 'flex', width: '100%', borderTop: '1px solid rgba(241,243,237,0.18)' }}>
            {records.map((record, index) => (
              <div
                key={record}
                style={{
                  display: 'flex',
                  flex: 1,
                  alignItems: 'center',
                  gap: '14px',
                  padding: '18px 16px 0',
                  borderRight:
                    index < records.length - 1
                      ? '1px solid rgba(241,243,237,0.13)'
                      : 'none',
                }}
              >
                <span style={{ color: '#d7f80b', fontSize: '16px' }}>0{index + 1}</span>
                <span style={{ fontSize: '22px', fontWeight: 700 }}>{record}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}
