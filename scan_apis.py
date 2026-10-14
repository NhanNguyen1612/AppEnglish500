import urllib.request
import re

req = urllib.request.Request('https://moon.vn/main.dart.js?v=1791879635', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as res:
    content = res.read()

print("File size:", len(content))

for base in [b'courseapi.moon.vn', b'cmsapi.moon.vn', b'chatapi.moon.vn']:
    matches = set(re.findall(rb'https://' + re.escape(base) + rb'/[a-zA-Z0-9_/.-]+', content))
    print(f"\n--- {base.decode()} ---")
    for m in sorted(list(matches))[:15]:
        print(m.decode())
