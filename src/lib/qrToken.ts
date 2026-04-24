// src/lib/qrToken.ts
// Signs and verifies 60-second rotating QR tokens.

import jwt from 'jsonwebtoken';

const SECRET = process.env.CLOCK_QR_SECRET;

export const QR_TOKEN_TTL_SECONDS = 60;

export type QrTokenPayload = {
  org_id: string;
  location_label: string;
};

function assertSecret(): string {
  if (!SECRET || SECRET.length < 32) {
    throw new Error(
      '[qrToken] CLOCK_QR_SECRET missing or too short (need 32+ chars). Set it in Vercel env vars.',
    );
  }
  return SECRET;
}

export function signQrToken(payload: QrTokenPayload): string {
  return jwt.sign(payload, assertSecret(), { expiresIn: QR_TOKEN_TTL_SECONDS });
}

export function verifyQrToken(token: string): QrTokenPayload {
  const decoded = jwt.verify(token, assertSecret());
  if (typeof decoded !== 'object' || !decoded || !('org_id' in decoded) || !('location_label' in decoded)) {
    throw new Error('Invalid token payload shape');
  }
  return decoded as QrTokenPayload;
}

export function isExpiredError(e: unknown): boolean {
  return e instanceof Error && e.name === 'TokenExpiredError';
}