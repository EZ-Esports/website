import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const alt = 'EZ Esports | NYC High School Esports League';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  const logoBuffer = readFileSync(
    join(process.cwd(), 'public/images/logos/wordmark.png')
  );
  const logoSrc = `data:image/png;base64,${logoBuffer.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1c1c1c',
        }}
      >
        <img
          src={logoSrc}
          width={747}
          height={228}
          alt="EZ Esports"
        />
      </div>
    ),
    { ...size },
  );
}

