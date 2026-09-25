(() => {
  const main = document.getElementById("main");
  const params = new URLSearchParams(location.search);
  const slug = (params.get("p") || "home").toLowerCase();

  function setTitle(text) {
    document.title = `${text} | ${window.siteConfig.siteName}`;
    document.querySelector('meta[name="description"]')?.remove();
    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content = text;
    document.head.appendChild(meta);
  }

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

    setTitle(entry.tagline || entry.summary || entry.title);
    CJ.mountShell(entry.slug);

    const parts = [CJ.hero(entry)];
    if (entry.empty) {
      parts.push(CJ.emptyState(entry));
    } else {
      parts.push(CJ.renderBody(entry));
      parts.push(await CJ.postsBlock(entry.slug, entry.postsLabel));
    }
    if (entry.list) parts.push(CJ.renderIndex(entry));

    main.innerHTML = `<div class="container">${parts.join("")}</div>`;
    CJ.bindGallery(main);
    CJ.bindFilters(main);
    CJ.bindPeople(main);
    if (entry.published === false) main.classList.add("cj-unpublished");
  }

  function notFound(slug) {
    setTitle("Page not found");
    CJ.mountShell("");
    main.innerHTML = `
      <section class="cj-hero">
        <div class="container">
          <p class="cj-eyebrow">404</p>
          <h1>Page not found</h1>
          <p class="cj-hero-lede">No page is registered at <code>${CJ.esc(slug)}</code>.</p>
          <div class="d-flex flex-wrap gap-2 mt-4">
            <a class="btn btn-jedis btn-lg" href="index.html">Home</a>
            <a class="btn btn-outline-jedis btn-lg" href="${CJ.pageUrl("teams")}">Teams</a>
            <a class="btn btn-outline-jedis btn-lg" href="${CJ.pageUrl("staff")}">Staff</a>
          </div>
        </div>
      </section>`;
  }

  function failure(err) {
    setTitle("Build required");
    main.innerHTML = `
      <div class="container">
        <section class="cj-block">
          <div class="cj-empty">
            <h2>Build required</h2>
            <p class="mb-0">${CJ.esc(err.message)}</p>
          </div>
        </section>
      </div>`;
  }

  render();
})();
