"use strict";
const TWITCH_CLIENT_ID = "5d7hasszi9ktxj3c7v1ldviql57adk";
const auth = (() => {
  const scopes = ["user:read:follows", "user:read:chat"];
  const storageKey = "twitch-session";
  let session, identity, refreshTask, generation = 0;
  const listeners = new Set();
  const emit = detail => listeners.forEach(fn => fn(detail));
  function save(data) {
    session = { access_token: data.access_token, refresh_token: data.refresh_token, expires: Date.now() + data.expires_in * 1000 };
    persist();
  }
  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(session));
      sessionStorage.removeItem(storageKey);
    } catch { throw new Error("Stockage persistant indisponible. Autorisez le stockage de ce site puis réessayez."); }
  }
  function load() {
    const saved = localStorage.getItem(storageKey);
    const legacy = saved ? null : sessionStorage.getItem(storageKey);
    let data;
    try { data = JSON.parse(saved || legacy || "null"); }
    catch { throw new Error("Session locale illisible. Déconnectez-vous pour la supprimer."); }
    if (!data?.access_token || !data?.refresh_token) return null;
    if (legacy) { localStorage.setItem(storageKey, JSON.stringify(data)); sessionStorage.removeItem(storageKey); }
    return data;
  }
  function clear() {
    generation++; session = null; identity = null;
    try { localStorage.removeItem(storageKey); sessionStorage.removeItem(storageKey); } catch {}
  }
  async function post(path, values) {
    const response = await fetch(`https://id.twitch.tv/oauth2/${path}`, { method: "POST", body: new URLSearchParams({ client_id: TWITCH_CLIENT_ID, ...values }), signal: AbortSignal.timeout(15000) });
    return { response, data: await response.json() };
  }
  async function refresh(rejectedAccess = null) {
    if (refreshTask) return refreshTask;
    const version = generation;
    const renew = async () => {
      if (version !== generation) throw new Error("Session terminée.");
      // A different tab may already have rotated the single-use refresh token.
      const saved = load();
      if (saved && saved.access_token !== session.access_token) session = saved;
      if (rejectedAccess ? session.access_token !== rejectedAccess : session.expires > Date.now() + 60000) return;
      const { response, data } = await post("token", { grant_type: "refresh_token", refresh_token: session.refresh_token });
      if (version !== generation) throw new Error("Session terminée.");
      if (!response.ok) {
        if ([400, 401, 403].includes(response.status)) {
          clear(); emit({ error: "Renouvellement refusé par Twitch. Reconnectez-vous." });
          throw new Error("Renouvellement refusé par Twitch.");
        }
        throw new Error("Twitch temporairement indisponible. Session conservée ; réessayez.");
      }
      save(data);
    };
    refreshTask = (globalThis.navigator?.locks
      ? navigator.locks.request("twitch-session-refresh", renew)
      : renew()).finally(() => { refreshTask = null; });
    return refreshTask;
  }
  async function token() {
    if (!session) throw new Error("Connexion Twitch nécessaire.");
    if (!Number.isFinite(session.expires) || session.expires < Date.now() + 60000) await refresh();
    return session.access_token;
  }
  async function recover(rejectedAccess) {
    if (!session) throw new Error("Connexion Twitch nécessaire.");
    // A Helix 401 is not a manual logout. Refresh once, preserving storage on
    // network/server errors; refresh() alone handles a refused refresh token.
    await refresh(rejectedAccess);
    return token();
  }
  async function validate() {
    const version = generation;
    if (!session) throw new Error("Connexion Twitch nécessaire.");
    const check = access => fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${access}` }, signal: AbortSignal.timeout(15000) });
    let r = await check(session.access_token);
    if (version !== generation) return;
    if (r.status === 401) {
      await refresh(session.access_token);
      if (version !== generation) return;
      r = await check(session.access_token);
    }
    if (version !== generation) return;
    if (!r.ok) throw new Error("Validation Twitch indisponible. Session conservée ; réessayez.");
    const data = await r.json();
    if (version !== generation) return;
    if (data.client_id !== TWITCH_CLIENT_ID || !data.user_id || !scopes.every(scope => data.scopes?.includes(scope))) {
      clear();
      throw new Error("Session invalide ou permissions manquantes. Reconnectez-vous.");
    }
    session.expires = Date.now() + data.expires_in * 1000;
    persist();
    identity = { id: data.user_id, name: data.login };
    return identity;
  }
  async function begin() {
    // A transient restore failure must never initiate a new device grant.
    if (session) return restore();
    clear(); const version = generation;
    emit({ pending: true, message: "Demande du code Twitch…" });
    try {
      const { response, data } = await post("device", { scopes: scopes.join(" ") });
      if (version !== generation) return;
      if (!response.ok) throw new Error(`Demande de code refusée par Twitch (${response.status}).`);
      let interval = Math.max(1, Number(data.interval) || 5) * 1000;
      const expires = Date.now() + data.expires_in * 1000;
      emit({ pending: true, code: data.user_code, message: "Ouvrez twitch.tv/activate sur votre téléphone ou PC et saisissez ce code." });
      while (version === generation && Date.now() < expires) {
        await new Promise(resolve => setTimeout(resolve, interval));
        if (version !== generation) return;
        if (Date.now() >= expires) break;
        let result;
        try { result = await post("token", { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: data.device_code, scopes: scopes.join(" ") }); }
        catch { emit({ pending: true, message: "Réseau indisponible. Nouvelle tentative au prochain intervalle." }); continue; }
        if (version !== generation) return;
        if (result.response.ok) {
          save(result.data); await validate();
          if (version === generation) emit({ user: identity });
          return;
        }
        const reason = result.data.message || result.data.error;
        if (reason === "authorization_pending") continue;
        if (reason === "slow_down" || result.response.status === 429) {
          interval = Math.max(interval + 5000, Number(result.response.headers.get("Retry-After") || 0) * 1000);
          emit({ pending: true, message: "Twitch demande de patienter davantage…" }); continue;
        }
        if (reason === "access_denied") throw new Error("Autorisation refusée. Vous pouvez réessayer.");
        if (["expired_token", "invalid device code"].includes(reason)) break;
        throw new Error(`Connexion refusée par Twitch (${result.response.status}). Réessayez.`);
      }
      if (version === generation) emit({ error: "Code expiré. Demandez un nouveau code." });
    } catch (error) { if (version === generation || !session) {
      emit({ retry: !!session, error: error instanceof TypeError ? "Erreur réseau. Session conservée si disponible ; réessayez." : error.message });
    } }
  }
  async function restore() {
    const version = generation;
    try {
      session = session || load();
      if (!session) { emit({ message: "Aucune session enregistrée sur ce navigateur. Connectez-vous à Twitch." }); return; }
      emit({ restoring: true, message: "Restauration de votre connexion Twitch…" });
      await validate();
      if (version === generation && identity) emit({ user: identity });
    } catch (error) {
      if (version === generation || !session) emit({ retry: !!session, error: error instanceof TypeError ? "Erreur réseau. Session conservée ; réessayez." : error.message });
    }
  }
  setInterval(() => { if (session) validate().catch(error => { if (!session) emit({ error: error.message }); }); }, 3600000);
  globalThis.addEventListener?.("online", () => { if (session && !identity) restore(); });
  globalThis.addEventListener?.("storage", event => {
    if (event.storageArea !== localStorage || event.key !== storageKey) return;
    if (!event.newValue) { generation++; session = null; identity = null; emit({}); }
    else { try { session = JSON.parse(event.newValue); } catch {} }
  });
  return { begin, restore, token, recover, user: () => identity, on: fn => listeners.add(fn), logout() { clear(); emit({}); } };
})();
