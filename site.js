const CJ = (() => {
  const state = { manifest: null, config: window.siteConfig || {} };

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);

  const slugify = (s) =>
    String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(name);

  const isRelative = (url) => url && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url);

  const resolve = (url, base) =>
    base && isRelative(url) ? `${base.replace(/\/+$/, "")}/${url.replace(/^\.\//, "")}` : url;

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
      data[key] = value === "" ? {} : coerce(value);
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

  const stripComments = (md) => String(md == null ? "" : md).replace(/<!--[\s\S]*?-->/g, "");

  function sanitize(html, base) {
    const tpl = document.createElement("div");
    tpl.innerHTML = html;
    tpl.querySelectorAll("script,style,iframe,object,embed,form,link,meta").forEach((n) => n.remove());
    tpl.querySelectorAll("*").forEach((n) => {
      for (const attr of Array.from(n.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();
        if (name.startsWith("on")) n.removeAttribute(attr.name);
        if ((name === "href" || name === "src") && value.toLowerCase().startsWith("javascript:")) {
          n.removeAttribute(attr.name);
        }
      }
      if (n.tagName === "A" && n.getAttribute("href")) {
        n.setAttribute("href", resolve(n.getAttribute("href"), base));
        n.setAttribute("target", "_blank");
        n.setAttribute("rel", "noopener noreferrer");
      }
      if (n.tagName === "IMG") {
        const src = n.getAttribute("src");
        if (src) n.setAttribute("src", resolve(src, base));
        n.setAttribute("loading", "lazy");
        n.setAttribute("decoding", "async");
        if (!n.getAttribute("class")) n.setAttribute("class", "img-fluid");
      }
    });
    return tpl.innerHTML;
  }

  const md = (text, base) => sanitize(window.marked.parse(stripComments(text || "")), base);

  async function loadManifest() {
    if (state.manifest) return state.manifest;
    const res = await fetch("data/manifest.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("The site could not load its content. Please try again in a moment.");
    state.manifest = await res.json();
    return state.manifest;
  }

  const pageUrl = (slug) => `page.html?p=${encodeURIComponent(slug)}`;

  const findPage = (slug) => (state.manifest?.pages || []).find((p) => p.slug === slug) || null;

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

  function initialsOf(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function avatar(name, size = 400) {
    const initials = initialsOf(name);
    let seed = 0;
    for (const ch of String(name || "")) seed = (seed * 31 + ch.charCodeAt(0)) % 360;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
      `<rect width="100" height="100" fill="hsl(${seed} 24% 88%)"/>` +
      `<text x="50" y="50" fill="hsl(${seed} 30% 30%)" font-family="monospace" font-size="36" ` +
      `font-weight="700" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/'/g, "%27")}`;
  }

  function splitSections(body) {
    const clean = stripComments(body).replace(/\r/g, "");
    const lines = clean.split("\n");
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

  async function loadEntry(entry) {
    const res = await fetch(entry.source, { cache: "no-cache" });
    if (!res.ok) throw new Error("This page could not be loaded. Please try again in a moment.");
    const { data, body } = parseFrontmatter(await res.text());
    return { ...data, ...entry, meta: { ...entry, ...data }, body };
  }

  function navPages() {
    return (state.manifest?.pages || [])
      .filter((p) => p.nav)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.title.localeCompare(b.title));
  }

  function socialLinks() {
    const meta = state.config?.socialMeta || {};
    return Object.entries(state.config?.socialLinks || {})
      .map(([key, url]) => {
        const m = meta[key] || {};
        return (
          `<li><a href="${esc(url)}" style="--cj-chip:${esc(m.color || "#c0c0c0")}" ` +
          `title="${esc(m.label || key)}">${esc((m.label || key).slice(0, 2).toUpperCase())}</a></li>`
        );
      })
      .join("\n          ");
  }

  function renderHeader(active) {
    const c = state.config;
    const home =
      `<li class="nav-item"><a class="nav-link${active === "home" ? " active" : ""}" ` +
      `href="index.html"${active === "home" ? ' aria-current="page"' : ""}>Home</a></li>`;
    const links = navPages()
      .filter((p) => p.slug !== "home")
      .map((p) => {
        const on = p.slug === active;
        return (
          `<li class="nav-item"><a class="nav-link${on ? " active" : ""}" href="${pageUrl(p.slug)}"` +
          `${on ? ' aria-current="page"' : ""}>${esc(p.navLabel || p.title)}</a></li>`
        );
      })
      .join("\n            ");
    return `
      <div class="container">
        <a class="navbar-brand cj-brand" href="index.html">${esc(c.siteName || "Cyber Jedis")}<small>${esc(c.siteTagline || "")}</small></a>
        <button class="cj-nav-toggler d-lg-none" type="button" data-bs-toggle="collapse"
                data-bs-target="#cjNav" aria-controls="cjNav" aria-expanded="false" aria-label="Toggle navigation">Menu</button>
        <div class="collapse navbar-collapse" id="cjNav">
          <ul class="navbar-nav cj-nav ms-auto mb-3 mb-lg-0">
            ${home}
            ${links}
          </ul>
          <ul class="cj-social">${socialLinks()}</ul>
        </div>
      </div>`;
  }

  function renderFooter() {
    const c = state.config;
    const year = new Date().getFullYear();
    const links = navPages()
      .filter((p) => p.slug !== "home")
      .map((p) => `<li><a href="${pageUrl(p.slug)}">${esc(p.navLabel || p.title)}</a></li>`)
      .join("\n            ");
    return `
      <div class="container">
        <div class="row g-4">
          <div class="col-12 col-md-5">
            <h2>${esc(c.siteName || "Cyber Jedis")}</h2>
            <p class="mb-0">${esc(c.siteTagline || "")}</p>
          </div>
          <div class="col-6 col-md-3">
            <h2>Pages</h2>
            <ul>
            <li><a href="index.html">Home</a></li>
            ${links}
            </ul>
          </div>
          <div class="col-6 col-md-4">
            <h2>Follow</h2>
            <ul class="cj-social">${socialLinks()}</ul>
          </div>
        </div>
        <p class="mt-4 pt-3 mb-0" style="border-top:1px solid var(--cj-line)">
          &copy; ${year} ${esc(c.copyrightOwner || c.siteName || "")}
        </p>
      </div>`;
  }

  function mountShell(active) {
    const header = document.getElementById("site-header");
    const footer = document.getElementById("site-footer");
    if (header) {
      header.className = "cj-navbar navbar navbar-expand-lg";
      header.innerHTML = renderHeader(active);
    }
    if (footer) {
      footer.className = "cj-footer";
      footer.innerHTML = renderFooter();
    }
  }

  const LABELS = {
    email: "Email",
    discord: "Discord",
    linkedin: "LinkedIn",
    instagram: "Instagram",
    youtube: "YouTube",
    twitter: "Twitter",
    github: "GitHub",
    rowdylink: "RowdyLink",
    website: "Website",
    slack: "Slack"
  };

  const label = (key) => LABELS[key.toLowerCase()] || key.charAt(0).toUpperCase() + key.slice(1);

  function linkRow(links) {
    const items = Object.entries(links)
      .filter(([k]) => k !== "logo")
      .map(([k, v]) => `<a class="btn btn-outline-jedis btn-sm" href="${esc(v)}">${esc(label(k))}</a>`)
      .join("\n        ");
    return items ? `<div class="d-flex flex-wrap gap-2 mt-4">\n        ${items}\n      </div>` : "";
  }

  function kindOf(entry) {
    if (entry?.kind) return entry.kind;
    if (entry?.type === "event") return "Event";
    if (entry?.type === "team") return "Team";
    if (entry?.type === "staff") return "Staff";
    return "";
  }

  function hero(entry) {
    const accent = accentOf(entry);
    const kind = kindOf(entry);
    const mark = entry.logo
      ? `<img class="cj-hero-mark${isPerson(entry) ? " cj-hero-mark-person" : ""}" ` +
        `src="${esc(entry.logo || entry.logoSm)}" alt="${esc(entry.title)}" decoding="async">`
      : "";
    const meta = [];
    if (entry.category) meta.push(`<span class="cj-tag cj-tag-accent">${esc(entry.category)}</span>`);
    if (entry.schedule) meta.push(`<span class="cj-tag">${esc(entry.schedule)}</span>`);
    (entry.tags || []).slice(0, 4).forEach((t) => meta.push(`<span class="cj-tag">${esc(t)}</span>`));
    return `
      <section class="cj-hero" style="--cj-accent:${accent}">
        <div class="container">
          <div class="row align-items-center g-4">
            ${mark ? `<div class="col-auto">${mark}</div>` : ""}
            <div class="${mark ? (isPerson(entry) ? "col" : "col") : "col-12"}">
              ${kind ? `<p class="cj-eyebrow">${esc(kind)}</p>` : ""}
              <h1>${esc(entry.title)}</h1>
              ${entry.tagline ? `<p class="cj-hero-lede">${esc(entry.tagline)}</p>` : ""}
              ${meta.length ? `<div class="cj-hero-meta">${meta.join("")}</div>` : ""}
              ${entry.links ? linkRow(entry.links) : ""}
            </div>
          </div>
        </div>
      </section>`;
  }


  function contactBlock(entry) {
    const rows = Object.entries(entry.contact || {})
      .filter(([, v]) => v)
      .map(
        ([k, v]) =>
          `<div class="cj-contact-row"><span class="cj-contact-label">${esc(label(k))}</span>` +
          `<a href="${esc(v)}" rel="noopener noreferrer">${esc(
            v.replace(/^mailto:/, "").replace(/^https?:\/\//, "")
          )}</a></div>`
      )
      .join("");
    if (!rows) return "";
    return `
      <section class="cj-block" id="contact">
        <div class="cj-block-head"><h2 class="cj-block-title">Contact</h2></div>
        <div class="cj-contact">${rows}</div>
      </section>`;
  }

  const isPerson = (entry) => entry?.type === "staff";

  function mark(entry) {
    if (entry.logo) {
      return (
        `<img class="cj-card-mark${isPerson(entry) ? " cj-card-mark-person" : ""}" ` +
        `src="${esc(entry.logoSm || entry.logo)}" alt="" loading="lazy" decoding="async">`
      );
    }
    return `<img class="cj-card-mark cj-card-mark-avatar" src="${avatar(entry.title, 128)}" alt="" width="128" height="128" aria-hidden="true">`;
  }

  function card(entry, opts = {}) {
    const accent = accentOf(entry);
    const text = entry.summary || entry.tagline || "";
    const kind =
      entry.type === "event"
        ? entry.date || (entry.recurring ? `Every ${entry.recurring}` : "Event")
        : isPerson(entry)
        ? entry.kind || "Officer"
        : entry.category || "Team";
    const haystack =
      `${entry.title} ${text} ${entry.kind || ""} ${(entry.tags || []).join(" ")} ` +
      `${entry.category || ""} ${entry.division || ""}`.toLowerCase();
    const tags = (entry.tags || [])
      .slice(0, 3)
      .map((t) => `<span class="cj-tag">${esc(t)}</span>`)
      .join("");
    return `
      <a class="cj-card${isPerson(entry) ? " cj-card-person" : ""}" href="${pageUrl(entry.slug)}" style="--cj-accent:${accent}"
         data-kind="${esc(kind)}" data-hay="${esc(haystack)}">
        <div class="d-flex gap-3 align-items-start">
          ${mark(entry)}
          <div class="flex-grow-1 min-width-0">
            <p class="cj-card-kind">${esc(kind)}</p>
            <h3 class="cj-card-title">${esc(entry.title)}</h3>
            ${text && !isPerson(entry) ? `<p class="cj-card-text">${esc(text)}</p>` : ""}
            ${tags ? `<div class="d-flex flex-wrap gap-1 mt-2">${tags}</div>` : ""}
          </div>
        </div>
      </a>`;
  }

  function cardGrid(entries, opts = {}) {
    if (!entries.length) {
      return `<div class="cj-empty"><p class="mb-0">${esc(opts.empty || "No entries yet.")}</p></div>`;
    }
    return `<div class="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3 cj-reveal">${entries
      .map((e) => `<div class="col">${card(e, opts)}</div>`)
      .join("")}</div>`;
  }

  function gallery(entry) {
    const shots = (entry.media || []).filter((m) => isImage(m.file));
    if (!shots.length) return "";
    return `
      <div class="cj-gallery" data-gallery>
        <div class="cj-gallery-stage">
          ${shots
            .map(
              (m, i) =>
                `<figure class="cj-gallery-slide${i === 0 ? " active" : ""}">` +
                `<img src="${esc(m.lg || m.file)}" alt="${esc(entry.title)} photo ${i + 1}" ` +
                `${m.width ? `width="${m.width}" ` : ""}${m.height ? `height="${m.height}" ` : ""}` +
                `loading="lazy" decoding="async"></figure>`
            )
            .join("")}
        </div>
        <div class="cj-gallery-bar">
          <button class="btn btn-sm" type="button" data-gallery-prev>Prev</button>
          <span class="cj-gallery-count" data-gallery-count>1/${shots.length}</span>
          <button class="btn btn-sm" type="button" data-gallery-next>Next</button>
        </div>
      </div>`;
  }

  function bindGallery(root) {
    root.querySelectorAll("[data-gallery]").forEach((g) => {
      const slides = Array.from(g.querySelectorAll(".cj-gallery-slide"));
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

  function sectionHtml(entry, key) {
    const { sections } = splitSections(entry.body || "");
    const s = sections.find((x) => slugify(x.heading) === key);
    return s ? md(s.lines.join("\n"), entry.dir).trim() : "";
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
      <article class="cj-post" id="post-${slugify(post.id)}">
        <p class="cj-post-kind">${post.date ? esc(post.date) : "Update"}${post.group ? ` | ${esc(post.group)}` : ""}</p>
        <h3 class="cj-post-title">${esc(post.title)}</h3>
        <div class="cj-prose">${md(body, post.dir)}</div>
      </article>`;
  }

  async function postsBlock(slug, label) {
    const posts = postsFor(slug);
    if (!posts.length) return "";
    const bodies = await Promise.all(posts.map(renderPost));
    return `
      <section class="cj-block">
        <div class="cj-block-head"><h2 class="cj-block-title">${esc(label || "Updates")}</h2></div>
        <div class="row row-cols-1 row-cols-lg-2 g-3 cj-reveal">
          ${bodies.map((b) => `<div class="col">${b}</div>`).join("")}
        </div>
      </section>`;
  }

  function block(title, inner, more) {
    return `
      <section class="cj-block">
        <div class="cj-block-head">
          <h2 class="cj-block-title">${esc(title)}</h2>
          ${more ? `<a class="cj-more" href="${pageUrl(more)}">See all</a>` : ""}
        </div>
        ${inner}
      </section>`;
  }

  function renderBody(entry) {
    const { lead, sections } = splitSections(entry.body);
    const blocks = [];
    if (lead) blocks.push(`<section class="cj-block"><div class="cj-prose">${md(lead, entry.dir)}</div></section>`);
    sections.forEach((s) => {
      const key = slugify(s.heading);
      if (key === "gallery") {
        const g = gallery(entry);
        if (g) {
          blocks.push(
            `<section class="cj-block"><div class="cj-block-head"><h2 class="cj-block-title">Gallery</h2></div>${g}</section>`
          );
        }
        return;
      }
      const inner = md(s.lines.join("\n"), entry.dir).trim();
      if (!inner && key !== "contact") return;
      blocks.push(
        `<section class="cj-block" id="${key}"><div class="cj-block-head"><h2 class="cj-block-title">${esc(s.heading)}</h2></div>` +
          `<div class="cj-prose">${inner}</div></section>`
      );
    });

    if (entry.contact) blocks.push(contactBlock(entry));

    return blocks.join("");
  }

  function emptyState() {
    return `
      <section class="cj-block">
        <div class="cj-empty">
          <h2>Coming soon</h2>
          <p class="mb-0">This page is still being put together. Check back soon, or reach out on Discord if you want to know more.</p>
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

    const toolbar = `
      <div class="cj-toolbar">
        <input class="cj-search" type="search" placeholder="Search" aria-label="Search" data-search>
        <div class="cj-chips" data-chips></div>
      </div>`;

    const cols = isPerson(entry) ? "row-cols-2 row-cols-sm-3 row-cols-lg-4" : "row-cols-1 row-cols-sm-2 row-cols-lg-3";

    if (entry.groupBy) {
      const field = entry.groupBy;
      const groups = new Map();
      for (const k of kids) {
        const g = k[field] || "Other";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(k);
      }
      const order = [...new Set(kids.map((k) => k[field] || "Other"))];
      return order
        .map((g) => {
          const members = groups.get(g);
          return `
      <section class="cj-block">
        <div class="cj-block-head">
          <h2 class="cj-block-title">${esc(g)}</h2>
        </div>
        <div class="row ${cols} g-3 cj-reveal" data-card-grid>
          ${members.map((k) => `<div class="col">${card(k)}</div>`).join("")}
        </div>
      </section>`;
        })
        .join("");
    }

    return `
      <section class="cj-block">
        <div class="cj-block-head">
          <h2 class="cj-block-title">${esc(entry.listLabel || "Browse")}</h2>
        </div>
        ${toolbar}
        <div class="row ${cols} g-3 cj-reveal" data-card-grid>
          ${kids.map((k) => `<div class="col">${card(k)}</div>`).join("")}
        </div>
        <p class="cj-none mt-3" data-no-results hidden>Nothing matched that search.</p>
      </section>`;
  }

  function bindFilters(root) {
    const bar = root.querySelector("[data-search]");
    if (!bar) return;
    const toolbar = bar.closest(".cj-toolbar");
    const grid = toolbar.parentElement.querySelector("[data-card-grid]");
    const chips = toolbar.querySelector("[data-chips]");
    const empty = toolbar.parentElement.querySelector("[data-no-results]");
    const cells = Array.from(grid.querySelectorAll(".col"));
    const buckets = new Map();
    cells.forEach((c) => {
      const kind = c.querySelector(".cj-card").dataset.kind;
      buckets.set(kind, (buckets.get(kind) || 0) + 1);
    });
    if (buckets.size > 1) {
      chips.innerHTML = Array.from(buckets.keys())
        .sort()
        .map((k) => {
          const id = `chip-${slugify(k)}`;
          return `<label class="cj-chip" for="${id}"><input type="checkbox" id="${id}" value="${esc(k)}" checked><span>${esc(k)} <b>${buckets.get(k)}</b></span></label>`;
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
      const q = bar.value.trim().toLowerCase();
      let shown = 0;
      cells.forEach((c) => {
        const cardEl = c.querySelector(".cj-card");
        const keep = on.has(cardEl.dataset.kind) && (!q || cardEl.dataset.hay.includes(q));
        c.hidden = !keep;
        if (keep) shown++;
      });
      empty.hidden = shown > 0;
    };
    bar.addEventListener("input", apply);
    chips.addEventListener("change", apply);
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
    initialsOf,
    avatar,
    navPages,
    mountShell,
    hero,
    block,
    renderBody,
    renderIndex,
    cardGrid,
    card,
    children,
    postsFor,
    postsBlock,
    sectionHtml,
    bindGallery,
    bindFilters,
    emptyState,
    pageUrl
  };
})();
