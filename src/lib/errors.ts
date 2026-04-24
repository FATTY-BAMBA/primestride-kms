// src/lib/errors.ts
// Structured error codes for consistent client/server error handling.
// Every API response includes a `code` field so the client can branch on it.

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'ADMIN_REQUIRED'
  | 'NOT_MEMBER'
  | 'QR_INVALID'
  | 'QR_EXPIRED'
  | 'RATE_LIMITED'
  | 'ALREADY_OUT'
  | 'INVALID_INPUT'
  | 'DB_ERROR'
  | 'UNKNOWN';

export class AtlasError extends Error {
  code: ErrorCode;
  httpStatus: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, httpStatus: number, details?: unknown) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }

  toResponse() {
    return {
      ok: false as const,
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export const atlasErrors = {
  unauthenticated: () => new AtlasError('UNAUTHENTICATED', 'Not signed in', 401),
  adminRequired: () => new AtlasError('ADMIN_REQUIRED', 'Admin role required', 403),
  notMember: () => new AtlasError('NOT_MEMBER', 'Not a member of this organization', 403),
  qrInvalid: (details?: unknown) => new AtlasError('QR_INVALID', 'Invalid QR token', 401, details),
  qrExpired: () => new AtlasError('QR_EXPIRED', 'QR token expired', 401),
  rateLimited: () => new AtlasError('RATE_LIMITED', 'Too many requests — wait a moment', 429),
  alreadyOut: (details?: unknown) => new AtlasError('ALREADY_OUT', 'Already clocked out for today', 409, details),
  invalidInput: (msg: string) => new AtlasError('INVALID_INPUT', msg, 400),
  dbError: (msg: string) => new AtlasError('DB_ERROR', msg, 500),
  unknown: (msg = 'Unknown error') => new AtlasError('UNKNOWN', msg, 500),
};
