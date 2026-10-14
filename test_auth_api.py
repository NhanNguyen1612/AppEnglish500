import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('auth_token.txt', 'r', encoding='utf-8') as f:
    token = f.read().strip()

url = "https://courseapi.moon.vn/api/Course/LessonDetail/13229487"
req = urllib.request.Request(url, headers={
    'Accept': 'application/json',
    'Authorization': f'Bearer {token}',
    'User-Agent': 'Mozilla/5.0'
})

try:
    with urllib.request.urlopen(req) as res:
        print(f"[SUCCESS] Status {res.status}")
        data = json.loads(res.read().decode('utf-8'))
        print("Keys:", list(data.keys()))
        print("Lesson Name:", data.get('name'))
        print("Video URL:", data.get('videoUrl'))
        print("Link PDF:", data.get('linkPdf'))
        print("SubDeThiId:", data.get('subDeThiId'))
        with open('sample_lesson_detail.json', 'w', encoding='utf-8') as out:
            json.dump(data, out, ensure_ascii=False, indent=2)
        print("Saved sample_lesson_detail.json")
except Exception as e:
    print(f"Error: {e}")
