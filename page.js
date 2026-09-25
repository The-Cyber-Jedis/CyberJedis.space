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
      if (!stub) return notFound();
      entry = await CJ.loadEntry(stub);
    } catch (err) {
      return failure(err);
    }

    setTitle(entry.tagline || entry.title);
    CJ.mountShell(entry.slug);

    const parts = [CJ.hero(entry)];
    if (entry.empty) {
      parts.push(CJ.emptyState());
    } else {
      parts.push(CJ.renderBody(entry));
      parts.push(CJ.postsBlock(entry));
    }
    if (entry.isIndex) parts.push(CJ.renderIndex(entry));

    main.innerHTML = `<div class="container">${parts.join("")}</div>`;
    CJ.bindGallery(main);
    CJ.bindFilters(main);
  }

  function notFound() {
    setTitle("Page not found");
    CJ.mountShell("");
    main.innerHTML = `
      <section class="cj-hero">
        <div class="container">
          <p class="cj-eyebrow">404</p>
          <h1>Page not found</h1>
          <p class="cj-hero-lede">That address does not match a page on this site.</p>
          <div class="d-flex flex-wrap gap-2 mt-4">
            <a class="btn btn-jedis btn-lg" href="index.html">Home</a>
            <a class="btn btn-outline-jedis btn-lg" href="${CJ.pageUrl("teams")}">Teams</a>
            <a class="btn btn-outline-jedis btn-lg" href="${CJ.pageUrl("officers")}">Officers</a>
          </div>
        </div>
      </section>`;
  }

  function failure(err) {
    setTitle("Something went wrong");
    main.innerHTML = `
      <div class="container">
        <section class="cj-block">
          <div class="cj-empty">
            <h2>Something went wrong</h2>
            <p class="mb-0">${CJ.esc(err.message)}</p>
          </div>
        </section>
      </div>`;
  }

  render();
})();
