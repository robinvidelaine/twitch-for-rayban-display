"use strict";
const TWITCH_CLIENT_ID = "5d7hasszi9ktxj3c7v1ldviql57adk";
const auth = (() => {
  const scopes = ["user:read:follows", "user:read:chat"];
  let session, identity, refreshTask, generation = 0;
  const listeners = new Set();
  const emit = detail => listeners.forEach(fn => fn(detail));
  function save(data) {
    session = { access_token: data.access_token, refresh_token: data.refresh_token, expires: Date.now() + data.expires_in * 1000 };
    try { sessionStorage.setItem("twitch-session", JSON.stringify(session)); } catch { /* Memory-only session remains usable. */ }
  }
  function clear() {
    generation++; session = null; identity = null;
    try { sessionStorage.removeItem("twitch-session"); } catch {}
  }
  async function post(path, values) {
    const response = await fetch(`https://id.twitch.tv/oauth2/${path}`, { method: "POST", body: new URLSearchParams({ client_id: TWITCH_CLIENT_ID, ...values }), signal: AbortSignal.timeout(15000) });
    return { response, data: await response.json() };
  }
  async function refresh() {
    if (refreshTask) return refreshTask;
    const version = generation;
    refreshTask = (async () => {
      const { response, data } = await post("token", { grant_type: "refresh_token", refresh_token: session.refresh_token });
      if (version !== generation) throw new Error("Session terminée.");
      if (!response.ok) { clear(); emit({ error: "Session expirée. Reconnectez-vous." }); throw new Error("Session expirée."); }
      save(data);
    })().finally(() => { refreshTask = null; });
    return refreshTask;
  }
  async function token() {
    if (!session) throw new Error("Connexion Twitch nécessaire.");
    if (session.expires < Date.now() + 60000) await refresh();
    return session.access_token;
  }
  async function validate() {
    const access = await token();
    const r = await fetch("https://id.twitch.tv/oauth2/validate", { headers: { Authorization: `OAuth ${access}` }, signal: AbortSignal.timeout(15000) });
    const data = await r.json();
    if (!r.ok || data.client_id !== TWITCH_CLIENT_ID || !scopes.every(scope => data.scopes?.includes(scope))) {
      throw new Error("Session invalide ou permissions manquantes. Reconnectez-vous.");
    }
    identity = { id: data.user_id, name: data.login };
    return identity;
  }
  async function begin() {
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
    } catch (error) { if (version === generation) { clear(); emit({ error: error instanceof TypeError ? "Erreur réseau ou accès navigateur refusé. Réessayez." : error.message }); } }
  }
  async function restore() {
    try {
      session = JSON.parse(sessionStorage.getItem("twitch-session"));
      if (!session?.access_token || !session?.refresh_token) { clear(); emit({}); return; }
      await validate(); emit({ user: identity });
    } catch { clear(); emit({ error: "Session non restaurée. Reconnectez-vous." }); }
  }
  setInterval(() => { if (session) validate().catch(() => { clear(); emit({ error: "Session non validée. Reconnectez-vous." }); }); }, 3600000);
  return { begin, restore, token, user: () => identity, on: fn => listeners.add(fn), logout() { clear(); emit({}); } };
})();
