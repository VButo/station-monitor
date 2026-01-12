import axios from "axios";

// Types describing the station and return payload
type Station = {
  ip_datalogger_http?: string;
  ip?: string;
  ip_modem_http?: string;
  datalogger_http_port?: number | string;
};

type ReadStationTableSuccess = {
  ok: true;
  url: string;
  table: string;
  station_timestamp: string | null;
  keys: string[];
  vals: Array<number | string | null>;
  raw: unknown;
};

type ReadStationTableError = {
  ok: false;
  table: string;
  error: string;
};

export type ReadStationTableResult = ReadStationTableSuccess | ReadStationTableError;

// Types for returned key/value rows
type LiveKV = {
  station_id: number;
  table_name: number;
  key: string;
  value: string;
  station_timestamp: string | null;
};

type CacheEntry = {
  data: LiveKV[];
  expiresAt: number; // epoch ms
};

// Simple in-memory cache keyed by stationId when available; otherwise by host:port
const liveCache = new Map<string, CacheEntry>();

function makeCacheKey(stationId: number | undefined, station: Station): string {
  if (typeof stationId === 'number' && Number.isFinite(stationId)) {
    return `sid:${stationId}`;
  }
  const host = station.ip_datalogger_http || station.ip || station.ip_modem_http || '';
  const port = station.datalogger_http_port ?? '';
  return `host:${host}:${port}`;
}

// Optional helpers (keep simple; remove if you want raw values)
function sanitizeString(s: unknown): string {
  if (typeof s === "string") return s.replace(/\u0000/g, "");
  return String(s ?? "");
}

function normalizeJsonVal(v: unknown): number | string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") return v.toUpperCase() === "NAN" ? null : sanitizeString(v);
  // allow other JSON-compatible types (objects/arrays) as strings
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

/**
 * Read a datalogger table from a specific station and return the most recent row.
 */
export async function readStationTable(
  station: Station,
  tableName = "public",
  timeoutMs = 5000
): Promise<ReadStationTableResult> {
  // Resolve host/port
  const host: string | undefined =
    station.ip_datalogger_http ||
    station.ip ||
    station.ip_modem_http ||
    undefined;
  const port: string | number | undefined = station.datalogger_http_port ?? undefined;

  let urlHost: string | undefined;
  if (station.ip_datalogger_http) {
    urlHost = station.ip_datalogger_http;
  } else if (host && port !== undefined) {
    urlHost = `${host}:${port}`;
  } else {
    urlHost = host;
  }

  if (!urlHost) {
    return { ok: false, table: tableName, error: "No station host/port available" };
  }

  const url = `http://${urlHost}?command=dataquery&uri=dl:${tableName}&format=json&mode=most-recent&p1=1`;

  try {
    const client = axios.create({ timeout: timeoutMs });
    const response = await client.get(url);

    const row0 = response.data?.data?.[0];
    const fieldNames = response.data?.head?.fields as Array<{ name?: string }> | undefined;
    const fieldVals = Array.isArray(row0?.vals) ? (row0.vals as unknown[]) : [];

    const keys: string[] = [];
    const vals: Array<number | string | null> = [];
    if (Array.isArray(fieldNames)) {
      fieldNames.forEach((field, idx) => {
        keys.push(sanitizeString(field?.name ?? `f${idx}`));
        vals.push(normalizeJsonVal(fieldVals[idx]));
      });
    }

    const station_timestamp: string | null = row0?.time ? new Date(row0.time).toISOString() : null;

    return {
      ok: true,
      url,
      table: tableName,
      station_timestamp,
      keys,
      vals,
      raw: response.data,
    };
  } catch (err: unknown) {
    const error = err as { message?: string };
    return {
      ok: false,
      table: tableName,
      error: error?.message ?? String(err),
    };
  }
}

// Map datalogger read to frontend-friendly key/value array (Public table)
export async function getLiveData(station: Station, stationId?: number, ttlSeconds?: number) {
  const cacheKey = makeCacheKey(stationId, station);
  const now = Date.now();
  const cached = liveCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const result = await readStationTable(station, "public", 5000);
  if (!result.ok) {
    return { error: result.error };
  }
  const tableNameId = 1; // assume 1 maps to "public" table in frontend
  const out: LiveKV[] = [];
  const ts = result.station_timestamp ?? null;
  for (let i = 0; i < result.keys.length; i++) {
    const key = result.keys[i];
    const val = result.vals[i];
    out.push({
      station_id: Number.isFinite(stationId as number) ? (stationId as number) : 0,
      table_name: tableNameId,
      key,
      value: val === null || val === undefined ? '' : String(val),
      station_timestamp: ts,
    });
  }
  const ttlMs = Math.max(1000, Math.min(300000, (ttlSeconds ?? 10) * 1000)); // clamp 1s..5m, default 10s
  liveCache.set(cacheKey, { data: out, expiresAt: now + ttlMs });
  return out;
}