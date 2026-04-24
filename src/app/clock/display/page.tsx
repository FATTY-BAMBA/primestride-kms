// src/app/clock/display/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { tokens } from '@/lib/tokens';
import { clockCopy, t, type Lang } from '@/lib/i18n/clock';

type TokenResponse =
  | { ok: true; token: string; ttlSeconds: number; locationLabel: string }
  | { ok: false; code: string; message: string };

export default function ClockDisplayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [locationLabel, setLocationLabel] = useState('總公司');
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const lang: Lang = 'zh'; // tablet is always Chinese for Taiwan offices

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch('/api/clock/qr-token', { cache: 'no-store' });
        const data = (await res.json()) as TokenResponse;
        if (!data.ok) {
          setError(data.message);
          return;
        }
        setLocationLabel(data.locationLabel);

        const origin = window.location.origin;
        const url = `${origin}/clock?token=${encodeURIComponent(data.token)}`;

        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, url, {
            width: 420,
            margin: 2,
            errorCorrectionLevel: 'M',
          });
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'unknown error');
      }
    }
    refresh();
    const id = setInterval(refresh, 45_000);
    return () => clearInterval(id);
  }, []);

  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const dateStr = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(now);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.darkBg,
        color: tokens.colors.darkText,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing['3xl'],
        fontFamily: tokens.font.family,
      }}
    >
      <div style={{ fontSize: tokens.font.size['2xl'], opacity: 0.85, marginBottom: tokens.spacing.sm }}>
        {locationLabel}
      </div>
      <div style={{ fontSize: tokens.font.size.lg, opacity: 0.6, marginBottom: tokens.spacing['2xl'] }}>
        {dateStr}
      </div>
      <div
        style={{
          fontSize: tokens.font.size.display,
          fontWeight: tokens.font.weight.bold,
          letterSpacing: -2,
          marginBottom: tokens.spacing['3xl'],
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {timeStr}
      </div>
      <div
        style={{
          background: tokens.colors.surface,
          padding: tokens.spacing.xl,
          borderRadius: tokens.radii.xl,
          boxShadow: tokens.shadow.display,
        }}
      >
        <canvas ref={canvasRef} />
      </div>
      <div style={{ marginTop: tokens.spacing['3xl'], fontSize: tokens.font.size.xl, opacity: 0.75 }}>
        📱 {t(clockCopy.display.subtitle, lang)}
      </div>
      <div style={{ marginTop: tokens.spacing.xs, fontSize: tokens.font.size.base, opacity: 0.5 }}>
        {t(clockCopy.display.auto_refresh, lang)}
      </div>
      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: tokens.spacing.lg,
            left: tokens.spacing.lg,
            right: tokens.spacing.lg,
            background: tokens.colors.danger,
            padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
            borderRadius: tokens.radii.md,
            fontSize: tokens.font.size.base,
          }}
        >
          {t(clockCopy.display.error, lang)}: {error}
        </div>
      )}
    </div>
  );
}