(() => {
  const main = document.getElementById("main");
  const c = window.siteConfig;

  const pages = () => window.__manifest?.pages || [];
  const byFolder = (name) =>
    pages()
      .filter((p) => p.folder === name && !p.isIndex && p.featured !== false)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  const index = (name) => pages().find((p) => p.isIndex && p.indexFor === name);

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
    const all = pages()
      .filter((p) => p.folder === "EVENTS" && p.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = all.filter((e) => e.date >= today);
    return (upcoming.length ? upcoming : all).slice(0, limit);
  }

  function eventList(items) {
    if (!items.length) return `<div class="cj-empty"><p class="mb-0">No events scheduled yet.</p></div>`;
    return `<div class="d-flex flex-column gap-2 cj-reveal">${items
      .map(
        (e) => `
      <div class="cj-event" style="--cj-accent:${CJ.accentOf(e)}">
        <div class="cj-event-when">
          <span class="cj-event-date">${CJ.esc(fmtDate(e.date))}</span>
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
    const discord = c.socialLinks?.discord || "#";
    return `
      <section class="cj-cta">
        <div class="row g-4 align-items-center">
          <div class="col-lg">
            <h2>Come to a general meeting</h2>
            <p>${CJ.esc(c.contact?.meetingDay || "Friday")} at ${CJ.esc(
      c.contact?.defaultMeetingTime || "6:00 PM"
    )} in ${CJ.esc(c.contact?.defaultLocation || "NPB 1.226")}. No experience required.</p>
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

  function hero(entry) {
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
      window.__manifest = await CJ.loadManifest();
      entry = await CJ.loadEntry(CJ.findPage("home"));
    } catch (err) {
      main.innerHTML = `<div class="container"><div class="cj-empty mt-5"><h2>Something went wrong</h2><p class="mb-0">${CJ.esc(
        err.message
      )}</p></div></div>`;
      return;
    }

    document.title = `${c.siteName} | ${c.siteTagline}`;
    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content = entry.tagline || "";
    document.head.appendChild(meta);

    CJ.mountShell("home");

    const out = [hero(entry)];

    const body = CJ.renderBody(entry);
    if (body) out.push(`<div class="container">${body}</div>`);

    out.push(`<div class="container">${joinBand()}</div>`);

    const wrap = (inner) => `<div class="container">${inner}</div>`;
    const teamsIndex = index("TEAMS");
    const officersIndex = index("OFFICERS");
    const shots = window.__manifest.carousel || [];

    const teams = byFolder("TEAMS");
    if (teamsIndex && teams.length) {
      out.push(wrap(CJ.block("Teams and research groups", CJ.cardGrid(teams), "teams")));
    }

    const officers = byFolder("OFFICERS");
    if (officersIndex && officers.length) {
      out.push(
        wrap(
          CJ.block(
            "Officers",
            `<div class="row row-cols-2 row-cols-sm-3 row-cols-lg-6 g-3 cj-reveal">${officers
              .map((o) => `<div class="col">${CJ.card(o)}</div>`)
              .join("")}</div>`,
            "officers"
          )
        )
      );
    }

    const ev = events(3);
    if (ev.length) out.push(wrap(CJ.block("Upcoming", eventList(ev))));

    const latest = (window.__manifest.posts || [])
      .slice()
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 3);
    if (latest.length) {
      const cards = latest
        .map((p) => {
          const owner = pages().find((x) => x.slug === p.page);
          return `
          <div class="col">
            <article class="cj-post">
              <p class="cj-post-kind">${p.date ? CJ.esc(p.date) : "Update"}${
            owner?.title ? ` | ${CJ.esc(owner.title)}` : ""
          }</p>
              <a class="cj-post-title" href="${CJ.pageUrl(p.page)}#post-${CJ.slugify(p.id)}">${CJ.esc(p.title)}</a>
              <p class="cj-post-text">${CJ.esc(p.summary || "")}</p>
            </article>
          </div>`;
        })
        .join("");
      out.push(
        wrap(CJ.block("Latest updates", `<div class="row row-cols-1 row-cols-sm-3 g-3 cj-reveal">${cards}</div>`))
      );
    }

    if (shots.length) out.push(wrap(CJ.block("From around the organization", carousel(shots))));

    main.innerHTML = out.join("");
    CJ.bindGallery(main);
    window.dispatchEvent(new Event("cj:render"));
  }

  render();
})();
