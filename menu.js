"use strict";

(() => {
  const menu = document.getElementById("menu");
  const results = document.getElementById("menu-results");
  const context = document.getElementById("menu-context");
  const names = ["Suivis", "Parcourir", "Recherche"];
  const states = names.map(() => ({ category: null, query: "", focusId: null, scroll: 0, data: [], cursor: null, type: "channels" }));
  let tab = 0, generation = 0;
  let returnFocus;
  const tabs = names.map((name, index) => {
    const button = document.createElement("button");
    button.textContent = name;
    button.addEventListener("click", () => selectTab(index));
    document.getElementById("menu-tabs").append(button);
    return button;
  });
  const state = () => states[tab];
  const items = () => [...results.querySelectorAll("button, input")];
  function remember() {
    state().scroll = results.scrollTop;
    if (results.contains(document.activeElement)) state().focusId = document.activeElement.dataset.id;
  }
  function focusItem(element) {
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest" });
  }
  function button(text, id, action) {
    const element = document.createElement("button");
    element.textContent = text;
    element.dataset.id = id;
    element.addEventListener("click", action);
    results.append(element);
    return element;
  }
  async function render(restore = false, more = false) {
    if (!auth.user()) return;
    const version = ++generation;
    const current = state();
    const savedScroll = more ? results.scrollTop : current.scroll;
    context.textContent = "Chargement Twitch…";
    tabs.forEach((element, i) => element.setAttribute("aria-current", i === tab ? "page" : "false"));
    let page;
    try {
      const cursor = more ? current.cursor : null;
      page = current.category ? await menuData.category(current.category.id, cursor)
        : tab === 0 ? await menuData.followed(cursor)
        : tab === 1 ? await menuData.categories(cursor)
        : await menuData.search(current.query, current.type, cursor);
    } catch (error) {
      if (version !== generation) return;
      context.textContent = error instanceof TypeError ? "Réseau indisponible. Réessayez." : error.message;
      results.replaceChildren();
      button("Réessayer", "retry", () => render(true));
      if (current.category) button("← Retour", "back", back);
      return;
    }
    if (version !== generation || !auth.user()) return;
    const previousLength = more ? current.data.length : 0;
    current.data = more ? [...current.data, ...page.items.filter(x => !current.data.some(y => y.id === x.id))] : page.items;
    current.cursor = page.cursor;
    const data = current.data;
    results.replaceChildren();
    context.textContent = current.category ? current.category.name : "Données Twitch";
    if (current.category) button("← Catégories", "back", back);
    if (tab === 2 && !current.category) {
      const label = document.createElement("label");
      label.textContent = "Recherche Twitch — saisie clavier PC";
      const input = document.createElement("input");
      input.type = "search"; input.value = current.query; input.dataset.id = "query";
      input.placeholder = "Nom de chaîne ou catégorie";
      label.append(input); results.append(label);
      input.addEventListener("input", () => { current.query = input.value; });
      button(current.type === "channels" ? "Type : chaînes" : "Type : catégories", "type", () => { current.type = current.type === "channels" ? "categories" : "channels"; current.focusId = "type"; render(true); });
      button("Rechercher", "search", () => render(true));
    }
    data.forEach(entry => {
      const card = button("", entry.id, () => {
        if (entry.kind === "category") {
          remember();
          current.parent = { focusId: entry.id, scroll: results.scrollTop };
          current.category = { id: entry.id, name: entry.name }; current.focusId = "back"; current.scroll = 0;
          render(true);
        } else {
          remember(); returnFocus = card;
          menu.hidden = true;
          openExistingPlayer(entry);
        }
      });
      card.className = "menu-card";
      if (entry.kind === "live") {
        const preview = document.createElement("div"); preview.className = "stream-preview";
        const unavailable = document.createElement("span"); unavailable.textContent = entry.offline ? "Hors ligne" : "Aperçu indisponible";
        preview.append(unavailable);
        if (entry.thumbnail) {
          const image = document.createElement("img"); image.src = entry.thumbnail; image.alt = "";
          image.loading = "lazy"; image.decoding = "async";
          image.addEventListener("load", () => { unavailable.hidden = true; }, { once: true });
          image.addEventListener("error", () => { image.remove(); unavailable.hidden = false; }, { once: true });
          preview.append(image);
        }
        card.append(preview);
      } else card.classList.add("category-card");
      const info = document.createElement("div"); info.className = "stream-info"; card.append(info);
      const name = document.createElement("strong"); name.textContent = entry.name; info.append(name);
      const detail = document.createElement("span");
      detail.textContent = entry.kind === "category" ? "Voir les streams →" : entry.title;
      info.append(detail);
      if (entry.kind === "live") {
        const meta = document.createElement("small");
        meta.textContent = `${entry.category || ""} · ${entry.offline ? "Hors ligne" : entry.viewers === undefined ? "En direct" : entry.viewers.toLocaleString("fr") + " spectateurs"}`;
        info.append(meta);
      }
    });
    if (!data.length) {
      const empty = document.createElement("p"); empty.textContent = "Aucun résultat Twitch. Aucun live suivi ou résultat pour cette sélection."; results.append(empty);
    }
    if (current.cursor) button("Charger la suite", "more", () => render(true, true));
    if (more) current.focusId = data[previousLength]?.id || "more";
    if (restore && !menu.hidden) {
      const target = items().find(item => item.dataset.id === current.focusId) || tabs[tab];
      target.focus({ preventScroll: true });
    }
    results.scrollTop = savedScroll;
    if (more) document.activeElement.scrollIntoView({ block: "nearest" });
  }
  function selectTab(index) {
    remember(); tab = index; tabs[tab].focus(); render();
  }
  function back() {
    if (state().category) {
      Object.assign(state(), state().parent, { category: null }); render(true);
    } else tabs[tab].focus();
  }
  window.returnToMenu = () => {
    // Preserve the player and its source; do not issue playback/audio commands.
    clearTimeout(hideTimer);
    document.getElementById("app").hidden = true;
    const scroll = state().scroll;
    menu.hidden = false;
    (returnFocus?.isConnected ? returnFocus : tabs[tab]).focus({ preventScroll: true });
    results.scrollTop = scroll;
    state().scroll = scroll;
  };
  document.getElementById("menu-return").addEventListener("click", window.returnToMenu);
  menu.addEventListener("focusin", () => remember());
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("keyup", onKey, true);
  function onKey(event) {
    if (event.defaultPrevented) return; // A player key may just have returned here.
    if (menu.hidden || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Escape"].includes(event.key)) return;
    const active = document.activeElement;
    if (active.tagName === "INPUT" && ["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.type === "keyup" || (event.repeat && ["Enter", "Escape"].includes(event.key))) return;
    if (event.key === "Escape") return back();
    if (event.key === "Enter") {
      if (active.tagName === "INPUT") { state().focusId = "query"; render(true); }
      else active.click();
      return;
    }
    if (tabs.includes(active)) {
      if (event.key === "ArrowUp") document.getElementById("disconnect").focus();
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") selectTab((tab + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length);
      if (event.key === "ArrowDown") focusItem(items().find(item => item.dataset.id === state().focusId) || items()[0]);
      return;
    }
    if (active.id === "disconnect") { if (event.key === "ArrowDown") tabs[tab].focus(); return; }
    const list = items(), index = list.indexOf(active);
    if (event.key === "ArrowUp") index <= 0 ? tabs[tab].focus() : focusItem(list[index - 1]);
    if (event.key === "ArrowDown") focusItem(list[Math.min(list.length - 1, index + 1)]);
  }
  auth.on(async detail => {
    if (!detail.user) {
      generation++;
      menu.hidden = true; document.getElementById("app").hidden = true;
      return;
    }
    states.forEach(s => Object.assign(s, { category: null, query: "", focusId: null, scroll: 0, data: [], cursor: null }));
    tab = 0; menu.hidden = false;
    document.getElementById("account-label").textContent = `Connecté : ${detail.user.name}`;
    render(); tabs[0].focus();
  });
})();
