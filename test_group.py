import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

req = urllib.request.Request('https://courseapi.moon.vn/api/Course/CourseDetail/2769', headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))

groups = data.get('groupList', [])
print(f"Total groups: {len(groups)}")
for g in groups:
    print(f"ID: {g.get('id')}, Name: {g.get('name')}, Total items: {g.get('totalLesson', g.get('count', 'N/A'))}")

first_group_id = groups[1].get('id')
print(f"\nTesting LessonInGroup for Group 1 (ID: {first_group_id})...")
lesson_url = f"https://courseapi.moon.vn/api/Course/LessonInGroup/{first_group_id}"
try:
    l_req = urllib.request.Request(lesson_url, headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(l_req) as l_res:
        l_data = json.loads(l_res.read().decode('utf-8'))
        print(f"LessonInGroup status: {l_res.status}")
        if isinstance(l_data, list):
            print(f"Lessons count: {len(l_data)}")
            print("First 2 lessons:")
            for item in l_data[:2]:
                print(json.dumps(item, ensure_ascii=False, indent=2))
        else:
            print("Response:", list(l_data.keys()))
except Exception as e:
    print(f"Error fetching LessonInGroup: {e}")
