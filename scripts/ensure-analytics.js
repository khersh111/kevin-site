#!/usr/bin/env node
// Makes sure every HTML page ships the Google Analytics (gtag.js) snippet,
// immediately after the opening <head> tag, per Google's install instructions.
// Runs on every deploy (see package.json "build") so any new page added
// later automatically gets it patched in too - no manual step required.
//
// Excludes guides/*.html: those are design-tool export bundles embedded via
// iframe inside guide-total-body-mobility.html / guide-5-tips-posture.html,
// not standalone pages users land on directly.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GA_ID = 'G-DDV2KKNZ71';

const GA_SNIPPET = `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${GA_ID}');
</script>
`;

function run() {
    const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

    let inserted = 0, alreadyPresent = 0, skippedNoHead = 0;

    for (const file of files) {
        const filePath = path.join(ROOT, file);
        const content = fs.readFileSync(filePath, 'utf8');

        if (content.includes(GA_ID)) {
            alreadyPresent++;
            continue;
        }

        const headIndex = content.indexOf('<head>');
        if (headIndex === -1) {
            console.warn(`ensure-analytics: no "<head>" tag found in ${file}, skipping`);
            skippedNoHead++;
            continue;
        }

        const insertAt = headIndex + '<head>'.length;
        const updated = content.slice(0, insertAt) + GA_SNIPPET + content.slice(insertAt);
        fs.writeFileSync(filePath, updated);
        inserted++;
    }

    console.log(`ensure-analytics: inserted into ${inserted} file(s), ${alreadyPresent} already had it, ${skippedNoHead} skipped (no <head> found)`);
}

// Never fail the site deploy over an analytics tag: log and move on.
try {
    run();
} catch (err) {
    console.error('ensure-analytics failed:', err);
    process.exitCode = 0;
}
