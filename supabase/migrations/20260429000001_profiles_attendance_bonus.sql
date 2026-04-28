-- supabase/migrations/20260429000001_profiles_attendance_bonus.sql
--
-- Atlas EIP — Phase 3c Step 1
-- Created: 2026-04-29
--
-- Adds attendance_bonus_monthly column to profiles for the Q5
-- 全勤獎金 (attendance bonus) deduction calculator.
--
-- LEGAL CONTEXT:
--   勞工請假規則 第9條: protected leave types (婚假/喪假/公傷病假/公假/產假/
--     陪產/產檢/家庭照顧事假) cannot trigger attendance bonus deduction
--   勞工請假規則 第9-1條 (effective 2026-01-01): first 10 days/year of
--     普通傷病假 are also protected from attendance bonus deduction
--   For other deductible leaves (事假, 病假 day 11+): proportional deduction
--     only — never zero out entirely. Per 勞動部 Q&A: deduction =
--     bonus × leave_days / 30
--
-- DESIGN NOTES:
--   - NUMERIC for monetary precision; NTD typically integer but allow
--     decimal in case of future fractional bonuses
--   - NOT NULL with DEFAULT 0 — most Taiwan SMBs starting out have no
--     attendance bonus; 0 is the truthful initial state
--   - Currency assumed TWD; if multi-currency is needed later, add a
--     separate column rather than overloading this one
--
-- Migration is idempotent: rerunning produces no errors.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS attendance_bonus_monthly NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.attendance_bonus_monthly IS
  'Monthly attendance bonus (全勤獎金) in NTD. Default 0 = no bonus configured. Used by Phase 3c attendance-bonus calculator. Per 勞工請假規則 第9條 + 第9-1條, deduction is proportional and protected leave types are exempt.';

-- Validation constraint: attendance bonus cannot be negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_attendance_bonus_monthly_non_negative'
      AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_attendance_bonus_monthly_non_negative
      CHECK (attendance_bonus_monthly >= 0);
  END IF;
END $$;

COMMIT;
