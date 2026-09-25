# Cyber Jedis site

Static site for the UTSA Cyber Jedis. No framework, no runtime server.
The site root is the repository root, served by GitHub Pages.

Bootstrap 5.3.3 is vendored in `assets/vendor/bootstrap`, not loaded from a
CDN. `styles.css` is the brand layer on top of it.

## The one rule

**Every page is one markdown file in its own folder.**

```
PAGES/
  HOME/
    HOME.md                  index.html renders this
  CONNECT/
    CONNECT.md
  TEAMS/
    TEAMS.md                 this folder is the teams catalog
    CWNS/
      CWNS.md                a team page
      media/                 logo + gallery images
        logo.png
        photo.jpg
        thumbs/              generated, do not edit
      posts/                 team updates
        001-first-update.md
    QUANTUM/
    ORDER404/
  OFFICERS/
    OFFICERS.md              this folder is the officers catalog
    ana-moreno/
      ana-moreno.md          an officer page
      media/
        headshot.png
  EVENTS/
    2026-09-25-general-meeting.md
  _TEMPLATE/
    TEAM.md                  copy this to start a team
    FIRST-LAST.md            copy this to add an officer
```

The folder name is the page. `PAGES/TEAMS/CWNS/CWNS.md` is served at
`page.html?p=teams/cwns`. A folder starting with `_` is a template and is
never published.

Inside a page file:

| You write | You get |
| --- | --- |
| `# Title` | the page heading and its card title |
| `> one line` | the tagline under the heading |
| `## Heading` | a section, in the order you write them |
| `## Gallery` | a slideshow of everything in `media/` |
| any image in `media/` | your card mark and page photo, if it is the only one, or named `logo.*` |

Frontmatter is optional. You only need it for two things: where a card
sorts, and which group a team or officer is listed under.

```yaml
---
category: Research     # teams: the group heading. officers: not used
kind: CWNS Lead        # officers: your role, shown above your name
division: Research     # officers: the group heading
order: 20              # lower comes first
nav: true              # only for the four pages in the site menu
listLabel: All teams   # optional heading above the card grid
---
```

## Adding a team

1. Copy `PAGES/_TEMPLATE/TEAM.md` to `PAGES/TEAMS/<name>/<name>.md`
2. Fill in the brackets
3. Drop a logo in the folder's `media/`
4. Run `python3 tools/images.py` then `node tools/build.mjs`
5. Commit the file, the media, the derivatives, and `data/manifest.json`

It appears on the teams page automatically. No other file needs editing.

## Adding an officer

1. Copy `PAGES/_TEMPLATE/FIRST-LAST.md` to `PAGES/OFFICERS/<first-last>/<first-last>.md`
2. Fill in the brackets, set `kind` to the role and `division` to the group
3. Drop a headshot in the folder's `media/`
4. Build and commit as above

Their card is grouped under their division and links to their page.

## Adding an event

Save a file in `PAGES/EVENTS/` named `YYYY-MM-DD-what-it-is.md`. The date
comes from the filename, so nothing else is needed. Events show on the
homepage and are addressable at `page.html?p=events/<what-it-is>`.

Time and location can be set in frontmatter with `time:` and `location:`,
otherwise they are left out of the listing.

## Adding a team update

Save a file in the team's `posts/` folder. Filenames sort in order, so
`001-`, `002-` keeps them chronological. A `date:` in frontmatter puts the
update on the homepage.

## Images

`tools/images.py` writes two JPEG derivatives next to every source image
and never modifies the original:

| Path | Long edge | Used by |
| --- | --- | --- |
| `thumbs/<name>.jpg` | 1400 | gallery |
| `thumbs/sm/<name>.jpg` | 560 | cards, avatars, marks |

Photographic PNGs are re-encoded as JPEG, since a photo kept as PNG is
several times larger for the same pixels. Aspect ratio is never changed,
so nothing is cropped. Derivatives are committed, and CI fails if they are
stale.

## Build

```
python3 tools/images.py      # regenerate image derivatives
node tools/build.mjs         # regenerate data/manifest.json
```

The build reports any folder with no markdown file and any page with no
content. CI fails if either output is out of date.

## Preview

```
python3 localdev.py 8000
```

## Root files

| File | Purpose |
| --- | --- |
| `index.html` | Homepage shell, renders `PAGES/HOME/HOME.md` |
| `page.html` | Renders any page from `?p=<folder path>` |
| `styles.css` | Brand layer on top of Bootstrap |
| `site.js` | Shared rendering helpers |
| `config.js` | Site name, links, theme, particles |
| `home.js` | Homepage widgets |
| `page.js` | Page router |
| `bg-effect.js` | Hero particle effect |
| `404.html` | Not found page |
