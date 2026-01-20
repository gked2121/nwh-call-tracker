import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'NWH Call Analysis - AI-Powered Sales Intelligence';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          padding: 60,
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #3b82f6 100%)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {/* Logo and title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div
              style={{
                width: 80,
                height: 80,
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                borderRadius: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 48,
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              N
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: 56,
                  fontWeight: 'bold',
                  color: 'white',
                  lineHeight: 1.1,
                }}
              >
                NWH Call Analysis
              </span>
              <span
                style={{
                  fontSize: 28,
                  color: '#94a3b8',
                  marginTop: 8,
                }}
              >
                AI-Powered Sales Intelligence
              </span>
            </div>
          </div>

          {/* Features */}
          <div
            style={{
              display: 'flex',
              gap: 32,
              marginTop: 60,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                padding: '16px 24px',
                borderRadius: 12,
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              <span style={{ fontSize: 24 }}>📊</span>
              <span style={{ color: '#93c5fd', fontSize: 20, fontWeight: 600 }}>Score Reps</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                padding: '16px 24px',
                borderRadius: 12,
                border: '1px solid rgba(249, 115, 22, 0.3)',
              }}
            >
              <span style={{ fontSize: 24 }}>🔥</span>
              <span style={{ color: '#fdba74', fontSize: 20, fontWeight: 600 }}>Find Hot Leads</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                padding: '16px 24px',
                borderRadius: 12,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <span style={{ fontSize: 24 }}>👥</span>
              <span style={{ color: '#6ee7b7', fontSize: 20, fontWeight: 600 }}>Rank Team</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                padding: '16px 24px',
                borderRadius: 12,
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              <span style={{ fontSize: 24 }}>🤖</span>
              <span style={{ color: '#c4b5fd', fontSize: 20, fontWeight: 600 }}>AI Coaching</span>
            </div>
          </div>
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(148, 163, 184, 0.2)',
            paddingTop: 32,
          }}
        >
          <span style={{ color: '#64748b', fontSize: 18 }}>
            Analyze CallRail exports • Score performance • Identify opportunities
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#94a3b8',
              fontSize: 16,
            }}
          >
            <span>Powered by</span>
            <span style={{ color: '#a78bfa', fontWeight: 600 }}>Claude Opus 4.5</span>
            <span>&</span>
            <span style={{ color: '#34d399', fontWeight: 600 }}>GPT-4.1</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
