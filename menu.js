"use strict";

(() => {
  const menu = document.getElementById("menu");
  const results = document.getElementById("menu-results");
  const context = document.getElementById("menu-context");
  const names = ["Suivis", "Parcourir", "Recherche"];
  const states = names.map(() => ({ category: null, query: "", focusId: null, scroll: 0, data: [], cursor: null, type: "channels", view: "categories", recent: false, filtersOpen: false, language: localPreferences.language(), sort: 0, tag: "" }));
  const languages = [["", "Toutes"], ["fr", "Français"], ["en", "Anglais"], ["es", "Espagnol"], ["de", "Allemand"], ["pt", "Portugais"], ["it", "Italien"], ["ja", "Japonais"], ["ko", "Coréen"]];
  const sorts = ["Twitch · spectateurs ↓", "Spectateurs ↑ · chargés", "Lives récents · chargés"];
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
  async function render(restore = false, more = false, cached = false) {
    if (!auth.user()) return;
    const version = ++generation;
    const current = state();
    const savedScroll = more ? results.scrollTop : current.scroll;
    context.textContent = "Chargement Twitch…";
    tabs.forEach((element, i) => element.setAttribute("aria-current", i === tab ? "page" : "false"));
    let page;
    try {
      const cursor = more ? current.cursor : null;
      if (tab === 2) current.query = normalizeSearch(current.query);
      page = cached ? { items: current.data, cursor: current.cursor }
        : current.category ? await menuData.category(current.category.id, cursor, current.language)
        : tab === 0 ? current.recent ? await menuData.recent(localPreferences.recent()) : await menuData.followed(cursor)
        : tab === 1 ? current.view === "live" ? await menuData.streams(current, cursor) : await menuData.categories(cursor)
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
    const streamFilters = !!current.category || (tab === 1 && current.view === "live");
    let data = current.data;
    if (streamFilters) {
      data = data.filter(entry => !current.tag || entry.tags?.includes(current.tag));
      if (current.sort === 1) data = [...data].sort((a, b) => a.viewers - b.viewers);
      if (current.sort === 2) data = [...data].sort((a, b) => Date.parse(b.started) - Date.parse(a.started));
    }
    results.replaceChildren();
    context.textContent = current.category ? current.category.name : "";
    if (current.category) button("← Catégories", "back", back);
    if (tab === 0) {
      button(current.recent ? "← Lives suivis" : "Récemment regardés", "recent", () => {
        remember();
        if (!current.recent) current.followedPosition = { focusId: "recent", scroll: current.scroll, data: current.data, cursor: current.cursor };
        current.recent = !current.recent;
        Object.assign(current, current.recent ? { focusId: "recent", scroll: 0 } : current.followedPosition);
        render(true, false, !current.recent);
      });
      if (current.recent) context.textContent = "Récemment regardés · 10 chaînes maximum";
    }
    if (tab === 1 && !current.category) {
      const row = document.createElement("div"); row.className = "menu-options"; row.setAttribute("aria-label", "Parcourir");
      for (const [value, label] of [["categories", "Catégories"], ["live", "Chaînes live"]]) {
        const control = button(label, value, () => { remember(); current.view = value; current.focusId = value; current.scroll = 0; current.tag = ""; render(true); });
        control.setAttribute("aria-pressed", String(current.view === value)); row.append(control);
      }
      results.append(row);
    }
    if (streamFilters) {
      const languageName = languages.find(([value]) => value === current.language)[1];
      context.textContent = [context.textContent, languageName, current.tag ? "#" + current.tag : ""].filter(Boolean).join(" · ");
      button(`${current.filtersOpen ? "Fermer" : "Filtres"} · ${sorts[current.sort]}`, "filters", () => { remember(); current.filtersOpen = !current.filtersOpen; current.focusId = "filters"; render(true, false, true); });
      if (current.filtersOpen) {
        const cycle = (id, label, choices, value, update) => {
          const element = button(label, id, () => change(1));
          const change = delta => { remember(); update(choices[(choices.indexOf(value) + delta + choices.length) % choices.length]); current.focusId = id; };
          element.cycle = change;
          return element;
        };
        cycle("language", `Langue : ${languageName} · ←→`, languages.map(l => l[0]), current.language, value => {
          current.language = value; current.tag = ""; localPreferences.setLanguage(value); render(true);
        });
        button(current.category ? `Catégorie : ${current.category.name} · retirer` : "Catégorie : toutes · choisir", "category-filter", () => {
          current.category = null; current.view = "categories"; current.focusId = "categories"; current.scroll = 0; tab = 1; render(true);
        });
        cycle("sort", `Tri : ${sorts[current.sort]} · ←→`, [0, 1, 2], current.sort, value => { current.sort = value; render(true, false, true); });
        const tags = ["", ...new Set(current.data.flatMap(entry => entry.tags || []))];
        if (current.tag && !tags.includes(current.tag)) tags.push(current.tag);
        cycle("tag", `Tag : ${current.tag || "Tous"} · résultats chargés · ←→`, tags, current.tag, value => { current.tag = value; render(true, false, true); });
        const note = document.createElement("small"); note.textContent = "Tags et tris ↑ / récents : uniquement les streams chargés. Charger la suite élargit la sélection."; results.append(note);
      }
    }
    if (tab === 2 && !current.category) {
      const label = document.createElement("label");
      label.textContent = "Recherche Twitch — clavier ou dictée";
      const input = document.createElement("input");
      input.type = "search"; input.value = current.query; input.dataset.id = "query";
      input.placeholder = "Nom de chaîne ou catégorie";
      label.append(input); results.append(label);
      input.addEventListener("input", () => { current.query = input.value; });
      button(current.type === "channels" ? "Type : chaînes" : "Type : catégories", "type", () => { current.type = current.type === "channels" ? "categories" : "channels"; current.focusId = "type"; render(true); });
      button("Rechercher", "search", () => render(true));
    }
    data.forEach(entry => {
      const card = button("", entry.id, async () => {
        if (entry.kind === "category") {
          remember();
          current.parent = { focusId: entry.id, scroll: results.scrollTop, data: current.data, cursor: current.cursor };
          current.category = { id: entry.id, name: entry.name }; current.focusId = "back"; current.scroll = 0;
          render(true);
        } else {
          remember(); returnFocus = card;
          if (current.recent || entry.offline) {
            const version = generation;
            context.textContent = "Vérification du live…";
            try {
              const live = await menuData.live(entry.id);
              if (version !== generation || menu.hidden || !auth.user()) return;
              if (!live) { context.textContent = `${entry.name} est hors ligne pour le moment.`; return; }
              entry = live;
            } catch (error) { if (version === generation) context.textContent = error.message; return; }
          }
          localPreferences.record(entry);
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
      } else {
        card.classList.add("category-card");
        if (entry.thumbnail) {
          const image = document.createElement("img"); image.className = "category-art"; image.src = entry.thumbnail; image.alt = ""; image.loading = "lazy";
          image.addEventListener("error", () => { image.hidden = true; }, { once: true });
          card.append(image);
        }
      }
      const info = document.createElement("div"); info.className = "stream-info"; card.append(info);
      const name = document.createElement("strong"); name.textContent = entry.name; info.append(name);
      const detail = document.createElement("span");
      detail.textContent = entry.kind === "category" ? "Voir les streams →" : entry.title;
      info.append(detail);
      if (entry.kind === "live") {
        const meta = document.createElement("small");
        meta.textContent = [entry.category, entry.offline ? "Hors ligne" : entry.viewers === undefined ? "En direct" : entry.viewers.toLocaleString("fr") + " spectateurs"].filter(Boolean).join(" · ");
        info.append(meta);
        if (entry.tags?.length) {
          const tags = document.createElement("small"); tags.className = "stream-tags"; tags.textContent = entry.tags.slice(0, 2).map(tag => "#" + tag).join(" · "); info.append(tags);
        }
      }
    });
    if (!data.length) {
      const empty = document.createElement("p"); empty.textContent = current.tag ? "Aucun résultat chargé pour ce tag. Chargez la suite ou changez le filtre." : current.recent ? "Aucune chaîne récemment regardée." : "Aucun résultat Twitch pour cette sélection."; results.append(empty);
    }
    if (current.cursor) button("Charger la suite", "more", () => render(true, true));
    if (more) current.focusId = current.data.slice(previousLength).find(entry => data.includes(entry))?.id || "more";
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
    if (state().filtersOpen) {
      state().filtersOpen = false; state().focusId = "filters"; render(true, false, true);
    } else if (state().recent) {
      state().recent = false; Object.assign(state(), state().followedPosition); render(true, false, true);
    } else if (state().category) {
      Object.assign(state(), state().parent, { category: null }); render(true, false, true);
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
    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      if (active.cycle) active.cycle(event.key === "ArrowRight" ? 1 : -1);
      else if (active.parentElement.classList.contains("menu-options")) focusItem(event.key === "ArrowRight" ? active.nextElementSibling : active.previousElementSibling);
      return;
    }
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
    states.forEach(s => Object.assign(s, { category: null, query: "", focusId: null, scroll: 0, data: [], cursor: null, recent: false, filtersOpen: false, tag: "" }));
    tab = 0; menu.hidden = false;
    document.getElementById("account-label").textContent = `Connecté : ${detail.user.name}`;
    render(); tabs[0].focus();
  });
})();
