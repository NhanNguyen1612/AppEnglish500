import urllib.request
import os

url = 'https://moon.vn/main.dart.js?v=1791879635'
out = 'main.dart.js'

if not os.path.exists(out):
    print("Downloading main.dart.js...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as res, open(out, 'wb') as f:
        f.write(res.read())
    print("Downloaded successfully!")
else:
    print("Already exists.")

with open(out, 'rb') as f:
    content = f.read()

import re
matches = set(re.findall(rb'https://courseapi\.moon\.vn/api/[a-zA-Z0-9_/.-]+', content))
print(f"Total endpoints on courseapi: {len(matches)}")
with open('endpoints.txt', 'w', encoding='utf-8') as f:
    for m in sorted(matches):
        f.write(m.decode() + '\n')
print("Wrote to endpoints.txt")
