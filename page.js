(() => {
  const main = document.getElementById("main");

  const params = new URLSearchParams(location.search);
  const slug = (params.get("p") || "home").toLowerCase();

  async function render() {
    let entry;
    try {
      await CJ.loadManifest();
      const stub = CJ.findPage(slug);
      if (!stub) return notFound(slug);
      entry = await CJ.loadEntry(stub);
    } catch (err) {
      return failure(err);
    }

    document.title = `${entry.title} | ${window.siteConfig.siteName}`;
    document.querySelector('meta[name="description"]')?.remove();
    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content = entry.tagline || entry.summary || "";
    document.head.appendChild(meta);

    CJ.mountShell(entry.slug);

    const parts = [CJ.hero(entry)];
    if (entry.empty) parts.push(CJ.emptyState(entry));
    else {
      parts.push(CJ.renderBody(entry));
      parts.push(await CJ.postsBlock(entry.slug, entry.postsLabel));
    }
    if (entry.list) parts.push(CJ.renderIndex(entry));

    main.innerHTML = parts.join("");
    CJ.bindGallery(main);
    CJ.bindFilters(main);
    if (entry.published === false) main.classList.add("unpublished");
    window.dispatchEvent(new Event("cj:render"));
  }

  function notFound(slug) {
    document.title = `Not found | ${window.siteConfig.siteName}`;
    main.innerHTML = `
      <section class="hero">
        <div class="hero-inner">
          <div class="hero-copy">
            <p class="eyebrow">404</p>
            <h1 class="hero-title">Page not found</h1>
            <p class="hero-tagline">No page is registered at <code>${CJ.esc(slug)}</code>.</p>
            <div class="btn-row">
              <a class="btn-chrome" href="${CJ.pageUrl("home")}">Home</a>
              <a class="btn-chrome" href="${CJ.pageUrl("teams")}">Teams</a>
            </div>
          </div>
        </div>
      </section>`;
  }

  function failure(err) {
    main.innerHTML = `
      <section class="block">
        <div class="empty-state">
          <h2 class="empty-title">Build required</h2>
          <p>${CJ.esc(err.message)}</p>
        </div>
      </section>`;
  }

  render();
})();
