with open('main.dart.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re

for pattern in ['vidfile.moon.vn', 'video_player', 'videolesson', '/video/', '/Video/']:
    idx = 0
    print(f"\n===== Pattern: {pattern} =====")
    for m in re.finditer(re.escape(pattern), text):
        start = max(0, m.start() - 100)
        end = min(len(text), m.end() + 200)
        snippet = text[start:end].replace('\n', ' ')
        print(snippet[:250])
        idx += 1
        if idx >= 3:
            break
