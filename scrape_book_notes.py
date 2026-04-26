#!/usr/bin/env python3
"""
Scrape all book notes from kevin-hershberger.com and write to book-note-content.js
Uses sqs-html-content blocks — the Squarespace content divs.
"""
import requests
from bs4 import BeautifulSoup
import re
import time

BASE_URL = "https://kevin-hershberger.com/book-notes/"

SLUGS = [
    "stillness-is-the-key",
    "atomic-habits",
    "deep-work",
    "factfulness",
    "digital-minimalism",
    "lifespan",
    "essentialism",
    "ego-is-the-enemy",
    "die-with-zero",
    "courage-is-calling",
    "outlive",
    "why-we-sleep",
    "never-split-the-difference",
    "the-subtle-art-of-not-giving-a-fck",
    "the-obstacle-is-the-way",
    "stumbling-on-happiness",
    "how-to-win-friends-influence-people",
    "a-short-history-of-nearly-everything",
    "a-guide-to-the-good-life",
    "show-your-work",
    "steal-like-an-artist",
    "benjamin-franklin",
    "the-48-laws-of-power",
    "einstein",
    "four-thousand-weeks",
    "the-psychology-of-money",
    "the-4-hour-workweek",
    "so-good-they-cant-ignore-you",
    "mastery",
    "the-comfort-crisis",
    "the-story-of-the-human-body",
    "feel-good-productivity",
    "exercised",
]

SECTION_EMOJIS = {
    "book in 3 bullets": "📚",
    "3 bullets": "📚",
    "who should read": "👤",
    "how the book changed me": "🌎",
    "my top quotes": "✍️",
    "top quotes": "✍️",
    "my top quote": "✍️",
    "summary & notes": "📖",
    "summary and notes": "📖",
    "summary": "📖",
    "key ideas": "💡",
    "key takeaways": "💡",
    "notes": "📖",
    "chasing memory": "🧠",
    "thinking tactically": "🎯",
    "the centenarian decathlon": "🏋️",
    "aerobic efficiency": "🫀",
    "maximum aerobic output": "🏃",
    "strength": "💪",
}

def get_emoji_for_section(title):
    lower = title.lower()
    for key, emoji in SECTION_EMOJIS.items():
        if key in lower:
            return emoji
    return "📌"

def convert_block_to_html(block_soup):
    """Convert a sqs-html-content block's children into clean semantic HTML."""
    result_parts = []
    current_section_title = None
    section_items = []
    
    def flush_section():
        if current_section_title is not None and section_items:
            emoji = get_emoji_for_section(current_section_title)
            result_parts.append(f'<section class="bn-section">')
            result_parts.append(f'<h2 class="bn-section-title"><span class="bn-emoji">{emoji}</span>{current_section_title}</h2>')
            result_parts.extend(section_items)
            result_parts.append('</section>')
    
    for child in block_soup.children:
        if not hasattr(child, 'name') or not child.name:
            continue
        
        tag = child.name
        text = child.get_text(strip=True)
        
        if not text:
            continue
        
        if tag == 'h3':
            flush_section()
            current_section_title = text
            section_items = []
        elif tag == 'h4':
            section_items.append(f'<h4 class="bn-subsection">{text}</h4>')
        elif tag == 'ul':
            items = [li.get_text(strip=True) for li in child.find_all('li') if li.get_text(strip=True)]
            if items:
                li_html = '\n'.join(f'<li>{item}</li>' for item in items)
                section_items.append(f'<ul class="bn-list">\n{li_html}\n</ul>')
        elif tag == 'ol':
            items = [li.get_text(strip=True) for li in child.find_all('li') if li.get_text(strip=True)]
            if items:
                li_html = '\n'.join(f'<li>{item}</li>' for item in items)
                section_items.append(f'<ol class="bn-list">\n{li_html}\n</ol>')
        elif tag == 'p':
            if len(text) > 10:
                section_items.append(f'<p>{text}</p>')
        elif tag == 'blockquote':
            section_items.append(f'<blockquote class="bn-quote">{text}</blockquote>')
    
    flush_section()
    return '\n'.join(result_parts)

def scrape_book(slug):
    url = BASE_URL + slug
    try:
        resp = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        })
        if resp.status_code != 200:
            print(f"  SKIP {slug}: HTTP {resp.status_code}")
            return None
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        all_blocks = soup.select('div.sqs-html-content')
        
        # The main content block is the one with the most text, 
        # that starts with an h3 section header (not just the title block)
        best_block = None
        best_len = 0
        for block in all_blocks:
            text = block.get_text(strip=True)
            # Skip the nav/footer blocks
            if any(skip in text for skip in ['BOOK NOTES', 'Privacy Policy', 'NEWSLETTER', 'ABOUT']):
                continue
            # Skip the title-only block (very short)
            if len(text) < 200:
                continue
            if len(text) > best_len:
                best_len = len(text)
                best_block = block
        
        if not best_block:
            return None
        
        return convert_block_to_html(best_block)
        
    except Exception as e:
        print(f"  ERROR {slug}: {e}")
        return None

def main():
    results = {}
    
    for slug in SLUGS:
        print(f"Scraping: {slug}")
        content = scrape_book(slug)
        if content and len(content) > 100:
            results[slug] = content
            print(f"  OK — {len(content)} chars")
        else:
            results[slug] = ''
            print(f"  EMPTY (content={bool(content)})")
        time.sleep(0.6)
    
    # Write JS file
    js_lines = [
        "// Book note content — auto-generated by scrape_book_notes.py",
        "// Do not edit manually",
        "",
        "const BOOK_NOTE_CONTENT = {",
    ]
    
    for slug, html in results.items():
        safe_html = html.replace('\\', '\\\\').replace('`', '\\`').replace('${', '\\${')
        js_lines.append(f'  "{slug}": `{safe_html}`,')
        js_lines.append('')
    
    js_lines.append("};")
    
    js_content = '\n'.join(js_lines)
    
    with open('book-note-content.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    filled = sum(1 for v in results.values() if v)
    print(f"\nDone! Wrote {len(results)} books to book-note-content.js")
    print(f"Books with content: {filled}/{len(SLUGS)}")

if __name__ == '__main__':
    main()
