const blocks = Array.from(document.querySelectorAll('.sqs-block-html, .sqs-block-image'));

// Sort blocks by their visual vertical position on the page
blocks.sort((a, b) => {
    return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
});

const result = [];
for (const block of blocks) {
    if (block.querySelector('.sqs-html-content')) {
        const text = block.innerText.substring(0, 50);
        if (text.includes("BOOK NOTESCONTACT") || text.includes("ABOUTNEWSLETTERARTICLES") || text.includes("Privacy Policy")) {
            continue;
        }
        result.push("TXT: " + text.replace(/\n/g, " "));
    } else if (block.classList.contains('sqs-block-image')) {
        const img = block.querySelector('img');
        if (img) {
            result.push("IMG: " + (img.src || img.dataset.src));
        }
    }
}
console.log(result.join("\n"));
