with open('main.dart.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re

matches = list(re.finditer(r'Bearer\s*["\']?\s*\+', text))
print(f"Bearer occurrences: {len(matches)}")
for m in matches[:5]:
    start = max(0, m.start() - 150)
    end = min(len(text), m.end() + 150)
    print("---")
    print(text[start:end].replace('\n', ' '))
