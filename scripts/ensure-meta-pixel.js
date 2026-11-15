#!/usr/bin/env node
// Makes sure every HTML page ships the Meta Pixel base code:
//   - the <script> part just before </head>
//   - the <noscript> part right after the opening <body> tag
// Runs on every deploy (see package.json "build"), like ensure-analytics.js,
// so any page added later gets the pixel automatically.
//
// Excluded:
//   guides/*.html          design-tool exports embedded in iframes, not pages
//   blueprint-content.html served at /blueprint?token=..., and the pixel's
//                          PageView would send that private access token to Meta

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PIXEL_ID = '1139889371843490';
const DATASET_ID = '908262508949068'; // dataset the ads track; noscript fallback reports here
const EXCLUDE = new Set(['blueprint-content.html']);

const HEAD_SNIPPET = `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('init', '${DATASET_ID}');
fbq('track', 'PageView');
</script>
<!-- End Meta Pixel Code -->
`;

const BODY_SNIPPET = `
<!-- Meta Pixel Code (noscript) -->
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${DATASET_ID}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code (noscript) -->`;

function run() {
    const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !EXCLUDE.has(f));
    let inserted = 0, alreadyPresent = 0, skipped = 0;

    for (const file of files) {
        const filePath = path.join(ROOT, file);
        const content = fs.readFileSync(filePath, 'utf8');

        if (content.includes(`fbq('init', '${PIXEL_ID}')`)) {
            alreadyPresent++;
            continue;
        }

        const headClose = content.indexOf('</head>');
        const bodyOpen = content.match(/<body\b[^>]*>/i);
        if (headClose === -1 || !bodyOpen || bodyOpen.index < headClose) {
            console.warn(`ensure-meta-pixel: couldn't find </head> and <body> in ${file}, skipping`);
            skipped++;
            continue;
        }

        const bodyInsertAt = bodyOpen.index + bodyOpen[0].length;
        const updated =
            content.slice(0, headClose) + HEAD_SNIPPET +
            content.slice(headClose, bodyInsertAt) + BODY_SNIPPET +
            content.slice(bodyInsertAt);
        fs.writeFileSync(filePath, updated);
        inserted++;
    }

    console.log(`ensure-meta-pixel: inserted into ${inserted} file(s), ${alreadyPresent} already had it, ${skipped} skipped`);
}

// Never fail the site deploy over a tracking tag: log and move on.
try {
    run();
} catch (err) {
    console.error('ensure-meta-pixel failed:', err);
    process.exitCode = 0;
}
