# Cyber Jedis site

Static site for the UTSA Cyber Jedis. No framework, no runtime server.
The site root is the repository root, served by GitHub Pages.

## Layout

```
PAGES/
  HOME/page.md                 homepage content and widgets
  CONNECT/page.md
  TEAMS/
    page.md                    catalog, auto-lists every team below
    CWNS/
      page.md                  a team is its own subpage
      media/
      posts/
    QUANTUM/
    ORDER404/
  STAFF/
    page.md                    the one people page
    media/                     one headshot per person
  EVENTS/
    general-meeting.md         event data, no index page
```

A page is any folder containing `page.md`. Folders can nest, and the URL
is the folder path: `PAGES/TEAMS/CWNS/page.md` is served at
`page.html?p=teams/cwns`.

## Adding or editing a page

1. Create the folder, for example `PAGES/TEAMS/NEWTEAM/`
2. Copy `TEMPLATES/WEBPAGE_TEMPLATE.md` to `page.md` in it
3. Fill in the frontmatter and the sections
4. Drop a `logo.png` into the `media/` folder
5. Drop any other images into the same folder, they appear in Gallery
6. Run `node tools/build.mjs`
7. Commit `page.md`, the media, and `data/manifest.json`

To hide a page without deleting it, set `published: false`.

## Frontmatter

| Key | Purpose |
| --- | --- |
| `title` | Page heading |
| `navLabel` | Shorter label for the site nav |
| `nav` | `true` puts the page in the primary nav |
| `order` | Sort weight for nav and index grids |
| `type` | `page`, `team`, `event`, or `index`. `staff` is available if people ever need their own pages |
| `list` | On an `index` page, the child `type` to auto list |
| `listLabel` | Heading above the auto generated grid |
| `category` | Grouping label, also filters index children |
| `tagline` | One line under the title |
| `summary` | One line used on cards |
| `tags` | `[tag-a, tag-b]` |
| `accent` | `amber`, `blaze`, `neon`, `violet`, `azure`, or a hex value |
| `logo` | Media file used as the mark, defaults to `logo.*` |
| `schedule` | Short meeting line shown in the hero |
| `links` | `key: url` pairs rendered as buttons |
| `postsLabel` | Heading for the page's post list, defaults to Updates |
| `show` | Homepage widgets, for example `teams: 6, posts: 3` |
| `published` | `false` hides the page from all listings |

`##` headings in `page.md` become page sections in order. `## Gallery` is
special and fills itself from the media folder.

Relative links and images in `page.md` are resolved against that page's
own folder, so `media/headshot.png` works wherever the page is served
from.

## People

Everyone is listed on the single staff page in `PAGES/STAFF/page.md`.
Each entry is a copy of this block, with the headshot as the main element:

```
<li class="person">
  <img class="person-photo" src="media/name.png" alt="Full Name" width="1080" height="1350">
  <p class="person-name">Full Name</p>
  <p class="person-role">Role</p>
</li>
```

Put the headshots in `PAGES/STAFF/media/`. Omit the `img` and use
`<p class="person-photo person-photo-empty">` when there is no photo yet.

## Events

Drop a file into `PAGES/EVENTS/` with a `date` or `recurring` in the
frontmatter. Events show on the homepage and are addressable at
`page.html?p=events/<file>`. There is no events index page.

## Posts

Team posts live in `PAGES/<TEAM FOLDER>/posts/*.md`. They appear on the team
page and in the homepage updates widget.

## Build

```
node tools/build.mjs
```

This scans `PAGES/`, writes `data/manifest.json`, and lists any page that
needs content. CI fails if the committed manifest is out of date.

## Preview

```
python3 localdev.py 8000
```

## Root files

| File | Purpose |
| --- | --- |
| `index.html` | Homepage shell, reads `PAGES/HOME/page.md` |
| `page.html` | Renders any page from `?p=<folder path>` |
| `styles.css` | Design tokens and all layout |
| `site.js` | Shared rendering helpers |
| `config.js` | Site name, links, theme, particles |
| `home.js` | Homepage widgets |
| `page.js` | Page router |
| `bg-effect.js` | Hero particle effect |
| `404.html` | Not found page |
