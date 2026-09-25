(() => {
  const main = document.getElementById("main");
  const pages = () => (window.__manifest?.pages || []);

  const byType = (type, extra) =>
    pages()
      .filter((p) => p.type === type && p.published !== false)
      .filter(extra || (() => true));

  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
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
    if (!items.length) return `<div class="cj-empty"><p class="mb-0">No events scheduled yet.</p></div>`;
    return `<div class="d-flex flex-column gap-2 cj-reveal">${items
      .map(
        (e) => `
      <div class="cj-event" style="--cj-accent:${CJ.accentOf(e)}">
        <div class="cj-event-when">
          <span class="cj-event-date">${e.date ? CJ.esc(fmtDate(e.date)) : CJ.esc(`Every ${e.recurring}`)}</span>
          ${e.time ? `<span class="cj-event-time">${CJ.esc(fmtTime(e.time))}</span>` : ""}
        </div>
        <div class="cj-event-body">
          <a class="cj-event-title" href="${CJ.pageUrl(e.slug)}">${CJ.esc(e.title)}</a>
          ${e.location ? `<span class="cj-event-where">${CJ.esc(e.location)}</span>` : ""}
          ${e.summary ? `<span class="cj-event-text">${CJ.esc(e.summary)}</span>` : ""}
        </div>
      </div>`
      )
      .join("")}</div>`;
  }

  function carousel(shots) {
    if (!shots.length) return "";
    return `
      <div class="cj-gallery" data-gallery>
        <div class="cj-gallery-stage">
          ${shots
            .map(
              (s, i) =>
                `<figure class="cj-gallery-slide${i === 0 ? " active" : ""}">` +
                `<img src="${CJ.esc(s.lg || s.file)}" alt="Cyber Jedis photo ${i + 1}" loading="lazy" decoding="async"></figure>`
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

  function joinBand() {
    const c = window.siteConfig;
    const discord = c.socialLinks?.discord || "#";
    return `
      <section class="cj-cta">
        <div class="row g-4 align-items-center">
          <div class="col-lg">
            <h2>Come to a general meeting</h2>
            <p>${CJ.esc(c.contact?.meetingDay || "Friday")} at ${CJ.esc(c.contact?.defaultMeetingTime || "6:00 PM")} in ${CJ.esc(
      c.contact?.defaultLocation || "NPB 1.226"
    )}. No experience required.</p>
          </div>
          <div class="col-lg-auto">
            <div class="d-flex flex-wrap gap-2">
              <a class="btn btn-lg btn-jedis" style="--cj-accent:#8338ec" href="${CJ.esc(discord)}">Join the Discord</a>
              <a class="btn btn-lg btn-outline-jedis" style="--cj-accent:#8338ec" href="https://rowdylink.utsa.edu/organization/cyberjedis">RowdyLink</a>
            </div>
          </div>
        </div>
      </section>`;
  }

  function hero(entry, c) {
    return `
      <section class="cj-hero cj-hero-home">
        <div class="container">
          <div class="row">
            <div class="col-lg-8">
              <p class="cj-eyebrow">${CJ.esc(c.siteTagline || "")}</p>
              <h1>${CJ.esc(c.siteName || "Cyber Jedis")}</h1>
              <p class="cj-hero-lede">${CJ.esc(entry.tagline || "")}</p>
              <div class="d-flex flex-wrap gap-2 mt-4">
                <a class="btn btn-jedis btn-lg" style="--cj-accent:#ffbe0b" href="${CJ.pageUrl("teams")}">Explore teams</a>
                <a class="btn btn-outline-jedis btn-lg" href="${CJ.pageUrl("connect")}">Join us</a>
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  async function render() {
    let entry;
    try {
      const m = await CJ.loadManifest();
      window.__manifest = m;
      entry = await CJ.loadEntry(CJ.findPage("home"));
    } catch (err) {
      main.innerHTML = `<div class="container"><div class="cj-empty mt-5"><h2>Build required</h2><p class="mb-0">${CJ.esc(
        err.message
      )}</p></div></div>`;
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
    const out = [hero(entry, c)];

    const body = CJ.renderBody(entry);
    if (body) out.push(`<div class="container">${body}</div>`);

    out.push(`<div class="container">${joinBand()}</div>`);

    const block = (title, inner, more) => `<div class="container">${CJ.block(title, inner, more)}</div>`;

    if (show.teams) {
      const teams = byType("team").slice(0, show.teams);
      out.push(block("Teams and research groups", CJ.cardGrid(teams, { empty: "No teams published yet." }), "teams"));
    }

    if (show.events) {
      out.push(block("Upcoming", eventList(events(show.events))));
    }

    if (show.staff) {
      const officers = byType("staff").slice(0, show.staff);
      out.push(
        block(
          "Officers",
          officers.length
            ? `<div class="row row-cols-2 row-cols-sm-3 row-cols-lg-6 g-3 cj-reveal">` +
              officers.map((o) => `<div class="col">${CJ.card(o)}</div>`).join("") +
              `</div>`
            : `<div class="cj-empty"><p class="mb-0">No officers listed yet.</p></div>`,
          "staff"
        )
      );
    }

    if (show.posts) {
      const latest = (window.__manifest.posts || [])
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
        .slice(0, show.posts);
      const cards = latest
        .map((p) => {
          const team = byType("team").find((t) => t.slug === p.page);
          return `
          <div class="col">
            <article class="cj-post">
              <p class="cj-post-kind">${p.date ? CJ.esc(p.date) : "Update"}${team ? ` | ${CJ.esc(team.title)}` : ""}</p>
              <a class="cj-post-title" href="${CJ.pageUrl(p.page)}#post-${CJ.slugify(p.id)}">${CJ.esc(p.title)}</a>
              <p class="cj-post-text">${CJ.esc(p.summary)}</p>
            </article>
          </div>`;
        })
        .join("");
      out.push(
        block(
          "Latest updates",
          cards
            ? `<div class="row row-cols-1 row-cols-sm-3 g-3 cj-reveal">${cards}</div>`
            : `<div class="cj-empty"><p class="mb-0">No updates published yet.</p></div>`
        )
      );
    }

    if (shots.length) {
      out.push(block("From around the organization", carousel(shots)));
    }

    main.innerHTML = out.join("");
    CJ.bindGallery(main);
    window.dispatchEvent(new Event("cj:render"));
  }

  render();
})();
