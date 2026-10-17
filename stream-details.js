"use strict";

// Local panel only: no reference to the Twitch player or its commands.
class StreamDetails {
  constructor(element, app) {
    this.element = element;
    this.app = app;
    this.version = 0;
    this.entry = null;
    this.timer = null;
    new MutationObserver(() => this.restart()).observe(app, { attributes: true, attributeFilter: ["hidden"] });
    document.addEventListener("visibilitychange", () => this.restart());
    auth.on(detail => {
      if (!detail.user) {
        this.entry = null;
        this.restart();
        this.element.replaceChildren();
      }
    });
  }
  active() {
    return this.entry && !this.element.hidden && !this.app.hidden && document.visibilityState !== "hidden" && auth.user();
  }
  watch(entry) {
    this.entry = { id: entry.id, name: entry.name, login: entry.login };
    this.element.scrollTop = 0;
    this.render(null, "Chargement des informations…");
    this.restart();
  }
  setVisible(visible) {
    this.element.hidden = !visible;
    this.restart();
  }
  restart() {
    clearTimeout(this.timer);
    const version = ++this.version;
    if (this.active()) this.refresh(version);
  }
  async refresh(version) {
    if (version !== this.version || !this.active()) return;
    try {
      const live = await menuData.live(this.entry.id);
      if (version !== this.version || !this.active()) return;
      this.render(live, live ? `Actualisé à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · mise à jour toutes les 60 s` : "Chaîne actuellement hors ligne.");
    } catch {
      if (version !== this.version || !this.active()) return;
      // Clear old counts rather than presenting stale values as current.
      this.render(null, "Informations indisponibles. Nouvelle tentative dans 60 s.");
    }
    if (version === this.version && this.active()) this.timer = setTimeout(() => this.refresh(version), 60000);
  }
  render(live, status) {
    const scroll = this.element.scrollTop;
    const nodes = [];
    const add = (tag, text, className = "") => {
      const node = document.createElement(tag);
      node.textContent = text;
      node.className = className;
      nodes.push(node);
    };
    add("h2", live?.name || this.entry?.name || this.entry?.login || "Informations du live");
    if (live) {
      add("p", live.title || "Titre non renseigné");
      add("p", live.category || "Catégorie non renseignée", "details-meta");
      add("p", Number.isFinite(live.viewers) ? `${live.viewers.toLocaleString("fr-FR")} spectateur${live.viewers === 1 ? "" : "s"} · En direct` : "Spectateurs indisponibles · En direct", "details-meta");
      const started = Date.parse(live.started);
      if (Number.isFinite(started)) {
        const minutes = Math.max(0, Math.floor((Date.now() - started) / 60000));
        add("p", `En direct depuis ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`, "details-meta");
      }
    }
    add("p", status, "details-status");
    this.element.replaceChildren(...nodes);
    this.element.scrollTop = scroll;
  }
}
