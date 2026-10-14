import urllib.request
import json
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

req = urllib.request.Request('https://courseapi.moon.vn/api/Course/CourseDetail/2769', headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as res:
    course_data = json.loads(res.read().decode('utf-8'))

groups = course_data.get('groupList', [])
print(f"Course: {course_data.get('name')}")
print(f"Total Groups: {len(groups)}")

all_lessons = []
for g in groups:
    gid = g.get('id')
    gname = g.get('name')
    url = f"https://courseapi.moon.vn/api/Course/LessonInGroup/{gid}"
    try:
        l_req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(l_req) as l_res:
            items = json.loads(l_res.read().decode('utf-8'))
            print(f"Group '{gname}' (ID: {gid}) -> {len(items)} lessons")
            for it in items:
                it['group_id'] = gid
                it['group_name'] = gname
            all_lessons.extend(items)
    except Exception as e:
        print(f"Group '{gname}' -> Error: {e}")

print(f"\nTOTAL LESSONS FETCHED: {len(all_lessons)}")

with open('course_2769_all_lessons.json', 'w', encoding='utf-8') as f:
    json.dump({'course': course_data, 'lessons': all_lessons}, f, ensure_ascii=False, indent=2)

print("Saved to course_2769_all_lessons.json successfully!")
