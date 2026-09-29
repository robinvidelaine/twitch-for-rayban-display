"use strict";
async function helix(path, params = {}, options = {}) {
  const url = new URL(`https://api.twitch.tv/helix/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach(item => url.searchParams.append(key, item));
    else if (value) url.searchParams.set(key, value);
  });
  const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(15000), headers: { "Client-Id": TWITCH_CLIENT_ID, Authorization: `Bearer ${await auth.token()}`, ...(options.body ? { "Content-Type": "application/json" } : {}) } });
  if (response.status === 401) { auth.logout(); throw new Error("Session expirée. Reconnectez-vous."); }
  if (response.status === 429) throw new Error("Limite Twitch atteinte. Patientez avant de réessayer.");
  if (!response.ok) throw new Error(`Twitch a refusé la demande (${response.status}).`);
  return response.status === 204 ? null : response.json();
}
const streamItem = s => ({ id: s.user_id, kind: "live", name: s.user_name, login: s.user_login, title: s.title, category: s.game_name, viewers: s.viewer_count, thumbnail: s.thumbnail_url?.replace("{width}", "320").replace("{height}", "180") });
const categoryItem = s => ({ id: s.id, name: s.name, kind: "category" });
const menuData = {
  async followed(after) {
    const r = await helix("streams/followed", { user_id: auth.user().id, first: 20, after });
    return { items: r.data.map(streamItem), cursor: r.pagination?.cursor };
  },
  async categories(after) {
    const r = await helix("games/top", { first: 20, after });
    return { items: r.data.map(categoryItem), cursor: r.pagination?.cursor };
  },
  async category(id, after) {
    const r = await helix("streams", { game_id: id, first: 20, after });
    return { items: r.data.map(streamItem), cursor: r.pagination?.cursor };
  },
  async search(query, type, after) {
    if (!query.trim()) return { items: [] };
    const r = await helix(type === "categories" ? "search/categories" : "search/channels", { query, first: 20, after });
    if (type === "categories") return { items: r.data.map(categoryItem), cursor: r.pagination?.cursor };
    // Search Channels supplies profile images, not live previews/viewer counts.
    // Resolve streams using the returned IDs to obtain actual 16:9 thumbnails.
    const ids = r.data.filter(s => s.is_live).map(s => s.id);
    const streams = ids.length ? (await helix("streams", { user_id: ids, first: 100 })).data : [];
    return { items: r.data.map(s => {
      const stream = streams.find(live => live.user_id === s.id);
      return stream ? streamItem(stream) : { id: s.id, kind: "live", name: s.display_name, login: s.broadcaster_login, title: s.title, category: s.game_name, offline: true };
    }), cursor: r.pagination?.cursor };
  }
};
