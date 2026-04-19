#!/usr/bin/env python3
"""
Scrape all newsletters from kevin-hershberger.com and extract HTML bodies + images.
Updates newsletters.json with html_body field.
- Preserves the order of text blocks and image blocks.
- Formats quotes using blockquote and cite.
"""

import json
import os
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

NEWSLETTERS_JSON = 'newsletters.json'
IMAGES_DIR = 'images/newsletters'
TIMEOUT = 20
DELAY = 0.5  # seconds between requests to be polite

def format_quotes(soup):
    """Format quote blocks to use <blockquote> and <cite>."""
    for h3 in soup.find_all('h3'):
        text = h3.get_text(strip=True)
        if 'quote' in text.lower():
            p_quote = h3.find_next_sibling('p')
            if p_quote:
                p_author = p_quote.find_next_sibling('p')
                if p_author and ('—' in p_author.get_text() or '-' in p_author.get_text()):
                    blockquote = soup.new_tag('blockquote')
                    p_quote_new = soup.new_tag('p')
                    
                    # Clean up bolding inside the quote
                    quote_html = p_quote.decode_contents()
                    quote_html = quote_html.replace('<strong>', '').replace('</strong>', '').strip()
                    p_quote_new.append(BeautifulSoup(quote_html, 'html.parser'))
                    
                    cite = soup.new_tag('cite')
                    cite.append(BeautifulSoup(p_author.decode_contents(), 'html.parser'))
                    
                    blockquote.append(p_quote_new)
                    blockquote.append(cite)
                    
                    h3.insert_before(blockquote)
                    h3.decompose()
                    p_quote.decompose()
                    p_author.decompose()

def download_image(url, local_path):
    """Download an image to the local path."""
    try:
        if not os.path.exists(local_path):
            resp = requests.get(url, timeout=TIMEOUT)
            resp.raise_for_status()
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'wb') as f:
                f.write(resp.content)
        return True
    except Exception as e:
        print(f"  ERROR downloading {url}: {e}")
        return False

def scrape_newsletter(url, slug):
    """Scrape a single newsletter and return the HTML body + image count."""
    try:
        resp = requests.get(url, timeout=TIMEOUT)
        if resp.status_code == 404:
            print(f"  404 Not Found")
            return None, 0
        resp.raise_for_status()
    except Exception as e:
        print(f"  ERROR fetching: {e}")
        return None, 0
    
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    # Get all html and image blocks in document order
    blocks = soup.select('[class*="sqs-block-html"], [class*="sqs-block-image"]')
    
    html_parts = []
    downloaded_images = 0
    
    for i, block in enumerate(blocks):
        classes = block.get('class', [])
        
        if any('sqs-block-html' in c for c in classes):
            # Check if this is the nav/footer block
            text = block.get_text(strip=True)
            if 'BOOK NOTESCONTACT' in text or 'ABOUTNEWSLETTERARTICLES' in text or 'Privacy Policy|Disclaimer' in text:
                continue
            
            # This is a text block
            html_content = block.select_one('.sqs-html-content')
            if html_content:
                # Clean it
                for tag in html_content.find_all(True):
                    if tag.has_attr('style'): del tag['style']
                    if tag.has_attr('class'): del tag['class']
                    for attr in list(tag.attrs.keys()):
                        if attr.startswith('data-'): del tag[attr]
                    if tag.has_attr('id'): del tag['id']
                
                inner = "".join(str(c) for c in html_content.children)
                # Skip the title block
                if inner.startswith('<h2') and len(inner) < 200:
                    continue
                
                html_parts.append(inner)
                
        elif any('sqs-block-image' in c for c in classes):
            img = block.select_one('img')
            if img:
                src = img.get('src', img.get('data-src', ''))
                if src and 'squarespace-cdn' in src:
                    # Download image
                    alt = img.get('alt', '')
                    parsed = urlparse(src.split('?')[0])
                    ext = os.path.splitext(parsed.path)[1] or '.jpg'
                    
                    local_filename = f"{slug}-{downloaded_images}{ext}"
                    local_path = os.path.join(IMAGES_DIR, local_filename)
                    web_path = f"images/newsletters/{local_filename}"
                    
                    if download_image(src, local_path):
                        downloaded_images += 1
                        html_parts.append(f'<div class="article-inline-img">\n    <img src="{web_path}" alt="{alt}">\n</div>')
    
    if not html_parts:
        return None, 0
        
    combined_html = "\n".join(html_parts)
    
    # Format quotes
    combined_soup = BeautifulSoup(combined_html, 'html.parser')
    format_quotes(combined_soup)
    
    final_html = str(combined_soup)
    
    # Clean up empty paragraphs
    final_html = re.sub(r'<p>\s*</p>', '', final_html)
    
    return final_html, downloaded_images

def main():
    # Load current newsletters data
    with open(NEWSLETTERS_JSON, 'r', encoding='utf-8') as f:
        newsletters = json.load(f)
    
    print(f"Found {len(newsletters)} newsletters to process\n")
    
    # Create images directory
    os.makedirs(IMAGES_DIR, exist_ok=True)
    
    total_images = 0
    success_count = 0
    error_count = 0
    
    for i, nl in enumerate(newsletters):
        slug = nl['slug']
        url = nl.get('url', f'https://kevin-hershberger.com/newsletter/{slug}')
        
        print(f"[{i+1}/{len(newsletters)}] {slug}")
        
        html_body, images_downloaded = scrape_newsletter(url, slug)
        
        if html_body:
            nl['html_body'] = html_body
            success_count += 1
            print(f"  ✓ Got HTML body ({len(html_body)} chars)")
            if images_downloaded > 0:
                print(f"  ✓ Downloaded {images_downloaded} images")
                total_images += images_downloaded
        else:
            error_count += 1
            print(f"  ✗ No HTML body extracted")
        
        time.sleep(DELAY)
    
    # Save updated newsletters
    with open(NEWSLETTERS_JSON, 'w', encoding='utf-8') as f:
        json.dump(newsletters, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*50}")
    print(f"DONE!")
    print(f"  Successful: {success_count}/{len(newsletters)}")
    print(f"  Errors: {error_count}")
    print(f"  Images downloaded: {total_images}")
    print(f"  Updated: {NEWSLETTERS_JSON}")

if __name__ == '__main__':
    main()
