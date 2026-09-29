"use strict";
(() => {
  const screen = document.getElementById("login");
  const start = document.getElementById("connect");
  const cancel = document.getElementById("cancel-connect");
  const code = document.getElementById("device-code");
  const message = document.getElementById("login-status");
  start.addEventListener("click", () => auth.begin());
  cancel.addEventListener("click", () => auth.logout());
  document.getElementById("disconnect").addEventListener("click", () => auth.logout());
  auth.on(detail => {
    screen.hidden = !!detail.user;
    if (detail.user) { code.textContent = ""; return; }
    start.hidden = !!detail.pending;
    start.textContent = detail.retry ? "Réessayer la connexion" : "Se connecter à Twitch";
    cancel.hidden = !detail.pending;
    if (detail.code) code.textContent = detail.code;
    if (!detail.pending) code.textContent = "";
    message.textContent = detail.error || detail.message || "Connectez-vous pour retrouver vos lives suivis.";
    const activation = document.getElementById("activate");
    activation.hidden = !detail.pending;
    if (!screen.contains(document.activeElement) || document.activeElement.hidden) (detail.pending ? activation : start).focus();
  });
  function key(event) {
    if (event.defaultPrevented) return;
    if (screen.hidden || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(event.key)) return;
    event.preventDefault();
    if (event.type === "keyup" || event.repeat) return;
    if (event.key === "Escape") return auth.logout();
    if (event.key === "Enter") return document.activeElement.click();
    const controls = [...screen.querySelectorAll("button,a")].filter(el => !el.hidden);
    const delta = ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1;
    controls[(controls.indexOf(document.activeElement) + delta + controls.length) % controls.length].focus();
  }
  document.addEventListener("keydown", key);
  document.addEventListener("keyup", key);
  auth.restore();
})();
