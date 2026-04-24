// src/app/clock/page.tsx
'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { tokens } from '@/lib/tokens';
import { clockCopy, t, tf, type Lang } from '@/lib/i18n/clock';

type PunchResponse =
  | {
      ok: true;
      action: 'clock_in';
      clockInTime: string;
      lateMinutes: number;
      incompletePriorDate: string | null;
    }
  | {
      ok: true;
      action: 'clock_out';
      clockOutTime: string;
      totalHours: number;
      overtimeHours: number;
      incompletePriorDate: string | null;
    }
  | { ok: false; code: keyof typeof clockCopy.errors; message: string; details?: unknown };

export default function ClockPageWrapper() {
  return (
    <Suspense
      fallback={
        <Screen>
          <p style={{ opacity: 0.6 }}>Loading…</p>
        </Screen>
      }
    >
      <ClockPage />
    </Suspense>
  );
}

function ClockPage() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const { isLoaded, isSignedIn, user } = useUser();

  // Language from profile
  const [lang, setLang] = useState<Lang>('zh');
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d.language === 'en' || d.language === 'zh') setLang(d.language);
      })
      .catch(() => {});
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PunchResponse | null>(null);
  const [errorCode, setErrorCode] = useState<keyof typeof clockCopy.errors | null>(null);

  const displayName = useMemo(() => {
    if (!user) return '';
    return user.fullName || user.firstName || user.primaryEmailAddress?.emailAddress || '';
  }, [user]);

  async function handlePunch() {
    if (!token) {
      setErrorCode('QR_INVALID');
      return;
    }
    setSubmitting(true);
    setErrorCode(null);
    try {
      const res = await fetch('/api/clock/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as PunchResponse;
      if (!res.ok || !data.ok) {
        const code = ('code' in data ? data.code : 'UNKNOWN') as keyof typeof clockCopy.errors;
        setErrorCode(code in clockCopy.errors ? code : 'UNKNOWN');
      } else {
        setResult(data);
      }
    } catch {
      setErrorCode('UNKNOWN');
    } finally {
      setSubmitting(false);
    }
  }

  // Loading spinner while Clerk initializes
  if (!isLoaded) {
    return (
      <Screen>
        <Spinner />
      </Screen>
    );
  }

  // Not signed in
  if (!isSignedIn) {
    const redirectUrl = typeof window !== 'undefined' ? window.location.href : '/clock';
    return (
      <Screen>
        <h1 style={{ fontSize: tokens.font.size['2xl'], marginBottom: tokens.spacing.md, fontWeight: 700 }}>
          {t(clockCopy.mobile.signin_required, lang)}
        </h1>
        <p style={{ opacity: 0.7, marginBottom: tokens.spacing['2xl'], maxWidth: 340, lineHeight: 1.5 }}>
          {t(clockCopy.mobile.signin_body, lang)}
        </p>
        <a href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`} style={primaryButton}>
          {t(clockCopy.mobile.signin_button, lang)}
        </a>
      </Screen>
    );
  }

  // Missing token — only show this AFTER Clerk is loaded (avoids flash)
  if (!token) {
    return (
      <Screen>
        <h1 style={{ fontSize: tokens.font.size.xl, marginBottom: tokens.spacing.md, fontWeight: 700 }}>
          {t(clockCopy.mobile.invalid_link, lang)}
        </h1>
        <p style={{ opacity: 0.7, maxWidth: 340, lineHeight: 1.5 }}>
          {t(clockCopy.mobile.invalid_body, lang)}
        </p>
      </Screen>
    );
  }

  // Success
  if (result && result.ok) {
    const isIn = result.action === 'clock_in';
    return (
      <Screen>
        <CheckIcon />
        <h1
          style={{
            fontSize: tokens.font.size['2xl'],
            marginTop: tokens.spacing['2xl'],
            marginBottom: tokens.spacing.md,
            fontWeight: 700,
          }}
        >
          {isIn ? t(clockCopy.mobile.success_in, lang) : t(clockCopy.mobile.success_out, lang)}
        </h1>
        <p style={{ opacity: 0.75, marginBottom: tokens.spacing['2xl'], maxWidth: 360, lineHeight: 1.6 }}>
          {isIn
            ? `${t(clockCopy.mobile.clock_in_at, lang)} ${formatTaipei(result.clockInTime)}${
                result.lateMinutes > 0
                  ? ` · ${t(clockCopy.mobile.late, lang)} ${result.lateMinutes} ${t(
                      clockCopy.mobile.minutes,
                      lang,
                    )}`
                  : ''
              }`
            : `${t(clockCopy.mobile.clock_out_at, lang)} ${formatTaipei(result.clockOutTime)} · ${t(
                clockCopy.mobile.total_hours,
                lang,
              )} ${result.totalHours} ${t(clockCopy.mobile.hours, lang)}${
                result.overtimeHours > 0
                  ? ` · ${t(clockCopy.mobile.overtime, lang)} ${result.overtimeHours} ${t(
                      clockCopy.mobile.hours,
                      lang,
                    )}`
                  : ''
              }`}
        </p>
        {result.incompletePriorDate && (
          <div style={warningBoxStyle}>
            {tf(clockCopy.mobile.incomplete_warning, lang, { date: result.incompletePriorDate })}
          </div>
        )}
      </Screen>
    );
  }

  // Default — punch button
  return (
    <Screen>
      <div style={{ fontSize: tokens.font.size.sm, opacity: 0.5, marginBottom: tokens.spacing.sm, letterSpacing: 1 }}>
        Atlas EIP
      </div>
      <h1
        style={{
          fontSize: tokens.font.size['2xl'],
          marginBottom: tokens.spacing.sm,
          fontWeight: 700,
        }}
      >
        {displayName}
      </h1>
      <p
        style={{
          opacity: 0.65,
          marginBottom: tokens.spacing['4xl'],
          fontSize: tokens.font.size.md,
        }}
      >
        {t(clockCopy.mobile.tap_to_punch, lang)}
      </p>

      <button
        onClick={handlePunch}
        disabled={submitting}
        style={{
          ...primaryButton,
          background: tokens.colors.success,
          width: '100%',
          maxWidth: 340,
          fontSize: tokens.font.size.xl,
          padding: '22px',
          fontWeight: 700,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.55 : 1,
          minHeight: 72,
        }}
      >
        {submitting ? t(clockCopy.mobile.processing, lang) : t(clockCopy.mobile.punch_button, lang)}
      </button>

      {errorCode && (
        <div
          style={{
            marginTop: tokens.spacing['2xl'],
            color: '#FCA5A5',
            fontSize: tokens.font.size.base,
            textAlign: 'center',
            maxWidth: 340,
            lineHeight: 1.5,
          }}
        >
          {t(clockCopy.errors[errorCode], lang)}
        </div>
      )}
    </Screen>
  );
}

/** Full-screen dark container for the mobile clock flow */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A', // slate-900 — softer than pure black on OLED
        color: tokens.colors.darkText,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacing['2xl'],
        fontFamily: tokens.font.family,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}

/** Animated loading spinner */
function Spinner() {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        border: `3px solid rgba(255,255,255,0.15)`,
        borderTopColor: tokens.colors.primary,
        borderRadius: '50%',
        animation: 'atlas-spin 0.8s linear infinite',
      }}
    >
      <style>{`@keyframes atlas-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/** Custom check icon — cleaner than the emoji */
function CheckIcon() {
  return (
    <div
      style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: tokens.colors.success,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(5,150,105,0.35)',
      }}
    >
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M5 13l4 4L19 7"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

const primaryButton: React.CSSProperties = {
  display: 'inline-block',
  background: tokens.colors.primary,
  color: tokens.colors.textInverse,
  padding: '14px 22px',
  borderRadius: tokens.radii.lg,
  fontWeight: 600,
  border: 'none',
  textDecoration: 'none',
};

const warningBoxStyle: React.CSSProperties = {
  marginTop: tokens.spacing.lg,
  padding: `${tokens.spacing.md}px ${tokens.spacing.lg}px`,
  background: 'rgba(217, 119, 6, 0.15)',
  border: `1px solid ${tokens.colors.warning}`,
  color: '#FDE68A',
  borderRadius: tokens.radii.md,
  fontSize: tokens.font.size.base,
  maxWidth: 340,
  lineHeight: 1.5,
};

function formatTaipei(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}