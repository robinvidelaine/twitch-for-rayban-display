"use strict";

let currentChannel = null;
const EMBED_PARENT = location.hostname; // No scheme, port or path; localhost HTTP supported.
const $ = (id) => document.getElementById(id);
const toolbar = [...$("toolbar").querySelectorAll("button")];
const chat = new ReadOnlyChat($("chat"));
let player;
let ready = false;
let selected = 2;

let hideTimer;
let commandTimer;
let playbackPending = false;
let playbackStarted = false;
let playbackState = "loading";
let autoplayAttempted = false;
let autoplayPhase = null;
let channelAutoplay = null;
let qualities = [];
const diagnosticLog = [];
const debug = new URLSearchParams(location.search).has("debug");
function trace(type, data = {}) {
  if (!debug) return;
  diagnosticLog.push({ time: Math.round(performance.now()), type, ...data });
  if (diagnosticLog.length > 200) diagnosticLog.shift();
}
window.pocDiagnostics = () => diagnosticLog.map((entry) => ({ ...entry }));
// Keep diagnostics and accessible detail without a separate status panel.
const status = (message) => { $("play").title = message; };

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideControls, 6000);
}
function focusAppControl() {
  if (window.chatComposer?.active) return;
  if (window.playerInteraction?.active) return;
  if ($("app").hidden) return;
  ($("controls").hidden ? $("app") : toolbar[selected]).focus({ preventScroll: true });
}
function showControls() {
  $("controls").hidden = false;
  $("app").classList.add("controls-open");
  focusAppControl();
  scheduleHide();
  trace("ui:show");
}
function hideControls() {

  clearTimeout(hideTimer);
  $("controls").hidden = true;
  $("app").classList.remove("controls-open");
  focusAppControl();
  trace("ui:hide");
}
function restoreAppFocus() {
  if (window.chatComposer?.active) return;
  if (window.playerInteraction?.active) return;
  const active = document.activeElement;
  if (document.visibilityState === "hidden") return;
  if (active?.tagName === "IFRAME" && $("app").contains(active)) {
    trace("focus:iframe", { title: active.title });
    // Focus the host document using standard DOM focus management. Do not try
    // to receive keys from, or inspect, the cross-origin iframe's document.
    focusAppControl();
    trace("focus:restored", { id: document.activeElement.id });
  }
}
window.addEventListener("blur", () => setTimeout(restoreAppFocus, 0));
document.addEventListener("focusin", (event) => {
  trace("focus", { id: event.target.id, tag: event.target.tagName });
  if (event.target.tagName === "IFRAME") setTimeout(restoreAppFocus, 0);
});
function finishPlaybackCommand() {
  playbackPending = false;
  clearTimeout(commandTimer);
}
function canPause() {
  // READY/isPaused alone can report false before the first PLAY event.
  return playbackStarted && !["blocked", "offline", "ended"].includes(playbackState) && !player.isPaused();
}
function sync() {
  if (!ready) return;
  try {
    $("play").textContent = canPause() ? "Pause" : "Lecture";
    $("play").setAttribute("aria-disabled", String(playbackPending));
    // Never infer muted from volume, a requested command or a local flag.
    const muted = player.getMuted();
    const volume = player.getVolume();
    const validAudio = typeof muted === "boolean" && Number.isFinite(volume);
    $("volume-button").textContent = validAudio ? (muted ? "🔇 Muet" : `🔊 ${Math.round(volume * 100)}%`) : "Son…";
    $("volume-button").setAttribute("aria-disabled", String(!validAudio));
    qualities = (player.getQualities() || []).map((q) => typeof q === "string" ? { group: q, name: q } : q).filter((q) => q && typeof q.group === "string");
    if (channelAutoplay?.online && player.getChannel() === channelAutoplay.channel && !$("app").hidden &&
        qualities.length && JSON.stringify(player.getPlaybackStats()) !== channelAutoplay.previousStats) {
      const previousAudio = channelAutoplay;
      channelAutoplay = null;
      if (Number.isFinite(previousAudio.volume)) player.setVolume(previousAudio.volume);
      if (typeof previousAudio.muted === "boolean") player.setMuted(previousAudio.muted);
      autoplayPhase = previousAudio.muted ? "muted" : "sound";
      requestPlayback("play", "channel-autoplay");
    }
    const current = player.getQuality();
    const name = qualities.find((q) => q.group === current)?.name || current;
    $("quality-button").textContent = `⚙ ${name ? (/^auto$/i.test(name) ? "Auto" : name.replace(/\s*\(source\)$/i, "")) : "Qualité…"}`;
    $("quality-button").setAttribute("aria-disabled", String(!qualities.length));
  } catch { status("État Twitch temporairement indisponible."); }
}
function requestPlayback(command, reason) {
  if (!ready || playbackPending) return;
  playbackPending = true;
  trace(`command:${command}`, { reason });
  commandTimer = setTimeout(() => {
    finishPlaybackCommand();
    sync();
    if (!playbackStarted && playbackState !== "offline") {
      status("Lecture non confirmée. Entrée sur Lecture pour réessayer.");
      showControls();
    }
  }, 5000);
  try {
    player[command]();
    $("play").setAttribute("aria-disabled", "true");
    setTimeout(restoreAppFocus, 0);
  } catch {
    finishPlaybackCommand();
    sync();
    status("Commande refusée par Twitch.");
  }
}
function togglePlayback() {
  channelAutoplay = null;
  autoplayPhase = null; // Never override an explicit user playback decision.
  if (ready) requestPlayback(canPause() ? "pause" : "play", "user");
}
function setVolume(value) {
  if (!ready) return;
  try {
    player.setVolume(Math.max(0, Math.min(1, value)));
    player.setMuted(false);
    trace("command:volume", { value });
    setTimeout(sync, 150);
  } catch { status("Volume indisponible."); }
}
function toggleMuted() {
  if (!ready) return;
  try {
    player.setMuted(!player.getMuted());
    trace("command:mute");
    setTimeout(sync, 150);
  } catch { status("Son indisponible."); }
}
function isAutoQuality(q) {
  return /^auto$/i.test(q.group) || /^auto$/i.test(q.name || "");
}
function qualityRank(q) {
  // Parse actual Twitch labels; no invented resolution or assumed array order.
  const match = ((q.name || "") + " " + q.group).match(/(\d+)p(?:(\d+(?:\.\d+)?))?/i);
  return match ? [Number(match[1]), Number(match[2] || 0)] : null;
}
function requestQuality(next) {
  try {
    player.setQuality(next.group);
    trace("command:quality", { quality: next.group });
    status(`Qualité demandée : ${next.name || next.group}`);
    setTimeout(sync, 200);
  } catch { status("Qualité refusée par Twitch."); }
}
function autoQuality() {
  if (!ready) return;
  sync();
  const auto = qualities.find(isAutoQuality);
  if (!auto) return status("Auto indisponible dans les qualités Twitch.");
  if (player.getQuality() !== auto.group) requestQuality(auto);
}
function changeQuality(direction) {
  if (!ready) return;
  sync();
  const ordered = qualities.filter(q => !isAutoQuality(q) && qualityRank(q))
    .sort((a, b) => {
      const x = qualityRank(a), y = qualityRank(b);
      return x[0] - y[0] || x[1] - y[1];
    });
  if (!ordered.length) return status("Qualités vidéo non classables pour le moment.");
  const current = player.getQuality();
  const index = ordered.findIndex(q => q.group === current);
  const automatic = qualities.some(q => q.group === current && isAutoQuality(q));
  if (index < 0 && !automatic) return status("Qualité actuelle non classable. Entrée pour Auto si disponible.");
  // Auto has no fixed resolution: Up selects highest, Down lowest.
  const next = index < 0 ? (direction > 0 ? ordered.at(-1) : ordered[0])
    : ordered[Math.max(0, Math.min(ordered.length - 1, index + direction))];
  if (next.group !== current) requestQuality(next);
}
function toggleChat() {
  if (!EMBED_PARENT || !["http:", "https:"].includes(location.protocol)) return;
  chat.setMode(chat.mode === "off" ? "compact" : "off");
  $("app").classList.toggle("chat-visible", chat.mode === "compact");
  $("chat-button").textContent = chat.mode === "off" ? "Chat OFF" : "Chat ON";
  $("chat-button").setAttribute("aria-pressed", String(chat.mode !== "off"));
  trace("chat:mode", { mode: chat.mode });
}
toolbar.forEach((button, index) => {
  button.addEventListener("focus", () => {
    selected = index;
  });
  button.addEventListener("click", () => {
    scheduleHide();
    if (button.id === "chat-button") toggleChat();
    if (button.id === "play") togglePlayback();
    if (button.id === "micro-button") window.chatComposer.open();
    if (button.id === "volume-button") toggleMuted();
    if (button.id === "quality-button") autoQuality();
  });
});
const keys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"]);
function handleKey(event) {
  if ($("app").hidden) return;
  if (window.chatComposer?.handleKey(event)) return;
  if (window.playerInteraction?.handleKey(event)) return;
  if (!keys.has(event.key)) return;

  event.preventDefault();
  event.stopPropagation();
  if (event.type === "keyup") return;
  trace("key", { key: event.key, repeat: event.repeat, focus: document.activeElement.id });
  if (event.repeat && ["Enter", "Escape"].includes(event.key)) return;
  if (event.key === "Escape") {
    window.returnToMenu();
    return;
  }
  if ($("controls").hidden) {
    if (event.key !== "Escape") showControls();
    return; // First interaction only wakes the bar.
  }
  scheduleHide();
  if (event.key === "Escape") {
    hideControls();
    return;
  }
  if (event.key === "Enter") {
    if (document.activeElement.matches("button")) document.activeElement.click();
    return;
  }
  if (["ArrowUp", "ArrowDown"].includes(event.key)) {
    if (event.key === "ArrowUp" && document.activeElement === $("menu-return")) {
      window.playerInteraction.open();
      return;
    }
    const direction = event.key === "ArrowUp" ? 1 : -1;
    if (document.activeElement === $("volume-button") && ready) {
      const volume = player.getVolume();
      if (Number.isFinite(volume)) setVolume(volume + direction * 0.1);
    } else if (document.activeElement === $("quality-button")) changeQuality(direction);
    return;
  }
  const direction = event.key === "ArrowRight" ? 1 : -1;
  selected = (selected + direction + toolbar.length) % toolbar.length;
  toolbar[selected].focus();
}
document.addEventListener("keydown", handleKey, true);
document.addEventListener("keyup", handleKey, true);
$("app").addEventListener("click", (event) => { if (event.target === $("app")) showControls(); });
chat.setMode("off");
let playerInitialized = false;
function openExistingPlayer(entry) {
  $("app").hidden = false;
  showControls();
  chat.watch(entry.id);
  const changed = currentChannel !== entry.login;
  currentChannel = entry.login;
  if (playerInitialized) {
    if (changed && ready) {
      channelAutoplay = {
        channel: currentChannel,
        muted: player.getMuted(),
        volume: player.getVolume(),
        previousStats: JSON.stringify(player.getPlaybackStats())
      };
      autoplayPhase = null;
      playbackStarted = false; playbackState = "loading";
      finishPlaybackCommand();
      trace("command:channel", { channel: currentChannel });
      player.setChannel(currentChannel);
    }
    return;
  }
  playerInitialized = true;
if (!EMBED_PARENT || !["http:", "https:"].includes(location.protocol)) {
  status("Ouvrez via HTTP localhost ou HTTPS, jamais file://.");
} else {
  const script = document.createElement("script");
  script.src = "https://player.twitch.tv/js/embed/v1.js";
  script.onerror = () => { status("Twitch inaccessible : vérifiez réseau et bloqueurs."); showControls(); };
  script.onload = () => {
    try {
      // READY owns exactly one automatic attempt; avoid a second SDK autoplay.
      player = new Twitch.Player("player", { channel: currentChannel, parent: [EMBED_PARENT], width: "100%", height: "100%", autoplay: false, muted: false });
      trace("player:created");
      const frame = $("player").querySelector("iframe");
      if (frame) {
        frame.title = "Lecteur Twitch";
        frame.tabIndex = -1;
        frame.removeAttribute("allowfullscreen");
        frame.setAttribute("allow", "autoplay; fullscreen 'none'");
        frame.addEventListener("load", () => { trace("player:iframe-load"); setTimeout(restoreAppFocus, 0); });
      }
      player.addEventListener(Twitch.Player.READY, () => {
        ready = true;
        if (player.getChannel() !== currentChannel) player.setChannel(currentChannel);
        trace("event:READY");
        sync();
        if (!autoplayAttempted) {
          autoplayAttempted = true;
          autoplayPhase = "sound";
          player.setMuted(false);
          status("Tentative de lecture automatique avec son…");
          requestPlayback("play", "autoplay-sound");
        }
        setTimeout(restoreAppFocus, 0);
      });
      for (const [event, message] of [["PLAY", "Démarrage…"], ["PLAYING", "Lecture en cours"], ["PAUSE", "En pause"], ["PLAYBACK_BLOCKED", "Lecture bloquée. Essayez Lecture ou les contrôles Twitch."], ["OFFLINE", "Chaîne hors ligne"], ["ONLINE", "Chaîne en ligne"], ["ENDED", "Diffusion terminée"]]) {
        player.addEventListener(Twitch.Player[event], () => {
          trace(`event:${event}`);
          if (event === "PLAY" || event === "PLAYING") playbackStarted = true;
          if (event !== "ONLINE") playbackState = event.toLowerCase().replace("playback_", "");
          if (["PLAYING", "PAUSE", "PLAYBACK_BLOCKED", "OFFLINE", "ENDED"].includes(event)) finishPlaybackCommand();
          // READY belongs to the Player instance, not each setChannel().
          // ONLINE can precede the new media state. sync waits for refreshed
          // official playback statistics instead of using a fixed delay.
          if (channelAutoplay && player.getChannel() === channelAutoplay.channel) {
            if (event === "ONLINE" && !$("app").hidden) {
              channelAutoplay.online = true;
            } else if (["PLAYING", "OFFLINE", "ENDED"].includes(event)) channelAutoplay = null;
          }
          if (event === "PLAYING") autoplayPhase = null;
          if (event === "PLAYBACK_BLOCKED" && autoplayPhase === "sound") {
            autoplayPhase = "muted";
            player.setMuted(true);
            status("Autoplay sonore bloqué : tentative muette…");
            requestPlayback("play", "autoplay-muted-fallback");
            sync();
            return;
          }
          if (event !== "ONLINE" || !playbackStarted) status(message);
          sync();
          setTimeout(restoreAppFocus, 0);
          if (event === "PLAYBACK_BLOCKED") showControls();
        });
      }
      // Official getters have no documented volume/quality change event.
      setInterval(sync, 250);
      setTimeout(() => { if (!ready) { status("Twitch ne répond pas : vérifiez réseau, parent et HTTPS."); showControls(); } }, 15000);
    } catch { status("Initialisation Twitch impossible."); showControls(); }
  };
  document.head.append(script);
}
}
