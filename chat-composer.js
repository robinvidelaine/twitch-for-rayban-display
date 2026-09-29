"use strict";
window.chatComposer = (() => {
  const panel = document.getElementById("chat-composer");
  const field = document.getElementById("chat-draft");
  const preview = document.getElementById("chat-preview");
  const notice = document.getElementById("composer-status");
  const cancel = document.getElementById("chat-cancel");
  const review = document.getElementById("chat-review");
  const edit = document.getElementById("chat-edit");
  const send = document.getElementById("chat-send");
  let target, sender, text = "", pending = false, version = 0;
  const controls = () => [field, preview, cancel, review, edit, send].filter(el => !el.hidden && !el.disabled);
  function valid() {
    if (!field.value.trim()) { notice.textContent = "Dictez ou saisissez un message."; return false; }
    if ([...field.value].length > 500) { notice.textContent = "500 caractères maximum. Modifiez le message, sans troncature automatique."; return false; }
    return true;
  }
  function close() {
    if (pending) return;
    version++; panel.hidden = true; field.value = ""; text = ""; preview.textContent = "";
    document.getElementById("micro-button").focus({ preventScroll: true });
    showControls();
  }
  function editing() {
    field.hidden = false; preview.hidden = true; review.hidden = false; edit.hidden = true; send.hidden = true;
    notice.textContent = "Activez le champ pour dicter. Puis vérifiez avant d’envoyer.";
    field.focus();
  }
  function confirm() {
    if (pending || !valid()) return;
    text = field.value; // Preserve the complete transcription, including punctuation.
    preview.textContent = text;
    field.hidden = true; preview.hidden = false; review.hidden = true; edit.hidden = false; send.hidden = false;
    notice.textContent = "Envoyer ce message avec votre compte Twitch ?";
    cancel.focus(); // A second deliberate activation is required to send.
  }
  field.addEventListener("input", () => { notice.textContent = `${[...field.value].length}/500 caractères · ponctuation conservée`; });
  field.addEventListener("change", () => {
    // Meta commits its finished string through input/change. On desktop, a
    // blur also triggers change: leave the explicit Vérifier button available.
    if (!panel.hidden && document.activeElement === field && field.value.trim()) confirm();
  });
  cancel.addEventListener("click", close);
  review.addEventListener("click", confirm);
  edit.addEventListener("click", editing);
  send.addEventListener("click", async () => {
    if (pending || send.hidden || !text || !auth.user() || auth.user().id !== sender || chat.channel !== target) return;
    pending = true;
    const requestVersion = version;
    controls().filter(el => el !== preview).forEach(el => { el.disabled = true; });
    notice.textContent = "Envoi en cours…";
    try {
      const response = await helix("chat/messages", {}, { method: "POST", body: JSON.stringify({ broadcaster_id: target, sender_id: sender, message: text }) });
      if (requestVersion !== version) return;
      const result = response.data?.[0];
      if (!result?.is_sent) throw new Error(result?.drop_reason?.message || "Twitch n’a pas envoyé le message.");
      // No optimistic chat row: EventSub is the source of the displayed message.
      notice.textContent = "Message envoyé. Il apparaîtra dans le chat via Twitch.";
      field.value = ""; text = ""; send.hidden = true; edit.hidden = true;
      cancel.textContent = "Fermer";
    } catch (error) {
      if (requestVersion !== version) return;
      notice.textContent = error instanceof TypeError || error.name === "TimeoutError"
        ? "Résultat de l’envoi inconnu. Vérifiez le chat avant de réessayer pour éviter un doublon."
        : error.message;
    } finally {
      if (requestVersion === version) {
        pending = false;
        [field, cancel, review, edit, send].forEach(el => { el.disabled = false; });
        cancel.focus();
      }
    }
  });
  auth.on(detail => {
    if (detail.user) return;
    version++; pending = false; panel.hidden = true; field.value = ""; text = ""; preview.textContent = "";
  });
  return {
    get active() { return !panel.hidden; },
    open() {
      if (!auth.user() || !chat.channel) return;
      version++; target = chat.channel; sender = auth.user().id; pending = false;
      clearTimeout(hideTimer);
      panel.hidden = false; cancel.textContent = "Annuler";
      [field, cancel, review, edit, send].forEach(el => { el.disabled = false; });
      field.value = ""; text = "";
      document.getElementById("composer-title").textContent = `Message à ${currentChannel}`;
      editing();
      field.click(); // User-initiated activation; no microphone API or synthetic keys.
    },
    handleKey(event) {
      if (panel.hidden) return false;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape", "Tab"].includes(event.key)) return true;
      if (event.isComposing) return true;
      if (document.activeElement === field && ["ArrowLeft", "ArrowRight"].includes(event.key)) return true;
      event.preventDefault(); event.stopPropagation();
      if (event.type === "keyup" || event.repeat || pending) return true;
      if (event.key === "Escape") { close(); return true; }
      const active = document.activeElement;
      if (active === preview && ["ArrowUp", "ArrowDown"].includes(event.key)) {
        const previous = preview.scrollTop;
        preview.scrollTop += event.key === "ArrowUp" ? -48 : 48;
        if (preview.scrollTop !== previous) return true;
      }
      if (event.key === "Enter") { active.click(); return true; }
      const list = controls();
      const delta = ["ArrowUp", "ArrowLeft"].includes(event.key) || (event.key === "Tab" && event.shiftKey) ? -1 : 1;
      const next = list[(list.indexOf(active) + delta + list.length) % list.length];
      next?.focus(); next?.scrollIntoView({ block: "nearest" });
      return true;
    }
  };
})();
