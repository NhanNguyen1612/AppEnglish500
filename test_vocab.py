import json
import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('course_2769_all_lessons.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

vocab_lessons = [l for l in d['lessons'] if l.get('pageName') == 'vocabulary']
print(f"Total vocab lessons: {len(vocab_lessons)}")
for v in vocab_lessons:
    print(f"- {v.get('group_name')}: {v.get('name')} (ID: {v.get('id')})")

sample_id = vocab_lessons[0].get('id')
print(f"\nTesting endpoints for vocab ID: {sample_id}...")

endpoints_to_try = [
    f"https://courseapi.moon.vn/api/tiktok/ListVideoByLesson/{sample_id}",
    f"https://courseapi.moon.vn/api/tiktok/TikTokVocabularyBySaveCourse/2769",
    f"https://courseapi.moon.vn/api/Course/LessonDetail/{sample_id}",
    f"https://courseapi.moon.vn/api/Course/ItemQuestion/{sample_id}",
]

for ep in endpoints_to_try:
    try:
        req = urllib.request.Request(ep, headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as res:
            print(f"[SUCCESS {res.status}] {ep}")
            content = res.read().decode('utf-8')
            print(content[:300])
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] {ep}")
    except Exception as e:
        print(f"[ERR] {ep} -> {e}")
