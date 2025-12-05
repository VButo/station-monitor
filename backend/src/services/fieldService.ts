// backend/src/services/fieldService.ts
import {supabase} from '../utils/supabaseClient'; // adapt import path
import { logger } from '../utils/logger';
type FieldName = { id: number; name: string; /* other columns */ };

const TTL_MS = 5 * 60 * 1000; // 5 minutes, tune as needed

let cached: { ts: number; items: FieldName[] } | null = null;

export async function fetchFieldNamesFromDb() {
  try {
    const { data, error } = await supabase.from('field_names').select('*');
    if (error) {
      // Log the Supabase error for easier debugging
      logger.error('fetchFieldNamesFromDb - supabase error', { error });
      throw error;
    }
    return data ?? [];
  } catch (err) {
    // Provide contextual logging so callers can see where the failure occurred
    logger.error('fetchFieldNamesFromDb - unexpected error', { error: err });
    throw err;
  }
}

export async function getFieldNamesCached(): Promise<FieldName[]> {
  const now = Date.now();
  if (cached && (now - cached.ts) < TTL_MS) {
    return cached.items;
  }
  const items = await fetchFieldNamesFromDb();
  cached = { ts: now, items };
  return items;
}

export function invalidateFieldNamesCache(): void {
  cached = null;
}