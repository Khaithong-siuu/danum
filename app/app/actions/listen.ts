"use server";

import { createClient } from "@/lib/supabase/server";
import { getTrack, searchTracks, type Track } from "@/lib/music";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function searchListenTracks(query: string): Promise<Track[]> {
  const { user } = await currentUser();
  if (!user) return [];

  return searchTracks(String(query ?? ""));
}

export async function startListening(
  conversationId: string,
  trackId: number
): Promise<boolean> {
  if (!UUID_REGEX.test(conversationId) || !Number.isInteger(trackId)) return false;

  const { supabase, user } = await currentUser();
  if (!user) return false;

  // The song is looked up again here, so its title and audio link always come
  // from Apple, never from the browser.
  const track = await getTrack(trackId);
  if (!track) return false;

  const { error } = await supabase.rpc("start_listening", {
    conv: conversationId,
    p_track_id: track.id,
    p_title: track.title,
    p_artist: track.artist,
    p_preview_url: track.previewUrl,
    p_artwork_url: track.artworkUrl,
  });

  return !error;
}

export async function setListeningPlayback(
  conversationId: string,
  playing: boolean,
  positionMs: number
): Promise<boolean> {
  if (!UUID_REGEX.test(conversationId)) return false;

  const { supabase, user } = await currentUser();
  if (!user) return false;

  const pos = Math.max(0, Math.min(3600000, Math.round(Number(positionMs) || 0)));

  const { error } = await supabase.rpc("set_listening_playback", {
    conv: conversationId,
    playing: !!playing,
    pos_ms: pos,
  });

  return !error;
}

export async function stopListening(conversationId: string): Promise<boolean> {
  if (!UUID_REGEX.test(conversationId)) return false;

  const { supabase, user } = await currentUser();
  if (!user) return false;

  const { error } = await supabase.rpc("stop_listening", { conv: conversationId });
  return !error;
}

/** The database's current time in milliseconds, or 0 if unavailable. */
export async function getServerTime(): Promise<number> {
  const { supabase, user } = await currentUser();
  if (!user) return 0;

  const { data } = await supabase.rpc("get_server_time");
  const ms = data ? new Date(data as string).getTime() : 0;

  return Number.isFinite(ms) ? ms : 0;
}