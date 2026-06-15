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
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1c1c1c',
          backgroundImage:
            'radial-gradient(circle at 50% 0%, rgba(244,204,204,0.18), transparent 60%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            letterSpacing: '-0.04em',
            color: '#ffffff',
            display: 'flex',
          }}
        >
          EZ <span style={{ color: '#f4cccc', marginLeft: 24 }}>ESPORTS</span>
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 40,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: '#cbd5e1',
          }}
        >
          NYC High School Esports League
        </div>
      </div>
    ),
    { ...size },
  );
}
