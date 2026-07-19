#!/usr/bin/env node
// Generates search-index.json from the site's real content sources so the
// search page can match against actual body text, not a hand-typed keyword
// list. Run automatically on every deploy (see package.json "build" script).
//
// Sources indexed:
//   - articles.html / article-content*.js   -> full article body text
//   - book-notes.html / book-note-content.js -> full book note text
//   - newsletters.json                       -> full newsletter body text
//   - blueprint-info.html                    -> real HTML, stripped
//
// The free guides are intentionally NOT indexed — they're gated behind an
// email capture form and shouldn't be reachable directly from search.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&#0?39;|&rsquo;|&lsquo;/gi, "'")
        .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
        .replace(/&mdash;|&ndash;/gi, '-')
        .replace(/&[a-z0-9#]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Evaluate a source file's top-level `const NAME = <value>` declarations in
// an isolated sandbox and return the requested variable's value.
function evalConst(file, varName) {
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(read(file), sandbox, { filename: file });
    // `const`/`let` bindings don't become sandbox properties, but they do
    // stay resolvable as bare identifiers in later evaluations of the same context.
    return vm.runInContext(varName, sandbox);
}

// Extract `const NAME = <literal>;` from a file that also contains runtime
// DOM code we don't want to execute (e.g. document.getElementById calls).
function extractConstLiteral(fileContent, varName) {
    const marker = `const ${varName} = `;
    const start = fileContent.indexOf(marker);
    if (start === -1) throw new Error(`Could not find "${marker}"`);
    const literalStart = start + marker.length;
    const openChar = fileContent[literalStart];
    const closeChar = openChar === '[' ? ']' : '}';
    let depth = 0;
    let end = -1;
    for (let i = literalStart; i < fileContent.length; i++) {
        const c = fileContent[i];
        if (c === openChar) depth++;
        else if (c === closeChar) {
            depth--;
            if (depth === 0) { end = i + 1; break; }
        }
    }
    if (end === -1) throw new Error(`Could not find matching close for ${varName}`);
    const literal = fileContent.slice(literalStart, end);
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(`__result__ = ${literal}`, sandbox);
    return sandbox.__result__;
}

function cleanTitle(rawTitle) {
    return rawTitle.replace(/\s*[—–-]\s*(Dr\.?\s*)?Kevin Hershberger.*$/i, '').trim();
}

function build() {
const items = [];

// ---------------------------------------------------------------- articles
{
    const articleHtml = read('article.html');
    const articleMeta = extractConstLiteral(articleHtml, 'articleMeta');

    const ARTICLE_CONTENT = evalConst('article-content.js', 'ARTICLE_CONTENT');
    const ARTICLE_CONTENT_EXTRA = evalConst('article-content-extra.js', 'ARTICLE_CONTENT_EXTRA');
    const ARTICLE_CONTENT_LINKS = evalConst('article-content-links.js', 'ARTICLE_CONTENT_LINKS');
    const allContent = Object.assign({}, ARTICLE_CONTENT, ARTICLE_CONTENT_EXTRA, ARTICLE_CONTENT_LINKS);

    for (const [slug, meta] of Object.entries(articleMeta)) {
        const bodyHtml = allContent[slug] || '';
        items.push({
            type: 'article',
            title: meta.title,
            url: `article-${slug}`,
            category: meta.category || '',
            date: meta.date || '',
            text: stripHtml(bodyHtml),
        });
    }
}

// -------------------------------------------------------------- book notes
{
    const bookNotesHtml = read('book-notes.html');
    const books = extractConstLiteral(bookNotesHtml, 'books');
    const BOOK_NOTE_CONTENT = evalConst('book-note-content.js', 'BOOK_NOTE_CONTENT');

    for (const book of books) {
        const bodyHtml = BOOK_NOTE_CONTENT[book.slug] || '';
        items.push({
            type: 'book',
            title: book.title,
            url: `book-note-${book.slug}`,
            category: book.category || '',
            author: book.author || '',
            text: stripHtml(bodyHtml),
        });
    }
}

// ------------------------------------------------------------- newsletters
{
    const newsletters = JSON.parse(read('newsletters.json'));
    for (const issue of newsletters) {
        items.push({
            type: 'newsletter',
            title: issue.title,
            url: `newsletter-${issue.slug}`,
            category: 'Newsletter',
            date: issue.date || '',
            text: (issue.body || '').replace(/\s+/g, ' ').trim(),
        });
    }
}

// -------------------------------------------------- guides & programs (HTML)
// Note: the free guides (Longevity Lift Library, Movement Screen,
// Total-Body Mobility, 5 Tips to Improve Your Posture) are deliberately
// excluded from the index. They're gated behind an email capture form on
// /free-guides, and surfacing them in search would let people reach the
// content directly without giving their email.
{
    const blueprintHtml = read('blueprint-info.html');
    const blueprintTitleMatch = blueprintHtml.match(/<title>([\s\S]*?)<\/title>/i);
    items.push({
        type: 'program',
        title: blueprintTitleMatch ? cleanTitle(blueprintTitleMatch[1]) : 'The Longevity Movement Blueprint',
        url: 'blueprint-info',
        category: 'Program',
        text: stripHtml(blueprintHtml),
    });
}

const outPath = path.join(ROOT, 'search-index.json');
fs.writeFileSync(outPath, JSON.stringify(items));
console.log(`Wrote ${items.length} items to search-index.json (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
}

// Never fail the site deploy over the search index: if content sources shift
// shape and this script breaks, log it and keep the last committed
// search-index.json rather than blocking the whole build.
try {
    build();
} catch (err) {
    console.error('build-search-index failed, keeping existing search-index.json:', err);
    process.exitCode = 0;
}
