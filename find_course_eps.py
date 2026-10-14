with open('scan_apis.py', 'r', encoding='utf-8') as f:
    pass

import re

with open('main.dart.js', 'rb') if False else open('scan_apis.py') as f:
    pass

# We can re-use urllib with cache or read endpoints
import urllib.request

req = urllib.request.Request('https://moon.vn/main.dart.js?v=1791879635', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as res:
    content = res.read()

matches = set(re.findall(rb'https://courseapi\.moon\.vn/api/[a-zA-Z0-9_/.-]+', content))
course_eps = [m.decode() for m in matches if any(k in m.decode().lower() for k in ['course', 'lesson', 'exam', 'test', 'detail', 'study', 'khoa', 'bai', 'question'])]
for ep in sorted(course_eps):
    print(ep)
