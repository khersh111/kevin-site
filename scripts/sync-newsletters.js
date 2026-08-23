#!/usr/bin/env node
// Pulls newly-sent beehiiv newsletter issues and adds them to newsletters.json
// in the exact shape the site already uses, so an issue you send on Sunday
// shows up on the website with no manual work.
//
// Source of truth: the beehiiv API v2 "posts" endpoint (the actually-sent web
// version of each issue). See https://developers.beehiiv.com.
//
// For every confirmed (sent) post that isn't on the site yet, this script:
//   1. builds a date-based slug + display date  (e.g. "august-16-2026")
//   2. cleans beehiiv's HTML down to the tag vocabulary the site expects
//      (<p> <h3> <h4> <blockquote> <cite> <ul> <ol> <li> <strong> <em> <a>)
//   3. downloads each image into images/newsletters/{slug}-N.ext and rewrites
//      it to a local <figure class="article-inline-img"> block
//   4. prepends the finished entry to newsletters.json (newest-first)
//
// It is idempotent: anything whose slug is already in newsletters.json is
// skipped, so re-runs (and the twice-daily Sunday cron) never duplicate.
//
// Env:
//   BEEHIIV_API_KEY   required — a beehiiv API key (Settings -> API)
//   PUBLICATION_ID    optional — defaults to the constant below
//   DRY_RUN=1         don't write files; print what would happen
//
// Usage:  BEEHIIV_API_KEY=xxx node scripts/sync-newsletters.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NEWSLETTERS_JSON = path.join(ROOT, 'newsletters.json');
const IMAGES_DIR = path.join(ROOT, 'images', 'newsletters');
const SITE_ORIGIN = 'https://www.khershberger.com';

const PUBLICATION_ID = process.env.PUBLICATION_ID || 'pub_a2ec6133-bbc5-463e-a855-f393a1b74db6';
const API_KEY = process.env.BEEHIIV_API_KEY;
const DRY_RUN = process.env.DRY_RUN === '1' || process.argv.includes('--dry-run');

// How many of the most-recent posts to look at each run. The Sunday cron only
// needs the latest one or two, but a small window lets a missed week backfill.
const LOOKBACK = Number(process.env.LOOKBACK || 5);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

function die(msg) {
    console.error(`\n✖ ${msg}\n`);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// beehiiv API
// ---------------------------------------------------------------------------

async function fetchLatestPosts() {
    const url = new URL(`https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/posts`);
    // RSS content is the syndication-clean article body (no page header, byline,
    // or share buttons); web content is the fallback.
    url.searchParams.append('expand[]', 'free_rss_content');
    url.searchParams.append('expand[]', 'free_web_content');
    url.searchParams.append('expand[]', 'free_email_content');
    url.searchParams.set('status', 'confirmed');       // sent issues only
    url.searchParams.set('order_by', 'publish_date');
    url.searchParams.set('direction', 'desc');
    url.searchParams.set('limit', String(LOOKBACK));

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        die(`beehiiv API returned HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = await res.json();
    return json.data || [];
}

// beehiiv publish_date is a Unix timestamp (seconds) or an ISO string.
function toDate(publishDate) {
    if (publishDate == null) return new Date();
    if (typeof publishDate === 'number') return new Date(publishDate * 1000);
    if (/^\d+$/.test(publishDate)) return new Date(Number(publishDate) * 1000);
    return new Date(publishDate);
}

// Format the calendar date in the author's own timezone so a Sunday-morning
// send is dated Sunday regardless of where the CI runner lives.
function dateParts(date) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago', year: 'numeric', month: 'long', day: 'numeric',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    return { month: parts.month, day: parts.day, year: parts.year };
}

function slugFor(date) {
    const { month, day, year } = dateParts(date);
    return `${month.toLowerCase()}-${day}-${year}`;
}

function displayDate(date) {
    const { month, day, year } = dateParts(date);
    return `${month} ${day}, ${year}`;
}

// ---------------------------------------------------------------------------
// HTML cleaning — reduce beehiiv's web HTML to the site's tag vocabulary
// ---------------------------------------------------------------------------

// Tags kept as-is. Everything else is either unwrapped (kept text/children)
// or dropped entirely.
const KEEP = new Set(['p', 'h3', 'h4', 'blockquote', 'cite', 'ul', 'ol', 'li',
    'strong', 'em', 'a', 'br', 'figure', 'figcaption', 'img']);
const DROP = new Set(['script', 'style', 'head', 'nav', 'header', 'footer', 'form',
    'button', 'iframe', 'svg', 'table', 'thead', 'tbody', 'tr', 'td', 'th']);
const ALLOWED_ATTRS = { a: ['href'], img: ['src', 'alt'] };

function cleanBodyHtml(rawHtml) {
    let html = rawHtml || '';

    // Remove comments, the doctype, and any dropped blocks (with their contents).
    html = html.replace(/<!--[\s\S]*?-->/g, '');
    html = html.replace(/<!doctype[^>]*>/gi, '');
    for (const tag of DROP) {
        html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'gi'), '');
        html = html.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), '');
    }

    // Normalize headings/emphasis to the site's vocabulary.
    html = html.replace(/<(\/?)h[12]\b/gi, '<$1h3');
    html = html.replace(/<(\/?)b\b/gi, '<$1strong');
    html = html.replace(/<(\/?)i\b/gi, '<$1em');

    // Walk every tag: keep + strip attributes, or unwrap unknown tags.
    html = html.replace(/<(\/?)([a-zA-Z0-9]+)((?:[^<>"']|"[^"]*"|'[^']*')*?)(\/?)>/g,
        (match, close, tagRaw, attrs, selfClose) => {
            const tag = tagRaw.toLowerCase();
            if (!KEEP.has(tag)) return '';               // unwrap: drop tag, keep inner text
            if (close) return `</${tag}>`;
            const allow = ALLOWED_ATTRS[tag] || [];
            let kept = '';
            for (const name of allow) {
                const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
                if (m) kept += ` ${name}="${(m[2] ?? m[3] ?? '').trim()}"`;
            }
            const sc = (tag === 'img' || tag === 'br') ? '/' : (selfClose ? '/' : '');
            return `<${tag}${kept}${sc}>`;
        });

    // Drop links with no href (unwrap), and empty anchors like share buttons.
    html = html.replace(/<a>([\s\S]*?)<\/a>/gi, '$1');
    html = html.replace(/<a\b[^>]*>\s*<\/a>/gi, '');

    // Drop beehiiv's "Powered by beehiiv" footer link.
    html = html.replace(/<a[^>]*beehiiv\.com\/powered-by[^>]*>[\s\S]*?<\/a>/gi, '');

    // Collapse whitespace and remove now-empty blocks.
    html = html.replace(/\s+/g, ' ');
    html = html.replace(/<p>\s*<\/p>/gi, '');
    html = html.replace(/<blockquote>\s*<\/blockquote>/gi, '');
    html = html.replace(/<figure[^>]*>\s*<\/figure>/gi, '');

    // Remove orphaned section headings — a heading with no content before the
    // next heading or the end (e.g. a "Quote" section left empty in beehiiv).
    html = html.replace(/<h([34])>[\s\S]*?<\/h\1>\s*(?=<h[34]|$)/gi, '');

    // Trim stray leading/trailing line breaks.
    html = html.replace(/^(?:\s*<br\s*\/?>)+/i, '').replace(/(?:<br\s*\/?>\s*)+$/i, '');
    return html.trim();
}

// Plain-text version for the `body` field (used by the search index).
function htmlToText(html) {
    return (html || '')
        .replace(/<\/(p|h3|h4|li|blockquote|figcaption)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&#0?39;|&rsquo;|&lsquo;/gi, "'")
        .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
        .replace(/&mdash;|&ndash;/gi, '-')
        .replace(/&[a-z0-9#]+;/gi, ' ')
        .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Images — download remote <img> and rewrite to local figure blocks
// ---------------------------------------------------------------------------

function extFor(url, contentType) {
    const fromUrl = (url.split('?')[0].match(/\.(png|jpe?g|webp|gif)$/i) || [])[1];
    if (fromUrl) return fromUrl.toLowerCase() === 'jpeg' ? 'jpg' : fromUrl.toLowerCase();
    const fromType = (contentType || '').split('/')[1];
    if (fromType) return fromType.split(';')[0].replace('jpeg', 'jpg');
    return 'jpg';
}

async function localizeImages(html, slug) {
    const imgRe = /<img\b[^>]*>/gi;
    const tags = html.match(imgRe) || [];
    let index = 0;
    for (const tag of tags) {
        const src = (tag.match(/src="([^"]*)"/i) || [])[1];
        const alt = (tag.match(/alt="([^"]*)"/i) || [])[1] || '';
        if (!src || !/^https?:\/\//i.test(src)) { html = html.replace(tag, ''); continue; }

        const res = await fetch(src);
        if (!res.ok) { console.warn(`  ! image ${src} -> HTTP ${res.status}, skipping`); html = html.replace(tag, ''); continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = extFor(src, res.headers.get('content-type'));
        const file = `${slug}-${index}.${ext}`;
        if (!DRY_RUN) fs.writeFileSync(path.join(IMAGES_DIR, file), buf);
        console.log(`  ↓ image ${file} (${buf.length} bytes)${DRY_RUN ? ' [dry-run]' : ''}`);

        const altAttr = alt ? ` alt="${alt.replace(/"/g, '&quot;')}"` : '';
        html = html.replace(tag, `<img${altAttr} src="images/newsletters/${file}"/>`);
        index += 1;
    }
    // Drop beehiiv's own <figure> wrappers, then wrap each local image (pulling
    // in a trailing <figcaption> when present) into the site's figure block.
    html = html.replace(/<\/?figure\b[^>]*>/gi, '');
    html = html.replace(/(<img\b[^>]*\/>)(\s*<figcaption>[\s\S]*?<\/figcaption>)?/gi,
        (m, img, cap) => `<figure class="article-inline-img">${img}${cap ? cap.trim() : ''}</figure>`);
    return html;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    if (!API_KEY) die('BEEHIIV_API_KEY is not set.');

    const existing = JSON.parse(fs.readFileSync(NEWSLETTERS_JSON, 'utf8'));
    const haveSlugs = new Set(existing.map((n) => n.slug));

    console.log(`Fetching up to ${LOOKBACK} latest posts from beehiiv…`);
    const posts = await fetchLatestPosts();
    console.log(`beehiiv returned ${posts.length} post(s).`);

    const fresh = [];
    for (const post of posts) {
        const date = toDate(post.publish_date ?? post.displayed_date ?? post.created);
        const slug = slugFor(date);
        if (haveSlugs.has(slug) && process.env.DEBUG_DUMP !== '1') { console.log(`= ${slug} already published, skipping`); continue; }

        const free = post.content?.free || {};
        const raw = free.rss || free.web || post.content?.rss || post.content?.web || '';
        if (!raw) { console.warn(`! "${post.title}" has no content, skipping`); continue; }
        if (process.env.DEBUG_DUMP === '1') {
            const dump = (label, s) => {
                s = s || '';
                console.log(`  [debug] ${label} len=${s.length}`);
                let i = 0, n = 0;
                while ((i = s.toLowerCase().indexOf('blockquote', i)) >= 0 && n < 4) {
                    console.log(`    ${label} @${i}: ${s.slice(Math.max(0, i - 90), i + 220)}`);
                    i += 10; n += 1;
                }
                if (!n) console.log(`    ${label}: no <blockquote>`);
            };
            dump('rss', free.rss);
            dump('web', free.web);
            dump('email', free.email);
        }

        console.log(`+ ${slug} — "${post.title}"`);
        let html = cleanBodyHtml(raw);
        html = await localizeImages(html, slug);

        fresh.push({
            slug,
            date: displayDate(date),
            title: post.title || 'Untitled',
            url: `${SITE_ORIGIN}/newsletter-${slug}`,
            body: htmlToText(html),
            html_body: html,
            _date: date.getTime(),
        });
        haveSlugs.add(slug);
    }

    if (!fresh.length) {
        console.log('\nNothing new to publish.');
        // Signal "no changes" to the workflow.
        if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=false\n');
        return;
    }

    // Prepend newest-first, matching the existing file ordering.
    fresh.sort((a, b) => b._date - a._date);
    fresh.forEach((n) => delete n._date);
    const updated = [...fresh, ...existing];

    if (DRY_RUN) {
        console.log(`\n[dry-run] Would add ${fresh.length} issue(s):`);
        for (const n of fresh) console.log(`  ${n.slug} — ${n.title}`);
        console.log('\n[dry-run] Full html_body of newest:\n' + fresh[0].html_body);
        console.log('\n[dry-run] body (plain text):\n' + fresh[0].body);
        return;
    }

    fs.writeFileSync(NEWSLETTERS_JSON, JSON.stringify(updated, null, 2) + '\n');
    console.log(`\n✓ Added ${fresh.length} issue(s) to newsletters.json`);

    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=true\n');
        const titles = fresh.map((n) => n.title).join('; ');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `summary=${fresh.length} issue(s): ${titles}\n`);
    }
}

main().catch((err) => die(err.stack || String(err)));
