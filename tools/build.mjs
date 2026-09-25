import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync, openSync, readSync, closeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_DIR = path.join(ROOT, "PAGES");
const DATA_DIR = path.join(ROOT, "data");
const SKIP_DIRS = new Set(["media", "posts"]);
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i;

const ACCENTS = {
  chrome: "#c0c0c0",
  amber: "#ffbe0b",
  blaze: "#fb5607",
  neon: "#ff006e",
  violet: "#8338ec",
  azure: "#3a86ff"
};

function accentHex(value) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  if (ACCENTS[key]) return ACCENTS[key];
  if (/^#[0-9a-f]{3,8}$/i.test(key)) return key;
  return null;
}

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  const data = {};
  let key = null;
  for (const raw of m[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const kv = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(raw);
    if (!kv) continue;
    const name = kv[1];
    const value = kv[2].trim();
    if (/^\s/.test(raw) && key) {
      if (typeof data[key] !== "object" || data[key] === null) data[key] = {};
      data[key][name] = coerce(value);
      continue;
    }
    key = name;
    data[key] = value === "" ? {} : coerce(value);
  }
  return { data, body: m[2] };
}

function coerce(v) {
  if (/^\[.*\]$/.test(v)) {
    return v.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v.replace(/^["']|["']$/g, "");
}

function plainText(md) {
  return md
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^>.*$/gm, " ")
    .replace(/^[#\-*\+|>\s]+/gm, " ")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(md) {
  const text = plainText(md);
  const stop = text.search(/\.\s|\n/);
  const cut = stop > 0 ? text.slice(0, stop + 1) : text;
  return cut.length > 180 ? `${cut.slice(0, 177).trimEnd()}...` : cut;
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function imageSize(file) {
  let fd;
  try {
    fd = openSync(file, "r");
    const head = Buffer.alloc(65536);
    const read = readSync(fd, head, 0, head.length, 0);
    if (read < 24) return null;

    if (head[0] === 0x89 && head[1] === 0x50) {
      return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
    }
    if (head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") {
      const kind = head.toString("ascii", 12, 16);
      if (kind === "VP8 " && read >= 30) {
        return { width: head.readUInt16LE(26) & 0x3fff, height: head.readUInt16LE(28) & 0x3fff };
      }
      if (kind === "VP8L" && read >= 25) {
        const bits = head.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (kind === "VP8X" && read >= 30) {
        const w = 1 + (head[24] | (head[25] << 8) | (head[26] << 16));
        const h = 1 + (head[27] | (head[28] << 8) | (head[29] << 16));
        return { width: w, height: h };
      }
      return null;
    }
    if (head[0] === 0xff && head[1] === 0xd8) {
      let i = 2;
      while (i + 9 < read) {
        if (head[i] !== 0xff) {
          i += 1;
          continue;
        }
        const marker = head[i + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          i += 2;
          continue;
        }
        const len = head.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { width: head.readUInt16BE(i + 7), height: head.readUInt16BE(i + 5) };
        }
        i += 2 + len;
      }
      return null;
    }
    if (head.toString("ascii", 0, 3) === "GIF") {
      return { width: head.readUInt16LE(6), height: head.readUInt16LE(8) };
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function derivative(rel, size) {
  const dir = path.posix.dirname(rel);
  const stem = path.basename(rel, path.extname(rel));
  const candidate = size ? `${dir}/thumbs/${size}/${stem}.jpg` : `${dir}/thumbs/${stem}.jpg`;
  return existsSync(path.join(ROOT, candidate)) ? candidate : rel;
}

async function collectMedia(pageDir) {
  const mediaDir = path.join(pageDir, "media");
  if (!existsSync(mediaDir)) return [];
  const files = (await walk(mediaDir)).filter(
    (f) => IMAGE_RE.test(f) && !f.split(path.sep).includes("thumbs")
  );
  const items = [];
  for (const file of files.sort()) {
    const s = await stat(file);
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const lg = derivative(rel, "");
    const sm = derivative(rel, "sm");
    const full = imageSize(path.join(ROOT, lg));
    const small = imageSize(path.join(ROOT, sm));
    items.push({
      file: rel,
      name: path.basename(file),
      bytes: s.size,
      lg,
      sm,
      width: full?.width ?? null,
      height: full?.height ?? null,
      widthSm: small?.width ?? null,
      heightSm: small?.height ?? null
    });
  }
  return items;
}

async function readPage(pageDir) {
  const mdPath = path.join(pageDir, "page.md");
  if (!existsSync(mdPath)) return null;
  const raw = await readFile(mdPath, "utf8");
  const { data, body } = parseFrontmatter(raw);
  const slug = path.relative(PAGES_DIR, pageDir).split(path.sep).join("/").toLowerCase();
  const media = await collectMedia(pageDir);
  const logoName = data.logo
    ? String(data.logo).split("/").pop()
    : (media.find((m) => /^logo\./i.test(m.name)) || {}).name;
  const logoMedia = logoName ? media.find((m) => m.name === logoName) : undefined;
  const title = data.title || slug.split("/").pop().replace(/-/g, " ").toUpperCase();
  const sections = Array.from(body.matchAll(/^##\s+(.+)$/gm)).map((m) => slugify(m[1]));
  const text = plainText(body);
  return {
    slug,
    title,
    kind: data.kind || null,
    navLabel: data.navLabel || null,
    nav: Boolean(data.nav),
    tagline: data.tagline || null,
    summary: data.summary || null,
    type: data.type || "page",
    list: data.list || null,
    listLabel: data.listLabel || null,
    groupBy: data.groupBy || null,
    category: data.category || null,
    division: data.division || null,
    tags: asArray(data.tags),
    order: typeof data.order === "number" ? data.order : 100,
    accent: accentHex(data.accent),
    logo: logoMedia ? logoMedia.lg : null,
    logoSm: logoMedia ? logoMedia.sm : null,
    postsLabel: data.postsLabel || null,
    contact: data.contact && typeof data.contact === "object" ? data.contact : null,
    media: media.filter((m) => m.name !== logoName),
    source: path.relative(ROOT, mdPath).split(path.sep).join("/"),
    dir: path.relative(ROOT, pageDir).split(path.sep).join("/"),
    sections,
    words: text.split(/\s+/).filter(Boolean).length,
    empty: words(text) === 0,
    published: data.published === false ? false : true,
    updated: (await stat(mdPath)).mtime.toISOString().slice(0, 10)
  };
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;

async function collectPosts(page) {
  const dir = path.join(PAGES_DIR, ...page.slug.split("/").map((s) => s.toUpperCase()), "posts");
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const posts = [];
  for (const f of files) {
    const raw = await readFile(path.join(dir, f), "utf8");
    const { data, body } = parseFrontmatter(raw);
    posts.push({
      id: f.replace(/\.md$/, ""),
      page: page.slug,
      dir: path.relative(ROOT, dir).split(path.sep).join("/"),
      title: data.title || f.replace(/\.md$/, ""),
      date: data.date || null,
      group: data.group || null,
      source: path.relative(ROOT, path.join(dir, f)).split(path.sep).join("/"),
      dir: path.relative(ROOT, dir).split(path.sep).join("/"),
      summary: firstSentence(body)
    });
  }
  return posts;
}

async function collectEvents() {
  const dir = path.join(PAGES_DIR, "EVENTS");
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const events = [];
  for (const f of files) {
    const file = path.join(dir, f);
    const raw = await readFile(file, "utf8");
    const { data, body } = parseFrontmatter(raw);
    if (!data.date && !data.recurring) continue;
    const id = f.replace(/\.md$/, "");
    const when = data.time ? String(data.time) : null;
    const where = data.location ? String(data.location) : null;
    events.push({
      slug: `events/${id}`,
      title: data.title || id.replace(/-/g, " ").toUpperCase(),
      type: "event",
      date: data.date ? String(data.date) : null,
      recurring: data.recurring ? String(data.recurring) : null,
      endDate: data.endDate ? String(data.endDate) : null,
      time: when,
      location: where,
      kind: null,
      category: data.category || "meeting",
      division: null,
      contact: null,
      tagline: [data.recurring ? `Every ${data.recurring}` : data.date, when, where]
        .filter(Boolean)
        .join(" | "),
      summary: firstSentence(body),
      accent: accentHex(data.accent) || ACCENTS.amber,
      order: 1000,
      media: [],
      source: path.relative(ROOT, file).split(path.sep).join("/"),
      dir: path.relative(ROOT, dir).split(path.sep).join("/"),
      sections: Array.from(body.matchAll(/^##\s+(.+)$/gm)).map((m) => slugify(m[1])),
      words: words(plainText(body)),
      empty: words(plainText(body)) === 0,
      published: data.published === false ? false : true,
      updated: (await stat(file)).mtime.toISOString().slice(0, 10)
    });
  }
  events.sort((a, b) => {
    const ad = a.date || a.recurring || "zzzz";
    const bd = b.date || b.recurring || "zzzz";
    return ad.localeCompare(bd);
  });
  return events;
}

async function collectCarousel() {
  const dir = path.join(ROOT, "MEDIA", "img", "carousel");
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => IMAGE_RE.test(f) && !f.startsWith("."));
  return files
    .sort()
    .map((f) => `MEDIA/img/carousel/${f}`)
    .map((rel) => ({ file: rel, lg: derivative(rel, ""), sm: derivative(rel, "sm") }));
}

async function pageDirs(dir, depth = 0) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name.toLowerCase())) continue;
    const full = path.join(dir, entry.name);
    out.push(full, ...(await pageDirs(full, depth + 1)));
  }
  return out;
}

async function build() {
  const pages = [];
  for (const dir of await pageDirs(PAGES_DIR)) {
    if (existsSync(path.join(dir, "page.md"))) pages.push(await readPage(dir));
  }

  pages.sort((a, b) => a.slug.localeCompare(b.slug));

  const posts = [];
  for (const page of pages) posts.push(...(await collectPosts(page)));

  const events = await collectEvents();
  pages.push(...events);
  pages.sort((a, b) => a.slug.localeCompare(b.slug));

  const manifest = {
    generated: new Date().toISOString().slice(0, 10),
    carousel: await collectCarousel(),
    pages,
    posts
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const counts = {
    pages: pages.length,
    empty: pages.filter((p) => p.empty && p.type !== "index").length,
    posts: posts.length,
    events: events.length,
    media: pages.reduce((n, p) => n + (p.media ? p.media.length : 0), 0)
  };

  console.log(`manifest: ${JSON.stringify(counts)}`);
  for (const p of pages.filter((x) => x.empty && x.type !== "index")) {
    console.log(`needs content: ${p.slug}`);
  }
}

build();
