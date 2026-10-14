with open('main.dart.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re

matches = list(re.finditer(r'localStorage', text))
print(f"localStorage occurrences: {len(matches)}")
for m in matches[:10]:
    start = max(0, m.start() - 50)
    end = min(len(text), m.end() + 150)
    print("---")
    print(text[start:end].replace('\n', ' '))
