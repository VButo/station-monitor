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
      status: 1, // INBOX
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
    status: row.status ?? 2, // OUTBOX by default
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
  const { data, error } = await supabase.from('sms_messages').update({ status }).eq('id', id).select().single();
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