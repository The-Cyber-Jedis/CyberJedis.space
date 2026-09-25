# Cyber Jedis site

Static site for the UTSA Cyber Jedis. No framework, no runtime server.
The site root is the repository root, served by GitHub Pages.

## Adding or editing a page

Every page is one folder under `PAGES/`. One folder equals one page.

```
PAGES/
  CWNS/
    page.md
    media/
      logo.png
      photo.jpg
  PEOPLE/
    ana-moreno/
      page.md
      media/
        headshot.jpg
```

To add a page:

1. Create `PAGES/<FOLDER>/`
2. Copy `TEMPLATES/WEBPAGE_TEMPLATE.md` to `PAGES/<FOLDER>/page.md`
3. Fill in the frontmatter and the sections
4. Drop a `logo.png` into `PAGES/<FOLDER>/media/`
5. Drop any other images into the same folder, they appear in Gallery
6. Run `node tools/build.mjs`
7. Commit `page.md`, the media, and `data/manifest.json`

To hide a page without deleting it, set `published: false` in the frontmatter.

## Frontmatter

| Key | Purpose |
| --- | --- |
| `title` | Page heading |
| `navLabel` | Shorter label for the site nav |
| `nav` | `true` puts the page in the primary nav |
| `order` | Sort weight for nav and index grids |
| `type` | `page`, `team`, `staff`, `event`, or `index` |
| `list` | On an `index` page, the child `type` to auto list |
| `listLabel` | Heading above the auto generated grid |
| `category` | Grouping label, also filters index children |
| `tags` | `[tag-a, tag-b]` |
| `accent` | `amber`, `blaze`, `neon`, `violet`, `azure`, or a hex value |
| `logo` | Media file used as the mark, defaults to `logo.*` |
| `links` | `key: url` pairs rendered as buttons |
| `show` | Homepage widgets, for example `teams: 6` |
| `published` | `false` hides the page from all listings |

## Sections

`##` headings in `page.md` become page sections in order. `## Gallery` is
special and fills itself from the media folder.

## Events

Drop a markdown file into `PAGES/EVENTS/` with a `date`, run the build, and
it appears on the events page and the homepage. Use `recurring: Friday`
instead of a date for weekly meetings.

## Posts

Team posts live in `PAGES/<TEAM>/posts/*.md`. Filenames sort oldest first
when numbered, for example `QPost_001.md`.

## Build

```
node tools/build.mjs
```

This scans `PAGES/`, writes `data/manifest.json`, and lists any folder that
needs content. CI fails if the committed manifest is out of date.

## Preview

```
python3 localdev.py 8000
```

## Root files

| File | Purpose |
| --- | --- |
| `index.html` | Homepage shell, reads `PAGES/HOME/page.md` |
| `page.html` | Renders any page from `?p=<folder>` |
| `styles.css` | Design tokens and all layout |
| `site.js` | Shared rendering helpers |
| `config.js` | Site name, links, theme, particles |
| `home.js` | Homepage widgets |
| `page.js` | Page router |
| `bg-effect.js` | Hero particle effect |
| `404.html` | Not found page |
