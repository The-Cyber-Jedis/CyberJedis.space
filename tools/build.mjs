import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync, openSync, readSync, closeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES_DIR = path.join(ROOT, "PAGES");
const DATA_DIR = path.join(ROOT, "data");
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i;
const IGNORED = new Set(["media", "posts", "thumbs"]);
const DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

/* ---------------------------------------------------------------- utils */

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

function parseFrontmatter(text) {
  const m = /^\s*(?:<!--[\s\S]*?-->\s*)*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text, has: false };
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
  return { data, body: m[2], has: true };
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

const stripComments = (md) => String(md ?? "").replace(/<!--[\s\S]*?-->/g, "");

function plainText(md) {
  return stripComments(md)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+.*$/gm, " ")
    .replace(/^\s*[-*+]\s+/gm, " ")
    .replace(/^\s*>\s?/gm, " ")
    .replace(/[*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const firstSentence = (md) => {
  const t = plainText(withoutHead(md));
  const stop = t.search(/\.\s|\n/);
  const cut = stop > 0 ? t.slice(0, stop + 1) : t;
  return cut.length > 190 ? `${cut.slice(0, 187).trimEnd()}...` : cut;
};

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (IGNORED.has(e.name) || e.name.startsWith("_") || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.isFile()) out.push(full);
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
        return {
          width: 1 + (head[24] | (head[25] << 8) | (head[26] << 16)),
          height: 1 + (head[27] | (head[28] << 8) | (head[29] << 16))
        };
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

/* -------------------------------------------------------------- content */

/** Title comes from the first H1, falling back to the folder name. */
function titleOf(body, fallback) {
  const m = /^#\s+(.+)$/m.exec(stripComments(body));
  return m ? m[1].trim() : fallback;
}

/** Tagline comes from the first blockquote directly under the H1. */
function taglineOf(body) {
  const clean = stripComments(body).replace(/\r/g, "");
  const m = /^>\s*(.+)$/m.exec(clean);
  return m ? m[1].trim() : null;
}

/** Logo is whatever is named logo.* in media/, else the first image in the body. */
function logoRef(body) {
  const m = /!\[[^\]]*\]\(([^)]+)\)/.exec(stripComments(body));
  return m ? m[1].trim() : null;
}

/** Drops the leading H1 and blockquote so they are not repeated in summaries. */
function withoutHead(md) {
  return stripComments(md)
    .replace(/^\s*#\s+[^\n]*\n+/, "")
    .replace(/^\s*(?:>[^\n]*\n?)+/, "")
    .trim();
}

function sectionsOf(body) {
  return Array.from(stripComments(body).matchAll(/^##\s+(.+)$/gm)).map((m) =>
    slug(m[1].trim())
  );
}

const slug = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function derivative(rel, size) {
  const dir = path.posix.dirname(rel);
  const stem = path.basename(rel, path.extname(rel));
  const candidate = size ? `${dir}/thumbs/${size}/${stem}.jpg` : `${dir}/thumbs/${stem}.jpg`;
  return existsSync(path.join(ROOT, candidate)) ? candidate : rel;
}

async function collectMedia(dir) {
  const mediaDir = path.join(dir, "media");
  if (!existsSync(mediaDir)) return [];
  const files = (await walk(mediaDir)).filter((f) => IMAGE_RE.test(f));
  const items = [];
  for (const file of files.sort()) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const lg = derivative(rel, "");
    const sm = derivative(rel, "sm");
    const full = imageSize(path.join(ROOT, lg));
    const small = imageSize(path.join(ROOT, sm));
    items.push({
      file: rel,
      name: path.basename(file),
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

async function collectPosts(dir) {
  const postDir = path.join(dir, "posts");
  if (!existsSync(postDir)) return [];
  const out = [];
  for (const f of (await readdir(postDir)).filter((f) => f.endsWith(".md")).sort()) {
    const file = path.join(postDir, f);
    const { data, body } = parseFrontmatter(await readFile(file, "utf8"));
    out.push({
      id: f.replace(/\.md$/, ""),
      title: data.title || titleOf(body, f.replace(/\.md$/, "")),
      date: data.date || null,
      group: data.group || null,
      source: path.relative(ROOT, file).split(path.sep).join("/"),
      summary: firstSentence(body)
    });
  }
  return out;
}

async function pickSource(dir) {
  const entries = (await readdir(dir))
    .filter((f) => f.toLowerCase().endsWith(".md") && !f.startsWith("_"))
    .sort();
  if (!entries.length) return null;
  const stem = path.basename(dir).toLowerCase();
  return entries.find((f) => f.replace(/\.md$/i, "").toLowerCase() === stem) || entries[0];
}

/* ----------------------------------------------------------------- main */

async function readPage(dir, category, kind) {
  const source = await pickSource(dir);
  if (!source) return null;
  const file = path.join(dir, source);
  const raw = await readFile(file, "utf8");
  const { data, body } = parseFrontmatter(raw);
  const rel = path.relative(ROOT, dir).split(path.sep).join("/");
  const id = path.relative(PAGES_DIR, dir).split(path.sep).join("/").toLowerCase();
  const folder = path.basename(dir);
  const media = await collectMedia(dir);
  const declared = data.logo ? String(data.logo).split("/").pop() : null;
  const named = (media.find((m) => /^logo\./i.test(m.name)) || {}).name;
  const fromBody = logoRef(body);
  const only = media.length === 1 ? media[0].name : null;
  const wanted = declared || named || (fromBody ? path.basename(fromBody) : null) || only;
  const logo = wanted ? media.find((m) => m.name === wanted) : undefined;
  const title = data.title || titleOf(body, folder.replace(/[-_]/g, " ").toUpperCase());
  const posts = (await collectPosts(dir)).map((p) => ({
    ...p,
    page: id,
    owner: { title, slug: id }
  }));
  const text = plainText(body);
  return {
    slug: id,
    title,
    tagline: data.tagline || taglineOf(body) || null,
    summary: data.summary || firstSentence(body) || null,
    folder: category,
    category: data.category || null,
    kind: data.kind || null,
    division: data.division || null,
    tags: asArray(data.tags),
    order: typeof data.order === "number" ? data.order : 100,
    nav: data.nav === true,
    featured: data.featured !== false,
    accent: data.accent || null,
    logo: logo ? logo.lg : null,
    logoSm: logo ? logo.sm : null,
    logoWidth: logo ? logo.width : null,
    logoHeight: logo ? logo.height : null,
    logoWidthSm: logo ? logo.widthSm : null,
    contact: data.contact && typeof data.contact === "object" ? data.contact : null,
    media: media.filter((m) => m.name !== logo?.name),
    posts,
    source: path.relative(ROOT, file).split(path.sep).join("/"),
    dir: rel,
    sections: sectionsOf(body),
    words: text.split(/\s+/).filter(Boolean).length,
    empty: text.split(/\s+/).filter(Boolean).length === 0,
    updated: (await stat(file)).mtime.toISOString().slice(0, 10)
  };
}

async function readEvent(file) {
  const raw = await readFile(file, "utf8");
  const { data, body } = parseFrontmatter(raw);
  const base = path.basename(file, ".md");
  const m = DATE_PREFIX_RE.exec(base);
  const date = (data.date && String(data.date)) || (m ? m[1] : null);
  if (!date) return null;
  const slug = m ? m[2] : base;
  const time = data.time ? String(data.time) : null;
  const where = data.location ? String(data.location) : null;
  return {
    slug: `events/${slug}`,
    title: data.title || titleOf(body, slug.replace(/-/g, " ")),
    folder: "EVENTS",
    category: data.category || "Event",
    tagline: [date, time, where].filter(Boolean).join(" | "),
    summary: firstSentence(body),
    date,
    time,
    location: where,
    accent: data.accent || null,
    order: 1000,
    media: [],
    sections: sectionsOf(body),
    source: path.relative(ROOT, file).split(path.sep).join("/"),
    dir: path.relative(ROOT, path.dirname(file)).split(path.sep).join("/"),
    empty: plainText(body).split(/\s+/).filter(Boolean).length === 0,
    featured: true,
    updated: (await stat(file)).mtime.toISOString().slice(0, 10)
  };
}

async function main() {
  const categories = (await readdir(PAGES_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .map((d) => ({ name: d.name, dir: path.join(PAGES_DIR, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const pages = [];
  const events = [];
  const problems = [];
  const indexOf = new Map();

  for (const cat of categories) {
    if (cat.name === "EVENTS") {
      for (const f of (await readdir(cat.dir)).filter((f) => f.toLowerCase().endsWith(".md"))) {
        const ev = await readEvent(path.join(cat.dir, f));
        if (ev) events.push(ev);
        else problems.push(`event filename must start with YYYY-MM-DD-: ${path.relative(ROOT, path.join(cat.dir, f))}`);
      }
      continue;
    }
    const index = await readPage(cat.dir, cat.name, "index");
    if (index) {
      index.isIndex = true;
      index.indexFor = cat.name;
      indexOf.set(cat.name, index);
      pages.push(index);
    }
    const childDirs = (await readdir(cat.dir, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !IGNORED.has(d.name))
      .map((d) => path.join(cat.dir, d.name))
      .sort();
    for (const dir of childDirs) {
      const page = await readPage(dir, cat.name, "page");
      if (page) pages.push(page);
      else problems.push(`folder has no markdown file: ${path.relative(ROOT, dir)}`);
    }
  }

  pages.push(...events);
  pages.sort((a, b) => a.slug.localeCompare(b.slug));

  const manifest = {
    generated: new Date().toISOString().slice(0, 10),
    carousel: await collectCarousel(),
    indexes: Object.fromEntries(indexOf),
    pages,
    posts: pages.flatMap((p) => p.posts || [])
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  const counts = {
    pages: pages.length,
    indexes: indexOf.size,
    events: events.length,
    posts: manifest.posts.length,
    media: pages.reduce((n, p) => n + (p.media ? p.media.length : 0), 0),
    empty: pages.filter((p) => p.empty).length
  };
  console.log(`manifest: ${JSON.stringify(counts)}`);
  for (const p of problems) console.log(`problem: ${p}`);
  for (const p of pages.filter((x) => x.empty)) console.log(`needs content: ${p.slug}`);
}

async function collectCarousel() {
  const dir = path.join(ROOT, "MEDIA", "img", "carousel");
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => IMAGE_RE.test(f) && !f.startsWith("."));
  return files.sort().map((f) => {
    const rel = `MEDIA/img/carousel/${f}`;
    const lg = derivative(rel, "");
    return { file: rel, lg, sm: derivative(rel, "sm") };
  });
}

main();
