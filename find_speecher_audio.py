import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

content = open(r'C:\Users\ADMIN\.gemini\antigravity\brain\4e30f505-b282-4a9c-9afc-135137b6aaf5\.system_generated\steps\252\content.md', encoding='utf-8').read()

print("Script tags:")
for m in re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', content):
    print(" ", m)

# Look for inline scripts
print("\nInline scripts snippets:")
for m in re.finditer(r'<script(?![^>]*src)[^>]*>(.*?)</script>', content, re.DOTALL):
    s = m.group(1).strip()
    if 'audio' in s.lower() or 'dictation' in s.lower() or 'voice' in s.lower():
        print("--- MATCH ---")
        print(s[:500])
