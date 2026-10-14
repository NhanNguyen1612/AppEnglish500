import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('speecher_dictation.js', 'r', encoding='utf-8') as f:
    content = f.read()

print("File size:", len(content))

# Look for audio URLs or API calls
urls = re.findall(r'https?://[^\s"\'<>]+|/[a-zA-Z0-9_\-\./]+(?:\.mp3|\.wav|\.json|\.php|/audio[^\s"\'<>]*)', content)
print("URLs found:")
for u in set(urls):
    print(" ", u)

# Search audio play calls
print("\nAudio play snippets:")
for m in re.finditer(r'new\s+Audio\([^)]*\)|\.play\(|\.src\s*=|fetch\(|XMLHttpRequest', content):
    start = max(0, m.start() - 100)
    end = min(len(content), m.end() + 150)
    print("---")
    print(content[start:end].replace('\n', ' '))
