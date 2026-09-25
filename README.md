# Cyber Jedis site

Static site for the UTSA Cyber Jedis. No framework, no runtime server.
The site root is the repository root, served by GitHub Pages.

Bootstrap 5.3.3 is vendored in `assets/vendor/bootstrap`, not loaded from a
CDN. `styles.css` is the brand layer on top of it.

## Layout

```
PAGES/
  HOME/page.md                 homepage content and widgets
  CONNECT/page.md
  TEAMS/
    page.md                    index, groups every team by kind
    CWNS/
      page.md
      media/
      posts/
    QUANTUM/
      page.md
      posts/
    ORDER404/
      page.md
      media/
  STAFF/
    page.md                    index, groups every officer by division
    keeban-villareal/
      page.md                  one folder per officer
      media/
        headshot.png
    hondo-limon/
    gabriel-green/
    adithyaa-sivamal/
    vincent/
    ana-moreno/
  EVENTS/
    general-meeting.md         event data, no index page
```

**Every page is a `page.md` in its own folder.** A team and an officer are
structured identically, which is the whole point: adding either one is the
same three steps.

The URL is the folder path, so `PAGES/STAFF/ana-moreno/page.md` is served
at `page.html?p=staff/ana-moreno`.

## Adding or editing a page

1. Create the folder, for example `PAGES/TEAMS/NEWTEAM/`
2. Copy `TEMPLATES/WEBPAGE_TEMPLATE.md` to `page.md` in it
3. Fill in the frontmatter and the sections
4. Drop a `logo.png` into the `media/` folder
5. Drop any other images into the same folder, they appear in Gallery
6. Run `python3 tools/images.py` then `node tools/build.mjs`
7. Commit `page.md`, the media, the derivatives, and `data/manifest.json`

To hide a page without deleting it, set `published: false`.

## Frontmatter

| Key | Purpose |
| --- | --- |
| `title` | Page heading |
| `navLabel` | Shorter label for the site nav |
| `nav` | `true` puts the page in the primary nav |
| `order` | Sort weight for nav and index grids |
| `type` | `page`, `team`, `staff`, `event`, or `index` |
| `kind` | Label above the page title, such as `Research group` |
| `list` | On an `index` page, the child `type` to auto list |
| `listLabel` | Heading above the auto generated grid |
| `groupBy` | Frontmatter key to group the listing by, such as `division` |
| `category` | Grouping label, also filters index children |
| `division` | Grouping label for staff, used with `groupBy` |
| `tagline` | One line under the title |
| `summary` | One line used on cards |
| `tags` | `[tag-a, tag-b]` |
| `accent` | `amber`, `blaze`, `neon`, `violet`, `azure`, or a hex value |
| `logo` | Media file used as the mark, defaults to `logo.*` |
| `schedule` | Short meeting line shown in the hero |
| `links` | `key: url` pairs rendered as buttons |
| `contact` | `key: url` pairs rendered as a labelled contact block |
| `postsLabel` | Heading for the page's post list, defaults to Updates |
| `show` | Homepage widgets, for example `teams: 6, posts: 3` |
| `published` | `false` hides the page from all listings |

`##` headings in `page.md` become page sections in order. `## Gallery` is
special and fills itself from the media folder.

Relative links and images in `page.md` are resolved against that page's
own folder, so `media/headshot.png` works wherever the page is served
from.

## Adding an officer

1. Create `PAGES/STAFF/<name>/`
2. Copy `TEMPLATES/WEBPAGE_TEMPLATE.md` to `page.md` in it
3. Set `type: staff`, `kind:` for the role, `division:` for the group
4. Drop a headshot in `media/` and set `logo: media/<file>`
5. Put their links in `contact:` and write the bio under the frontmatter
6. Build and commit as usual

They appear on the staff index under their division, and the card links to
their page. No headshot yet is fine, the card falls back to a generated
initials avatar.

Roles live on the officer's page, not on the team page, so a role change is
one edit in one file.

## Images

`tools/images.py` writes two JPEG derivatives next to every source image
and never modifies the original:

| Path | Long edge | Used by |
| --- | --- | --- |
| `thumbs/<name>.jpg` | 1400 | gallery |
| `thumbs/sm/<name>.jpg` | 560 | cards, avatars, marks |

Photographic PNGs are re-encoded as JPEG, since a photo kept as PNG is
several times larger for the same pixels. Aspect ratio is never changed,
so nothing is cropped. Derivatives are committed and CI fails if they are
stale.

## Events

Drop a file into `PAGES/EVENTS/` with a `date` or `recurring` in the
frontmatter. Events show on the homepage and are addressable at
`page.html?p=events/<file>`. There is no events index page.

## Posts

Team posts live in `PAGES/<TEAM FOLDER>/posts/*.md`. They appear on the
team page and in the homepage updates widget.

## Build

```
python3 tools/images.py      # regenerate image derivatives
node tools/build.mjs         # regenerate data/manifest.json
```

`build.mjs` scans `PAGES/`, writes `data/manifest.json`, and lists any
page that needs content. CI fails if either output is out of date.

## Preview

```
python3 localdev.py 8000
```

## Root files

| File | Purpose |
| --- | --- |
| `index.html` | Homepage shell, reads `PAGES/HOME/page.md` |
| `page.html` | Renders any page from `?p=<folder path>` |
| `styles.css` | Brand layer on top of Bootstrap |
| `site.js` | Shared rendering helpers |
| `config.js` | Site name, links, theme, particles |
| `home.js` | Homepage widgets |
| `page.js` | Page router |
| `bg-effect.js` | Hero particle effect |
| `404.html` | Not found page |
