import urllib.request
import json

urls = [
    'https://courseapi.moon.vn/api/Course/Detail/2769',
    'https://courseapi.moon.vn/api/Course/GetDetail/2769',
    'https://courseapi.moon.vn/api/Course/GetCourseDetail?id=2769',
    'https://courseapi.moon.vn/api/Course/2769',
    'https://courseapi.moon.vn/api/CourseDetail/2769',
    'https://courseapi.moon.vn/api/Course/Detail?courseId=2769',
    'https://courseapi.moon.vn/api/Course/GetCourseById?id=2769',
    'https://courseapi.moon.vn/api/Course/GetLessons?courseId=2769',
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as res:
            print(f"[SUCCESS] {url} -> {res.status}")
            data = res.read(500)
            print(data.decode('utf-8', errors='ignore'))
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] {url}")
    except Exception as e:
        print(f"[ERR] {url} -> {e}")
