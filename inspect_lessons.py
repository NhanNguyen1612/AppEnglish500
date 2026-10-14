import json
import collections
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('course_2769_all_lessons.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

lessons = d['lessons']
print(f"Total lessons: {len(lessons)}")
types = collections.Counter(l.get('pageName') for l in lessons)
print("Page types:", dict(types))
types_lms = collections.Counter(l.get('contentViewTypeLMS') for l in lessons)
print("LMS types:", dict(types_lms))

print("\nSample items:")
for l in lessons[:12]:
    print(f"- Group: {l.get('group_name')} | [{l.get('pageName')}] {l.get('name')} | ID: {l.get('id')}")
