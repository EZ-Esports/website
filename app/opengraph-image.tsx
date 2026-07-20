import { ImageResponse } from 'next/og';

export const alt = 'EZ Esports — NYC High School Esports League';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#09090b',
          backgroundImage:
            'radial-gradient(circle at 90% 10%, rgba(239, 68, 68, 0.15), transparent 50%), radial-gradient(circle at 10% 90%, rgba(255, 0, 127, 0.12), transparent 50%)',
          fontFamily: 'sans-serif',
          padding: '80px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Top/Left Accent Bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '8px',
            background: 'linear-gradient(to bottom, #ef4444, #ff007f)',
          }}
        />

        {/* Header Tag */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '18px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              color: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              padding: '6px 16px',
              borderRadius: '9999px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            NYC High School League
          </span>
        </div>

        {/* Main Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              fontSize: '96px',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            EZ
            <span
              style={{
                color: '#ef4444',
                marginLeft: '20px',
              }}
            >
              ESPORTS
            </span>
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 500,
              color: '#94a3b8',
              maxWidth: '800px',
              lineHeight: '1.4',
              marginTop: '16px',
            }}
          >
            Shaping the leaders of tomorrow through their passion for esports today.
          </div>
        </div>

        {/* Footer info */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '32px',
          }}
        >
          <div
            style={{
              display: 'flex',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>Games</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginTop: '4px' }}>VALORANT • LEAGUE OF LEGENDS • TEAMFIGHT TACTICS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '32px' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>Community</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0', marginTop: '4px' }}>Roles & Staff Portal</span>
            </div>
          </div>
          <div
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#ef4444',
            }}
          >
            ez-esports.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

