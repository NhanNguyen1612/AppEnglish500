import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

content = open(r'C:\Users\ADMIN\.gemini\antigravity\brain\4e30f505-b282-4a9c-9afc-135137b6aaf5\.system_generated\steps\252\content.md', encoding='utf-8').read()

m = re.search(r'data-sentence=["\']([^"\']+)["\']', content)
if m:
    print("Found sentence:", m.group(1))

# Search for any text related to rainy day
for line in content.splitlines():
    if 'rain' in line.lower() and len(line.strip()) < 200:
        print("Line:", line.strip())
