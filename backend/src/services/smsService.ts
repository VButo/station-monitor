import { supabase } from '../utils/supabaseClient';
/* createClient not needed here */
import axios from 'axios';

export async function smsRecieved(number: string, message: string) {
  try {
    number = number.replace('+', '');
    const station_id = await supabase.from('stations')
      .select('id')
      .eq('sms_number', number)
      .single();
      console.log("sms_number:", number, "station_id:", station_id, "message:", message, "data id", station_id.data?.id);
    const payload = {
      station_id: station_id.data?.id ?? null,
      user_id: null,
      number,
      message,
      status: 'INBOX', // INBOX
      time: new Date().toISOString(),
      unread: true,
      deleted: false,
      retry_number: 0,
    }
    const { data, error } = await supabase.from('sms_messages').insert(payload).select().single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error processing received SMS:', error);
    throw error;
  }
}

export type SmsRow = {
  id?: number;
  station_id?: number | null;
  user_id?: string | null;
  number: string;
  message: string;
  status?: number;
  time?: string;
  unread?: boolean;
  deleted?: boolean;
  retry_number?: number;
}

export async function insertOutgoingSms(row: SmsRow) {
  const payload = {
    station_id: row.station_id ?? null,
    user_id: row.user_id ?? null,
    number: row.number,
    message: row.message,
    // The database stores sms_status as an enum of string labels. Convert
    // numeric codes to their enum names when writing to avoid Postgres errors
    // (22P02 invalid input value for enum).
    status: (function convertStatus(s?: number | undefined) {
      const code = s ?? 2;
      // mapping: 1=INBOX, 2=OUTBOX, 3=SENT, 4=UNSENT
      switch (Number(code)) {
        case 1:
          return 'INBOX';
        case 3:
          return 'SENT';
        case 4:
          return 'UNSENT';
        case 2:
        default:
          return 'OUTBOX';
      }
    })(row.status),
    time: row.time ?? new Date().toISOString(),
    unread: row.unread ?? false,
    deleted: row.deleted ?? false,
    retry_number: row.retry_number ?? 0,
  }
  const { data, error } = await supabase.from('sms_messages').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateSmsStatus(id: number, status: number) {
  // Convert numeric status code to enum label before updating
  const statusLabel = ((): string => {
    switch (Number(status)) {
      case 1:
        return 'INBOX';
      case 3:
        return 'SENT';
      case 4:
        return 'UNSENT';
      case 2:
      default:
        return 'OUTBOX';
    }
  })();
  const { data, error } = await supabase.from('sms_messages').update({ status: statusLabel }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export type SendResult = {
  ok: boolean;
  url: string;
  status?: number;
  error?: string;
}

export async function sendSmsToDevice(number: string, message: string): Promise<SendResult> {
  const base = process.env.SEND_SMS || '';
  const username = encodeURIComponent(process.env.SMS_USERNAME || '');
  const password = encodeURIComponent(process.env.SMS_PASSWORD || '');
  const numberEnc = encodeURIComponent(number);
  const textEnc = encodeURIComponent(message);
  const url = `${base}username=${username}&password=${password}&number=${numberEnc}&text=${textEnc}`;

  try {
    const resp = await axios.get(url, { timeout: 5000 });
    return { ok: resp.status >= 200 && resp.status < 300, url, status: resp.status };
  } catch (err) {
    return { ok: false, url, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getMessagesForStation(stationId: number) {
  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('station_id', stationId)
    .order('time', { ascending: true })
  if (error) throw error;
  return data;
}