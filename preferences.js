"use strict";
// Only public channel references and UI preferences. OAuth has its own storage.
const localPreferences = (() => {
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  return {
    language: () => {
      const value = read("browse-language", "");
      return ["", "fr", "en", "es", "de", "pt", "it", "ja", "ko"].includes(value) ? value : "";
    },
    setLanguage: value => write("browse-language", value),
    recent: () => {
      const entries = read("recent-channels", []);
      return Array.isArray(entries) ? entries.filter(e => e && typeof e.id === "string" && typeof e.login === "string" && typeof e.name === "string").slice(0, 10) : [];
    },
    record(entry) {
      return write("recent-channels", [{ id: entry.id, login: entry.login, name: entry.name }, ...this.recent().filter(e => e.id !== entry.id)].slice(0, 10));
    }
  };
})();
