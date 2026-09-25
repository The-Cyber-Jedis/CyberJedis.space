(() => {
  const main = document.getElementById("main");

  const byType = (type, extra) => (window.__manifest.pages || [])
    .filter((p) => p.type === type && p.published !== false)
    .filter(extra || (() => true));

  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  const fmtTime = (t) => {
    if (!t) return "";
    const d = new Date(`1970-01-01T${t}`);
    if (Number.isNaN(d.getTime())) return t;
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  function events(limit) {
    const today = new Date().toISOString().slice(0, 10);
    const dated = byType("event", (p) => p.date && p.date >= today);
    const recurring = byType("event", (p) => p.recurring);
    return [...dated, ...recurring].slice(0, limit);
  }

  function eventList(items) {
    if (!items.length) return `<div class="empty-state"><p>No events scheduled yet.</p></div>`;
    return `<ul class="event-list">${items
      .map(
        (e) => `
      <li class="event-row" style="--accent:${CJ.accentOf(e)}">
        <div class="event-when">
          <span class="event-date">${e.date ? CJ.esc(fmtDate(e.date)) : CJ.esc(`Every ${e.recurring}`)}</span>
          ${e.time ? `<span class="event-time">${CJ.esc(fmtTime(e.time))}</span>` : ""}
        </div>
        <div class="event-body">
          <a class="event-title" href="${CJ.pageUrl(e.slug)}">${CJ.esc(e.title)}</a>
          ${e.location ? `<span class="event-where">${CJ.esc(e.location)}</span>` : ""}
          ${e.summary ? `<span class="event-text">${CJ.esc(e.summary)}</span>` : ""}
        </div>
      </li>`
      )
      .join("")}</ul>`;
  }

  function carousel(shots) {
    if (!shots.length) return "";
    return `
      <section class="block" id="featured">
        <h2 class="block-title">Featured</h2>
        <div class="gallery" data-gallery>
          <div class="gallery-stage">
            ${shots
              .map(
                (s, i) =>
                  `<figure class="gallery-slide${i === 0 ? " active" : ""}"><img src="${CJ.esc(s)}" alt="Cyber Jedis media ${i + 1}" loading="lazy" decoding="async"></figure>`
              )
              .join("")}
          </div>
          <div class="gallery-bar">
            <button class="btn-chrome" type="button" data-gallery-prev>Prev</button>
            <span class="gallery-count" data-gallery-count>1/${shots.length}</span>
            <button class="btn-chrome" type="button" data-gallery-next>Next</button>
          </div>
        </div>
      </section>`;
  }

  function section(title, id, inner, more) {
    return `
      <section class="block" id="${id}">
        <div class="block-head">
          <h2 class="block-title">${CJ.esc(title)}</h2>
          ${more ? `<a class="block-more" href="${CJ.pageUrl(more)}">See all</a>` : ""}
        </div>
        ${inner}
      </section>`;
  }

  async function render() {
    let entry;
    try {
      const manifest = await CJ.loadManifest();
      window.__manifest = manifest;
      entry = await CJ.loadEntry(CJ.findPage("home"));
    } catch (err) {
      main.innerHTML = `<div class="empty-state"><h2 class="empty-title">Build required</h2><p>${CJ.esc(err.message)}</p></div>`;
      return;
    }

    const c = window.siteConfig;
    document.title = `${c.siteName} | ${c.siteTagline}`;

    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content = entry.tagline || "";
    document.head.appendChild(meta);

    CJ.mountShell("home");

    const show = entry.meta.show || {};
    const shots = window.__manifest.carousel || [];

    const body = CJ.renderBody(entry);
    const blocks = [];

    if (show.teams) {
      const teams = byType("team").slice(0, show.teams);
      blocks.push(section("Teams and research groups", "teams", CJ.cardGrid(teams, { empty: "No teams published yet." }), "teams"));
    }
    if (body) blocks.push(body);
    if (show.events) {
      blocks.push(section("Upcoming", "upcoming", eventList(events(show.events)), "events"));
    }
    if (show.staff) {
      const staff = byType("staff").slice(0, show.staff);
      blocks.push(section("Officers and leads", "staff", CJ.cardGrid(staff, { empty: "No staff pages published yet." }), "staff"));
    }
    if (show.posts) {
      const latest = (window.__manifest.posts || [])
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
        .slice(0, show.posts);
      const rendered = await Promise.all(
        latest.map(async (p) => {
          const team = byType("team").find((t) => t.slug === p.page);
          return `
            <article class="post">
              <p class="post-kind">${p.date ? CJ.esc(p.date) : "Update"}${team ? ` | ${CJ.esc(team.title)}` : ""}</p>
              <a class="post-title" href="${CJ.pageUrl(p.page)}#post-${CJ.slugify(p.id)}">${CJ.esc(p.title)}</a>
              <p class="post-text">${CJ.esc(p.summary)}</p>
            </article>`;
        })
      );
      blocks.push(
        section(
          "Latest updates",
          "latest",
          rendered.length
            ? `<div class="post-list post-list-compact">${rendered.join("")}</div>`
            : `<div class="empty-state"><p>No updates published yet.</p></div>`
        )
      );
    }
    if (shots.length) blocks.push(carousel(shots));

    const homeBlocks = [hero(entry, c), ...blocks];
    homeBlocks.splice(show.teams ? 3 : 2, 0, joinBand());

    main.innerHTML = homeBlocks.join("");
    CJ.bindGallery(main);
    window.dispatchEvent(new Event("cj:render"));
  }

  function hero(entry, c) {
    return `
      <section class="hero hero-home">
        <div class="hero-inner">
          <div class="hero-copy">
            <p class="eyebrow">${CJ.esc(c.siteTagline || "")}</p>
            <h1 class="hero-title hero-title-lg">${CJ.esc(c.siteName || "Cyber Jedis")}</h1>
            <p class="hero-tagline">${CJ.esc(entry.tagline || "")}</p>
            <div class="btn-row">
              <a class="btn-chrome btn-primary" href="${CJ.pageUrl("teams")}">Explore teams</a>
              <a class="btn-chrome" href="${CJ.pageUrl("connect")}">Join us</a>
            </div>
          </div>
        </div>
      </section>`;
  }

  function joinBand() {
    const c = window.siteConfig;
    const discord = (c.socialLinks || {}).discord || "#";
    return `
      <section class="band" id="join">
        <div class="band-inner">
          <div>
            <h2 class="band-title">Come to a general meeting</h2>
            <p class="band-text">Fridays at ${CJ.esc(c.contact?.defaultMeetingTime || "6:00 PM")} in ${CJ.esc(c.contact?.defaultLocation || "NPB 1.226")}. No experience required.</p>
          </div>
          <div class="btn-row">
            <a class="btn-chrome btn-primary" href="${CJ.esc(discord)}">Join the Discord</a>
            <a class="btn-chrome" href="https://rowdylink.utsa.edu/organization/cyberjedis">RowdyLink</a>
          </div>
        </div>
      </section>`;
  }

  render();
})();
