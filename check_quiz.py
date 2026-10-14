import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('auth_token.txt', 'r', encoding='utf-8') as f:
    token = f.read().strip()

def check_lesson(lid):
    url = f"https://courseapi.moon.vn/api/Course/LessonDetail/{lid}"
    req = urllib.request.Request(url, headers={
        'Accept': 'application/json',
        'Authorization': f'Bearer {token}',
        'User-Agent': 'Mozilla/5.0'
    })
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode('utf-8'))
        print(f"\n=== ID {lid}: {data.get('name')} ===")
        print("PageName:", data.get('pageName'))
        print("FileDownload:", data.get('fileDownloadFullUrl') or data.get('fileDownload'))
        print("VideoId:", data.get('videoId'))
        keys = data.get('keyAllEnglish', [])
        print(f"Total Questions/Keys in keyAllEnglish: {len(keys)}")
        if keys:
            print("Sample Question 1:")
            print(json.dumps(keys[0], ensure_ascii=False, indent=2)[:500])
        return data

# Test PDF
check_lesson(13349135)
# Test Checkup 1 (keys)
d = check_lesson(13229524)
with open('sample_quiz.json', 'w', encoding='utf-8') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
