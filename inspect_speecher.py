import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

content = open(r'C:\Users\ADMIN\.gemini\antigravity\brain\4e30f505-b282-4a9c-9afc-135137b6aaf5\.system_generated\steps\252\content.md', encoding='utf-8').read()

print("Audio tags:")
for m in re.finditer(r'<audio[^>]*>', content):
    print(m.group(0))

print("\nAudio URLs:")
for m in re.findall(r'https?://[^\s"\'<>]+\.(?:mp3|wav|ogg|m4a|aac)', content):
    print(m)

print("\nVoice occurrences:")
for m in re.finditer(r'voice', content, re.IGNORECASE):
    start = max(0, m.start() - 50)
    end = min(len(content), m.end() + 100)
    print(content[start:end].replace('\n', ' '))
