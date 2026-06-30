#!/usr/bin/env python3
import glob, re, os
from bs4 import BeautifulSoup
from collections import Counter

os.chdir(r"c:\Users\edvin\projects\klar-pipeline\websites\la-lasagna")
remote = re.compile(r'^(https?:)?//', re.I)
asset_hosts = Counter()
asset_examples = {}
iframe_remote = Counter()
anchors = Counter()

def host_of(u):
    return re.sub(r'^(https?:)?//', '', u).split('/')[0]

for f in sorted(glob.glob('*.html')):
    soup = BeautifulSoup(open(f, encoding='utf-8').read(), 'lxml')
    for tag in soup.find_all(['img', 'script', 'link', 'source', 'video', 'audio']):
        for attr in ('src', 'href', 'poster'):
            v = tag.get(attr)
            if v and remote.match(v):
                h = host_of(v)
                asset_hosts[h] += 1
                asset_examples.setdefault(h, (f, v[:90]))
        ss = tag.get('srcset')
        if ss:
            for part in ss.split(','):
                u = part.strip().split(' ')[0]
                if u and remote.match(u):
                    h = host_of(u); asset_hosts[h] += 1
                    asset_examples.setdefault(h, (f, u[:90]))
    for ifr in soup.find_all('iframe'):
        v = ifr.get('src') or ''
        if remote.match(v):
            iframe_remote[host_of(v)] += 1
    for m in re.finditer(r'url\(([^)]*)\)', str(soup)):
        u = m.group(1).strip().strip('"').strip("'")
        if remote.match(u):
            h = '(css-url) ' + host_of(u)
            asset_hosts[h] += 1
            asset_examples.setdefault(h, (f, u[:90]))
    for a in soup.find_all('a', href=True):
        if remote.match(a['href']):
            anchors[host_of(a['href'])] += 1

print('=== REMOTE ASSET LOADS (should be EMPTY) ===')
if not asset_hosts:
    print('  (none) ✓')
for h, c in asset_hosts.most_common():
    print(f'  {c:4}  {h}   e.g. {asset_examples[h][0]}: {asset_examples[h][1]}')
print('=== REMOTE IFRAMES (Google map only = OK) ===')
for h, c in iframe_remote.most_common():
    print(f'  {c:4}  {h}')
print('=== OUTBOUND ANCHOR HOSTS (links are fine) ===')
for h, c in anchors.most_common():
    print(f'  {c:4}  {h}')
