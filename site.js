const CJ = (() => {
  const state = { manifest: null, config: window.siteConfig || {} };

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);

  const slugify = (s) =>
    String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(name);

  function parseFrontmatter(text) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
    if (!m) return { data: {}, body: text };
    const data = {};
    const lines = m[1].split(/\r?\n/);
    let currentKey = null;
    for (const raw of lines) {
      if (!raw.trim() || raw.trim().startsWith("#")) continue;
      const indented = /^\s/.test(raw);
      const kv = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(raw);
      if (!kv) continue;
      const key = kv[1];
      const value = kv[2].trim();
      if (indented && currentKey) {
        if (typeof data[currentKey] !== "object" || data[currentKey] === null) data[currentKey] = {};
        data[currentKey][key] = coerce(value);
        continue;
      }
      currentKey = key;
      if (value === "") data[key] = {};
      else data[key] = coerce(value);
    }
    return { data, body: m[2] };
  }

  function coerce(value) {
    if (/^\[.*\]$/.test(value)) {
      return value.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    }
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    return value.replace(/^["']|["']$/g, "");
  }

  function stripComments(md) {
    return String(md == null ? "" : md).replace(/<!--[\s\S]*?-->/g, "");
  }

  function sanitize(html) {
    const tpl = document.createElement("div");
    tpl.innerHTML = html;
    tpl.querySelectorAll("script,style,iframe,object,embed,form,link,meta").forEach((n) => n.remove());
    tpl.querySelectorAll("*").forEach((n) => {
      for (const attr of Array.from(n.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim().toLowerCase();
        if (name.startsWith("on")) n.removeAttribute(attr.name);
        if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
          n.removeAttribute(attr.name);
        }
      }
      if (n.tagName === "A" && n.getAttribute("href")) {
        n.setAttribute("target", "_blank");
        n.setAttribute("rel", "noopener noreferrer");
      }
      if (n.tagName === "IMG") {
        n.setAttribute("loading", "lazy");
        n.setAttribute("decoding", "async");
      }
    });
    return tpl.innerHTML;
  }

  const md = (text) => sanitize(window.marked.parse(stripComments(text || "")));

  async function loadManifest() {
    if (state.manifest) return state.manifest;
    const res = await fetch("data/manifest.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("manifest missing, run: node tools/build.mjs");
    state.manifest = await res.json();
    return state.manifest;
  }

  const pageUrl = (slug) => `page.html?p=${encodeURIComponent(slug)}`;

  function findPage(slug) {
    return (state.manifest?.pages || []).find((p) => p.slug === slug) || null;
  }

  function accentOf(entry) {
    const accents = state.config?.theme?.accents || ["#c0c0c0"];
    if (entry?.accent) return entry.accent;
    return accents[Math.abs(hash(entry?.slug || "")) % accents.length];
  }

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return h;
  }

  function splitSections(body) {
    const clean = stripComments(body).replace(/\r/g, "");    const lines = clean.split("\n");
    const sections = [];
    let current = null;
    for (const line of lines) {
      const h = /^##\s+(.+)$/.exec(line);
      if (h) {
        current = { heading: h[1].trim(), lines: [] };
        sections.push(current);
        continue;
      }
      if (current) current.lines.push(line);
    }
    const lead = [];
    for (const line of lines) {
      if (/^##\s+/.test(line)) break;
      lead.push(line);
    }
    const leadText = lead
      .join("\n")
      .replace(/^\s*#\s+.*$/m, "")
      .replace(/^\s*(?:>.*$\n?)+/gm, "")
      .trim();
    return { lead: leadText, sections };
  }

  async function loadEntry(entry) {    const res = await fetch(entry.source, { cache: "no-cache" });
    if (!res.ok) throw new Error(`missing source: ${entry.source}`);
    const { data, body } = parseFrontmatter(await res.text());
    return { ...entry, meta: { ...entry, ...data }, body };
  }

  function navPages() {
    return (state.manifest?.pages || [])
      .filter((p) => p.nav)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title));
  }

  function renderHeader(active) {
    const c = state.config;
    const home = `<li><a href="index.html"${active === "home" ? ' class="active" aria-current="page"' : ""}>Home</a></li>\n          `;
    const links = navPages()
      .filter((p) => p.slug !== "home")
      .map((p) => {
        const on = p.slug === active ? ' class="active" aria-current="page"' : "";
        return `<li><a href="${pageUrl(p.slug)}"${on}>${esc(p.navLabel || p.title)}</a></li>`;
      })
      .join("\n          ");
    return `
      <a class="skip" href="#main">Skip to content</a>
      <div class="brand">
        <a class="brand-mark" href="index.html">
          <span class="brand-text">${esc(c.siteName || "Cyber Jedis")}</span>
          <span class="brand-tagline">${esc(c.siteTagline || "")}</span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button>
      </div>
      <nav id="primary-nav" class="nav" aria-label="Primary">
        <ul class="nav-links">${home}${links}</ul>
        <ul class="nav-social">${socialLinks()}</ul>
      </nav>`;
  }

  function socialLinks() {
    const meta = state.config?.socialMeta || {};
    return Object.entries(state.config?.socialLinks || {})
      .map(([key, url]) => {
        const m = meta[key] || {};
        return `<li><a class="social-chip" href="${esc(url)}" style="--chip:${esc(m.color || "#c0c0c0")}" title="${esc(m.label || key)}">${esc((m.label || key).slice(0, 2).toUpperCase())}</a></li>`;
      })
      .join("\n          ");
  }

  function renderFooter() {
    const c = state.config;
    const year = new Date().getFullYear();
    return `
      <div class="footer-grid">
        <div>
          <h2 class="footer-heading">${esc(c.siteName || "Cyber Jedis")}</h2>
          <p class="footer-text">${esc(c.siteTagline || "")}</p>
        </div>
        <div>
          <h2 class="footer-heading">Pages</h2>
          <ul class="footer-links">
            <li><a href="index.html">Home</a></li>
            ${navPages()
              .filter((p) => p.slug !== "home")
              .map((p) => `<li><a href="${pageUrl(p.slug)}">${esc(p.navLabel || p.title)}</a></li>`)
              .join("\n            ")}
          </ul>
        </div>
        <div>
          <h2 class="footer-heading">Follow</h2>
          <ul class="nav-social">${socialLinks()}</ul>
        </div>
      </div>
      <p class="footer-legal">&copy; ${year} ${esc(c.copyrightOwner || c.siteName || "")}</p>`;
  }

  function mountShell(active) {
    const header = document.getElementById("site-header");
    const footer = document.getElementById("site-footer");
    if (header) {
      header.className = "site-header";
      header.innerHTML = renderHeader(active);
      const toggle = header.querySelector(".nav-toggle");
      const nav = header.querySelector(".nav");
      toggle?.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }
    if (footer) {
      footer.className = "site-footer";
      footer.innerHTML = renderFooter();
    }
    document.documentElement.style.setProperty("--accent", accentOf({ slug: active }));
  }

  function hero(entry) {
    const accent = accentOf(entry);
    const logo = entry.logo
      ? `<img class="hero-logo" src="${esc(entry.logo)}" alt="${esc(entry.title)} logo" decoding="async">`
      : `<span class="hero-mono" style="--accent:${accent}">${esc(initials(entry.title))}</span>`;
    const meta = [];
    if (entry.category) meta.push(`<span class="badge">${esc(entry.category)}</span>`);
    (entry.tags || []).forEach((t) => meta.push(`<span class="tag">${esc(t)}</span>`));
    if (entry.schedule) meta.push(`<span class="tag tag-plain">${esc(entry.schedule)}</span>`);
    return `
      <section class="hero" style="--accent:${accent}">
        <div class="hero-inner">
          <div class="hero-mark">${logo}</div>
          <div class="hero-copy">
            <p class="eyebrow">${esc(entry.type === "staff" ? "Staff" : entry.type === "index" ? "Index" : "Team")}</p>
            <h1 class="hero-title">${esc(entry.title)}</h1>
            ${entry.tagline ? `<p class="hero-tagline">${esc(entry.tagline)}</p>` : ""}
            ${meta.length ? `<div class="hero-meta">${meta.join("")}</div>` : ""}
            ${entry.links ? linkRow(entry.links) : ""}
          </div>
        </div>
      </section>`;
  }

  function linkRow(links) {
    const items = Object.entries(links)
      .map(([k, v]) => `<a class="btn-chrome" href="${esc(v)}">${esc(k)}</a>`)
      .join("");
    return items ? `<div class="btn-row">${items}</div>` : "";
  }

  function initials(title) {
    return String(title || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  }

  function cardGrid(entries, opts = {}) {
    if (!entries.length) {
      return `<div class="empty-state"><p>${esc(opts.empty || "No entries yet.")}</p></div>`;
    }
    return `<div class="card-grid">${entries.map((e) => card(e, opts)).join("")}</div>`;
  }

  function card(entry, opts = {}) {
    const accent = accentOf(entry);
    const mark = entry.logo
      ? `<img src="${esc(entry.logo)}" alt="" loading="lazy" decoding="async">`
      : `<span style="--accent:${accent}">${esc(initials(entry.title))}</span>`;
    const text = entry.summary || entry.tagline || "";
    const kind =
      entry.type === "event"
        ? entry.date || (entry.recurring ? `Every ${entry.recurring}` : "Event")
        : entry.type === "staff"
        ? "Staff"
        : entry.category || "Team";
    const haystack = `${entry.title} ${text} ${(entry.tags || []).join(" ")} ${entry.category || ""}`.toLowerCase();
    return `
      <a class="card" href="${pageUrl(entry.slug)}" style="--accent:${accent}" data-kind="${esc(kind)}" data-hay="${esc(haystack)}">
        <div class="card-mark">${mark}</div>
        <div class="card-body">
          <p class="card-kind">${esc(kind)}</p>
          <h3 class="card-title">${esc(entry.title)}</h3>
          <p class="card-text">${esc(text)}</p>
          ${entry.tags && entry.tags.length ? `<div class="card-tags">${entry.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
        </div>
      </a>`;
  }

  function gallery(entry) {
    const shots = (entry.media || []).filter((m) => isImage(m.file));
    if (!shots.length) return "";
    return `
      <div class="gallery" data-gallery>
        <div class="gallery-stage">
          ${shots
            .map(
              (m, i) =>
                `<figure class="gallery-slide${i === 0 ? " active" : ""}"><img src="${esc(m.file)}" alt="${esc(entry.title)} media ${i + 1}" loading="lazy" decoding="async"></figure>`
            )
            .join("")}
        </div>
        <div class="gallery-bar">
          <button class="btn-chrome" type="button" data-gallery-prev>Prev</button>
          <span class="gallery-count" data-gallery-count>1/${shots.length}</span>
          <button class="btn-chrome" type="button" data-gallery-next>Next</button>
        </div>
      </div>`;
  }

  function bindGallery(root) {
    root.querySelectorAll("[data-gallery]").forEach((g) => {
      const slides = Array.from(g.querySelectorAll(".gallery-slide"));
      const count = g.querySelector("[data-gallery-count]");
      let i = 0;
      const go = (n) => {
        i = (n + slides.length) % slides.length;
        slides.forEach((s, k) => s.classList.toggle("active", k === i));
        if (count) count.textContent = `${i + 1}/${slides.length}`;
      };
      g.querySelector("[data-gallery-next]")?.addEventListener("click", () => go(i + 1));
      g.querySelector("[data-gallery-prev]")?.addEventListener("click", () => go(i - 1));
    });
  }

  function renderBody(entry) {
    const { lead, sections } = splitSections(entry.body);
    const blocks = [];
    if (lead) blocks.push(`<section class="block"><div class="prose">${md(lead)}</div></section>`);
    sections.forEach((s) => {
      const key = slugify(s.heading);
      if (key === "gallery") {
        const g = gallery(entry);
        if (g) blocks.push(`<section class="block" id="${key}"><h2 class="block-title">${esc(s.heading)}</h2>${g}</section>`);
        return;
      }
      const inner = md(s.lines.join("\n")).trim();
      if (!inner) return;
      blocks.push(`<section class="block" id="${key}"><h2 class="block-title">${esc(s.heading)}</h2><div class="prose">${inner}</div></section>`);
    });
    return blocks.join("");
  }

  function emptyState(entry) {
    return `
      <section class="block">
        <div class="empty-state">
          <h2 class="empty-title">Content needed</h2>
          <p>This page exists but has no published content yet. Copy <code>TEMPLATES/WEBPAGE_TEMPLATE.md</code> into <code>PAGES/${esc(entry.slug.toUpperCase())}/page.md</code> and open a pull request.</p>
        </div>
      </section>`;
  }

  function children(entry) {
    const type = entry.list;
    if (!type) return [];
    return (state.manifest.pages || [])
      .filter((p) => p.type === type && p.slug !== entry.slug && p.published !== false)
      .filter((p) => !entry.category || p.category === entry.category)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title));
  }

  function renderIndex(entry) {
    const kids = children(entry);
    if (!kids.length) return "";
    return `
      <section class="block" id="browse">
        <h2 class="block-title">${esc(entry.listLabel || "Browse")}</h2>
        <div class="toolbar" data-filters>
          <input class="search" type="search" placeholder="Search" aria-label="Search" data-search>
          <div class="chips" data-chips></div>
        </div>
        <div class="card-grid" data-card-grid>${kids.map((k) => card(k)).join("")}</div>
        <p class="no-results" data-no-results hidden>Nothing matched that search.</p>
      </section>`;
  }

  function bindFilters(root) {
    const bar = root.querySelector("[data-filters]");
    if (!bar) return;
    const grid = bar.parentElement.querySelector("[data-card-grid]");
    const search = bar.querySelector("[data-search]");
    const chips = bar.querySelector("[data-chips]");
    const empty = bar.parentElement.querySelector("[data-no-results]");
    const cards = Array.from(grid.querySelectorAll(".card"));
    const buckets = new Map();
    cards.forEach((c) => {
      const kind = c.dataset.kind;
      buckets.set(kind, (buckets.get(kind) || 0) + 1);
    });
    if (buckets.size > 1) {
      chips.innerHTML = Array.from(buckets.keys())
        .sort()
        .map((k) => {
          const id = `chip-${slugify(k)}`;
          return `<label class="chip" for="${id}"><input type="checkbox" id="${id}" value="${esc(k)}" checked><span>${esc(k)} <b>${buckets.get(k)}</b></span></label>`;
        })
        .join("");
    } else {
      chips.hidden = true;
    }
    const apply = () => {
      const inputs = Array.from(chips.querySelectorAll("input"));
      const on = inputs.length
        ? new Set(inputs.filter((i) => i.checked).map((i) => i.value))
        : new Set(buckets.keys());
      const q = (search.value || "").trim().toLowerCase();
      let shown = 0;
      cards.forEach((c) => {
        const keep = on.has(c.dataset.kind) && (!q || c.dataset.hay.includes(q));
        c.hidden = !keep;
        if (keep) shown++;
      });
      empty.hidden = shown > 0;
    };
    search.addEventListener("input", apply);
    chips.addEventListener("change", apply);
  }

  function crumbs(entry) {
    const parts = entry.slug.split("/");
    return parts
      .map((p, i) =>
        i === parts.length - 1
          ? `<span aria-current="page">${esc(entry.title)}</span>`
          : esc(p.replace(/-/g, " "))
      )
      .join(`<span class="crumb-sep">/</span>`);
  }

  function postsFor(slug) {
    return (state.manifest.posts || [])
      .filter((p) => p.page === slug)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || a.id.localeCompare(b.id));
  }

  async function renderPost(post) {
    const res = await fetch(post.source, { cache: "no-cache" });
    if (!res.ok) return "";
    const { body } = parseFrontmatter(await res.text());
    return `
      <article class="post" id="post-${slugify(post.id)}">
        <p class="post-kind">${post.date ? esc(post.date) : "Update"}${post.group ? ` | ${esc(post.group)}` : ""}</p>
        <h3 class="post-title">${esc(post.title)}</h3>
        <div class="prose">${md(body)}</div>
      </article>`;
  }

  async function postsBlock(slug, label) {
    const posts = postsFor(slug);
    if (!posts.length) return "";
    const bodies = await Promise.all(posts.map(renderPost));
    return `
      <section class="block" id="updates">
        <h2 class="block-title">${esc(label || "Updates")}</h2>
        <div class="post-list">${bodies.join("")}</div>
      </section>`;
  }

  return {
    esc,
    slugify,
    parseFrontmatter,
    md,
    sanitize,
    loadManifest,
    loadEntry,
    findPage,
    accentOf,
    navPages,
    mountShell,
    hero,
    renderBody,
    renderIndex,
    cardGrid,
    children,
    crumbs,
    postsFor,
    postsBlock,
    bindGallery,
    bindFilters,
    emptyState,
    pageUrl
  };
})();
