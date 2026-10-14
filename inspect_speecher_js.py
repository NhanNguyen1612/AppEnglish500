import urllib.request
import re

url = "https://speecher.org/assets/dictation.js?v=1790808902"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as res:
        content = res.read().decode('utf-8')
        print(f"Downloaded dictation.js ({len(content)} chars)")
        with open('speecher_dictation.js', 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Search for audio endpoints or voice names
        for m in re.finditer(r'(?:voice|audio|sound|speech|fetch|mp3|tts)', content, re.IGNORECASE):
            start = max(0, m.start() - 60)
            end = min(len(content), m.end() + 100)
            print("---")
            print(content[start:end].replace('\n', ' '))
except Exception as e:
    print("Error:", e)
