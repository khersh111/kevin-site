#!/usr/bin/env python3
import json
import os
import time
from urllib.parse import urlparse
import requests
from playwright.sync_api import sync_playwright

NEWSLETTERS_JSON = 'newsletters.json'
IMAGES_DIR = 'images/newsletters'
TIMEOUT = 30000  # 30s playwright timeout

def download_image(url, local_path):
    if not os.path.exists(local_path):
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'wb') as f:
                f.write(resp.content)
            return True
        except Exception as e:
            print(f"  ERROR downloading {url}: {e}")
            return False
    return True

def format_quotes_html(html):
    # Same quote formatting logic, but we can do it via Beautiful Soup on the final string
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    for h3 in soup.find_all('h3'):
        text = h3.get_text(strip=True)
        if 'quote' in text.lower():
            p_quote = h3.find_next_sibling('p')
            if p_quote:
                p_author = p_quote.find_next_sibling('p')
                if p_author and ('—' in p_author.get_text() or '-' in p_author.get_text()):
                    blockquote = soup.new_tag('blockquote')
                    p_quote_new = soup.new_tag('p')
                    
                    quote_html = p_quote.decode_contents()
                    quote_html = quote_html.replace('<strong>', '').replace('</strong>', '').strip()
                    # Add inner html via Beautiful soup
                    p_quote_new.append(BeautifulSoup(quote_html, 'html.parser'))
                    
                    cite = soup.new_tag('cite')
                    cite.append(BeautifulSoup(p_author.decode_contents(), 'html.parser'))
                    
                    blockquote.append(p_quote_new)
                    blockquote.append(cite)
                    
                    # Update heading
                    h3.string = "Quote of the week"
                    
                    h3.insert_after(blockquote)
                    p_quote.decompose()
                    p_author.decompose()
    return str(soup)

# We will inject this JS to extract visually ordered content
EXTRACT_JS = """
() => {
    // Select all blocks
    let blocks = Array.from(document.querySelectorAll('.sqs-block-html, .sqs-block-image'));
    
    // Sort by vertical position
    blocks.sort((a, b) => {
        let aRect = a.getBoundingClientRect();
        let bRect = b.getBoundingClientRect();
        
        // If they are on the same line (within 5px), sort horizontally
        if (Math.abs(aRect.top - bRect.top) < 5) {
            return aRect.left - bRect.left;
        }
        return aRect.top - bRect.top;
    });
    
    let result = [];
    let seenImages = new Set();
    
    for (const block of blocks) {
        if (block.classList.contains('sqs-block-html')) {
            const htmlContent = block.querySelector('.sqs-html-content');
            if (htmlContent) {
                // Check if it's nav or footer
                const text = htmlContent.innerText || "";
                if (text.includes("BOOK NOTES") || text.includes("ABOUT") || text.includes("Privacy Policy")) {
                    continue;
                }
                
                // Skip if it's just the title
                if (htmlContent.innerHTML.trim().startsWith('<h2') && text.length < 200 && result.length === 0) {
                    continue; // Skip the main title block which is always first
                }
                
                // Clean styles and classes
                const clone = htmlContent.cloneNode(true);
                clone.querySelectorAll('*').forEach(el => {
                    el.removeAttribute('style');
                    el.removeAttribute('class');
                    el.removeAttribute('id');
                    Array.from(el.attributes).forEach(attr => {
                        if (attr.name.startsWith('data-')) {
                            el.removeAttribute(attr.name);
                        }
                    });
                });
                
                result.push({
                    type: 'html',
                    content: clone.innerHTML
                });
            }
        } else if (block.classList.contains('sqs-block-image')) {
            const img = block.querySelector('img');
            if (img) {
                const src = img.src || img.dataset.src;
                if (src && src.includes('squarespace-cdn') && !seenImages.has(src)) {
                    seenImages.add(src); // Prevent exact duplicate images from responsive fallbacks
                    result.push({
                        type: 'image',
                        src: src,
                        alt: img.alt || ''
                    });
                }
            }
        }
    }
    return result;
}
"""

def main():
    with open(NEWSLETTERS_JSON, 'r', encoding='utf-8') as f:
        newsletters = json.load(f)
    
    os.makedirs(IMAGES_DIR, exist_ok=True)
    
    print(f"Processing {len(newsletters)} newsletters using Playwright...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a large viewport to ensure desktop layout triggers correctly without mobile stacking
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()
        
        for i, nl in enumerate(newsletters):
            slug = nl['slug']
            url = nl.get('url', f'https://kevin-hershberger.com/newsletter/{slug}')
            print(f"[{i+1}/{len(newsletters)}] {slug}")
            
            try:
                # Wait for domcontentloaded. Network idle takes too long for some sites.
                response = page.goto(url, wait_until='domcontentloaded', timeout=TIMEOUT)
                if response and response.status == 404:
                    print("  404 Not Found")
                    continue
                
                # Wait for images to be loaded ideally, but .sqs-block-image is usually there immediately
                page.wait_for_selector('.sqs-block', timeout=10000)
                # Small wait to ensure layout engine finished painting
                page.wait_for_timeout(500)
                
                blocks_data = page.evaluate(EXTRACT_JS)
                
                html_parts = []
                img_count = 0
                
                for block in blocks_data:
                    if block['type'] == 'html':
                        html_parts.append(block['content'])
                    elif block['type'] == 'image':
                        src = block['src']
                        alt = block['alt']
                        parsed = urlparse(src.split('?')[0])
                        ext = os.path.splitext(parsed.path)[1] or '.jpg'
                        local_filename = f"{slug}-{img_count}{ext}"
                        local_path = os.path.join(IMAGES_DIR, local_filename)
                        web_path = f"images/newsletters/{local_filename}"
                        
                        if download_image(src, local_path):
                            html_parts.append(f'<div class="article-inline-img">\n    <img src="{web_path}" alt="{alt}">\n</div>')
                            img_count += 1
                
                if html_parts:
                    final_html = "\n".join(html_parts)
                    final_html = format_quotes_html(final_html)
                    nl['html_body'] = final_html
                    print(f"  ✓ Extracted HTML ({len(final_html)} chars), downloaded {img_count} images")
                else:
                    print("  ✗ No content found")
                    
            except Exception as e:
                print(f"  ERROR: {e}")
            
            # Save progressively
            if i % 10 == 0:
                with open(NEWSLETTERS_JSON, 'w', encoding='utf-8') as f:
                    json.dump(newsletters, f, indent=2, ensure_ascii=False)
        
        browser.close()

    # Final save
    with open(NEWSLETTERS_JSON, 'w', encoding='utf-8') as f:
        json.dump(newsletters, f, indent=2, ensure_ascii=False)
        
    print("DONE!")

if __name__ == '__main__':
    main()
