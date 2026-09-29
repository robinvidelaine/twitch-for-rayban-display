"use strict";
// An explicit focus handoff only. No iframe inspection or playback commands.
window.playerInteraction = (() => {
  const panel = document.getElementById("player-help");
  const enter = document.getElementById("player-native");
  const close = document.getElementById("player-help-close");
  let native = false;
  let frame, previousTabIndex;
  function reset() {
    if (frame) frame.tabIndex = previousTabIndex;
    frame = null;
    native = false;
    panel.hidden = true;
  }
  auth.on(detail => { if (!detail.user) reset(); });
  function finish() {
    reset();
    showControls();
  }
  close.addEventListener("click", finish);
  enter.addEventListener("click", () => {
    const iframe = document.querySelector("#player iframe");
    if (!iframe) return;
    if (!frame) { frame = iframe; previousTabIndex = iframe.tabIndex; }
    iframe.tabIndex = 0;
    native = true;
    iframe.focus();
  });
  panel.addEventListener("focusin", () => {
    if (native) { native = false; close.focus(); }
  });
  return {
    get active() { return !panel.hidden; },
    open() {
      clearTimeout(hideTimer);
      panel.hidden = false;
      enter.focus();
    },
    handleKey(event) {
      if (panel.hidden) return false;
      // Cross-origin keys never reach this document. Leave Tab to the browser
      // so it can traverse Twitch's controls and reach our external return.
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(event.key)) return true;
      event.preventDefault(); event.stopPropagation();
      if (event.type === "keyup" || event.repeat) return true;
      if (event.key === "Escape") finish();
      else if (event.key === "Enter") {
        if (document.activeElement === enter) enter.click(); else finish();
      } else (document.activeElement === enter ? close : enter).focus();
      return true;
    }
  };
})();
