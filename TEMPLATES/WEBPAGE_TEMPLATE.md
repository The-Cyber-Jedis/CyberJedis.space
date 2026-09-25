<!--
  ============================================================
  PAGE TEMPLATE
  ============================================================
  Every page in PAGES/<FOLDER>/page.md follows this shape.
  One folder equals one page. Nothing else needs editing.

  1. Create the folder, for example PAGES/TEAMS/NEWTEAM/
  2. Copy this file to PAGES/<FOLDER>/page.md
  3. Drop a logo named logo.png into PAGES/<FOLDER>/media/
  4. Drop any other images into the same folder and they are picked up
     automatically by the Gallery section
  5. Run  python3 tools/images.py  then  node tools/build.mjs
  6. Commit page.md, the media, the derivatives, and data/manifest.json

  Teams live in PAGES/TEAMS/<TEAM>/ and officers in
  PAGES/STAFF/<PERSON>/. An index page in PAGES/TEAMS/ or PAGES/STAFF/
  lists everything of its type automatically.

  FRONTMATTER KEYS
    title        page heading
    kind         label above the title, such as Research group
    navLabel     shorter label for the site nav (defaults to title)
    nav          true to show this page in the primary nav
    order        sort weight for nav, cards and indexes
    type         page | team | staff | event | index
    list         on an index page, the child type to auto list
    listLabel    heading above the auto generated grid
    groupBy      frontmatter key to group the listing by
    category     grouping label shown on cards
    division     grouping label for staff, used with groupBy
    tags         [tag-a, tag-b]
    accent       amber | blaze | neon | violet | azure | #hex
    logo         media file to use as the mark (defaults to logo.*)
    links        key: url pairs rendered as buttons under the title
    contact      key: url pairs rendered as a labelled contact block
    schedule     short meeting line shown in the hero
    tagline      one line under the title
    summary      one line used on cards
    postsLabel   heading for the page's posts
    show         home widgets, for example teams: 6
    published    false hides the page from all listings

  Write the body under the frontmatter. Every `##` heading becomes a
  section in order. The `## Gallery` section fills itself from the folder.
-->

---
title: [Page Title]
type: page
kind: [Page Title]
tagline: [One sentence describing this page.]
---

## About

[Two or three paragraphs on what this covers, who runs it, and why it
exists. This is also the one line used on cards elsewhere, so keep the
first sentence to a single clear statement.]

- [Point one]
- [Point two]
- [Point three]

## Gallery

<!-- Do not edit. Images in media/ are listed here automatically. -->

## What we do

- [Activity one]
- [Activity two]

## Schedule

[Meeting days, times, and rooms.]

## Contact

- Discord: [https://discord.gg/xxxxx]

<!--
  If you would rather keep contact details in the frontmatter, delete the
  Contact section above and use this instead:

  contact:
    discord: https://discord.gg/xxxxx
    email: someone@my.utsa.edu
-->
