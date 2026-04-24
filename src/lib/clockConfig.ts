// src/lib/clockConfig.ts
import { createClient } from '@/lib/supabase/server';

export type ClockConfig = {
  organization_id: string;
  work_start_time: string;
  work_end_time: string;
  late_grace_minutes: number;
  work_days: number[];
  lunch_break_minutes: number;
  ot_threshold_minutes: number;
  location_label: string | null;
  timezone: string;
};

export async function getClockConfig(orgId: string): Promise<ClockConfig> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organization_clock_config')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read clock config: ${error.message}`);
  }

  if (data) return data as ClockConfig;

  const { data: inserted, error: insertErr } = await supabase
    .from('organization_clock_config')
    .insert({ organization_id: orgId })
    .select('*')
    .single();

  if (insertErr || !inserted) {
    throw new Error(
      `Failed to create default clock config: ${insertErr?.message ?? 'unknown'}`,
    );
  }
  return inserted as ClockConfig;
}

export async function updateClockConfig(
  orgId: string,
  patch: Partial<Omit<ClockConfig, 'organization_id'>>,
): Promise<ClockConfig> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('organization_clock_config')
    .update(patch)
    .eq('organization_id', orgId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Failed to update clock config: ${error?.message ?? 'unknown'}`);
  }
  return data as ClockConfig;
}
