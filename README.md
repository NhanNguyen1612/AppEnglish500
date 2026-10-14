# 🚀 Moon TOEIC 550+ Pro Study Hub

Ứng dụng web hỗ trợ luyện thi và học tiếng Anh chuyên sâu dựa trên giáo trình khóa học **TOEIC 550+ Moon.vn** (Cô Thảo Min).

---

## ✨ Tính năng nổi bật

1. **📖 Lộ trình học 13 Units (609 bài học):**
   - Đầy đủ bài giảng lý thuyết, video bài giảng, bài tập trắc nghiệm và tài liệu PDF.
   - Nhảy trực tiếp tới video bài giảng và đề thi gốc trên Moon.vn.

2. **✍️ Luyện gõ từ vựng (Word Typing / Spelling Mode):**
   - Luyện nhớ mặt chữ và ngữ nghĩa theo từng bài học (Lesson-based) hoặc toàn khóa.
   - Phát âm bằng **giọng nữ Speecher.org ấm áp, tự nhiên** (Hannah, Isla, Madison, Natalie...).
   - Gợi ý số ký tự và các chữ cái đầu/cuối (`s _ _ _ _ _ y`).
   - Kiểm tra ngay với phím <kbd>Enter</kbd>, hiển thị phiên âm IPA chuẩn và câu ví dụ TOEIC thực tế.

3. **🎧 Nghe chép chính tả (Sentence Dictation):**
   - Nghe đọc cả câu tiếng Anh (tốc độ chuẩn 1.0x hoặc chậm 0.75x).
   - Gõ lại và so sánh chi tiết từng từ (diff xanh/đỏ) để kiểm tra độ chính xác.

4. **🃏 Flashcard SRS & Speed Match Game:**
   - 128+ thẻ từ vựng với phiên âm Anh-Anh, Anh-Mỹ và ví dụ câu.
   - Game nối từ tính giờ tốc độ cao để phản xạ từ vựng.
   - Xuất dữ liệu sang Anki / Quizlet định dạng TSV.

5. **⏱️ Thi thử TOEIC Mini (Mock Test):**
   - Bốc ngẫu nhiên 20 câu hỏi từ ngân hàng câu hỏi khóa học.
   - Đồng hồ đếm ngược 20 phút và tính điểm tự động.

6. **📊 Phân tích điểm yếu & Sổ tay câu sai:**
   - Thống kê tỷ lệ đúng theo từng chủ điểm (Danh từ, Động từ, Giới từ...).
   - Dự đoán band điểm TOEIC hiện tại.
   - Tự động lưu các câu làm sai vào Sổ tay để ôn tập lại.

---

## 🛠️ Cài đặt & Khởi chạy

### 1. Yêu cầu:
- [Node.js](https://nodejs.org/) (phiên bản 18+ hoặc 20+)
- [Python](https://www.python.org/) 3.10+ (để chạy `edge-tts` hỗ trợ âm thanh)

### 2. Cài đặt dependencies:
```bash
npm install
pip install edge-tts
```

### 3. Khởi chạy ứng dụng:
```bash
npm start
```
Mở trình duyệt tại: **http://localhost:3000**

### 4. Chạy với Cloudflare Tunnel (Học trên điện thoại):
Chạy file `Chay_App_Va_Cloudflare.bat` hoặc lệnh:
```bash
npm run tunnel
```
Truy cập qua đường link công khai `https://xxx.trycloudflare.com`.

---

## 📁 Cấu trúc dự án

```text
├── server.js                  # Backend API Express & TTS proxy
├── tts_worker.py              # Xử lý phát âm giọng ấm Speecher.org & Edge TTS
├── public/
│   └── index.html             # Giao diện SPA (Tailwind CSS, Lucide Icons)
├── data/
│   ├── vocab_database.json    # Cơ sở dữ liệu 128+ từ vựng TOEIC
│   ├── study_stats.json       # Thống kê tiến độ & điểm số
│   └── cache/                 # Cache câu hỏi, bài học & file audio
└── package.json
```
