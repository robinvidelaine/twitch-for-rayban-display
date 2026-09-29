"use strict";

// UI data contract: asynchronous lists, stable ids, no Twitch credentials.
// Replace this provider with Helix without changing the menu renderer.
const demoLives = [
  ["Atelier Pixel", "Une aventure à découvrir ensemble", "Jeux", 1240],
  ["Le Salon", "On discute de nos découvertes", "Just Chatting", 380],
  ["Arena Live", "La finale du tournoi — démo", "Esport", 8200],
  ["Partie Sauvegardée", "Exploration et défis du soir", "Jeux", 720],
  ["Pause Café", "Le rendez-vous de la communauté", "Just Chatting", 95],
  ["Dernière Manche", "Analyse et entraînement en équipe", "Esport", 2100],
  ["Nouveau Monde", "Premiers pas dans une nouvelle aventure", "Jeux", 460],
  ["Micro Ouvert", "Questions et idées du jour", "Just Chatting", 180]
].map(([name, title, category, viewers], i) => ({
  id: `demo-live-${i}`, kind: "live", name, title, category, viewers,
  // All fictional cards open the same real POC channel, never fictional logins.
  playbackTarget: "poc"
}));
const menuData = {
  async followed() { return demoLives; },
  async categories() {
    return ["Jeux", "Just Chatting", "Esport"].map(name => ({ id: name, name, kind: "category" }));
  },
  async category(name) { return demoLives.filter(live => live.category === name); },
  async search(query) {
    const needle = query.toLocaleLowerCase("fr");
    return demoLives.filter(live => `${live.name} ${live.title} ${live.category}`.toLocaleLowerCase("fr").includes(needle));
  }
};
