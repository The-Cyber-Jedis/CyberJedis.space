import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
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

async function collectMedia(pageDir) {
  const mediaDir = path.join(pageDir, "media");
  if (!existsSync(mediaDir)) return [];
  const files = (await walk(mediaDir)).filter((f) => IMAGE_RE.test(f));
  const items = [];
  for (const file of files.sort()) {
    const s = await stat(file);
    items.push({
      file: path.relative(ROOT, file).split(path.sep).join("/"),
      name: path.basename(file),
      bytes: s.size
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
  const logo = logoName ? media.find((m) => m.name === logoName) : undefined;
  const title = data.title || slug.split("/").pop().replace(/-/g, " ").toUpperCase();
  const sections = Array.from(body.matchAll(/^##\s+(.+)$/gm)).map((m) => slugify(m[1]));
  const text = plainText(body);
  return {
    slug,
    title,
    navLabel: data.navLabel || null,
    nav: Boolean(data.nav),
    tagline: data.tagline || firstSentence(body) || null,
    summary: data.summary || null,
    type: data.type || "page",
    list: data.list || null,
    listLabel: data.listLabel || null,
    category: data.category || null,
    tags: asArray(data.tags),
    order: typeof data.order === "number" ? data.order : 100,
    accent: accentHex(data.accent),
    logo: logo ? logo.file : null,
    postsLabel: data.postsLabel || null,
    media: media.filter((m) => m.name !== logoName),
    source: path.relative(ROOT, mdPath).split(path.sep).join("/"),
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
      title: data.title || f.replace(/\.md$/, ""),
      date: data.date || null,
      group: data.group || null,
      source: path.relative(ROOT, path.join(dir, f)).split(path.sep).join("/"),
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
      kind: data.kind || "meeting",
      tagline: [data.recurring ? `Every ${data.recurring}` : data.date, when, where]
        .filter(Boolean)
        .join(" | "),
      summary: firstSentence(body),
      accent: accentHex(data.accent) || ACCENTS.amber,
      order: 1000,
      media: [],
      source: path.relative(ROOT, file).split(path.sep).join("/"),
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
  const files = (await readdir(dir)).filter((f) => IMAGE_RE.test(f)).sort();
  return files.map((f) => `MEDIA/img/carousel/${f}`);
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
