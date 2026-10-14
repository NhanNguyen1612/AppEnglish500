const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const QUESTIONS_CACHE_DIR = path.join(CACHE_DIR, 'questions');
const LESSONS_CACHE_DIR = path.join(CACHE_DIR, 'lessons');

[DATA_DIR, CACHE_DIR, QUESTIONS_CACHE_DIR, LESSONS_CACHE_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const NOTEBOOK_FILE = path.join(DATA_DIR, 'notebook.json');
if (!fs.existsSync(NOTEBOOK_FILE)) {
  fs.writeFileSync(NOTEBOOK_FILE, JSON.stringify([]), 'utf8');
}

const STATS_FILE = path.join(DATA_DIR, 'study_stats.json');
if (!fs.existsSync(STATS_FILE)) {
  fs.writeFileSync(STATS_FILE, JSON.stringify({
    totalAnswered: 0,
    totalCorrect: 0,
    history: [],
    topics: {
      "Danh từ (Nouns)": { "total": 0, "correct": 0 },
      "Động từ & Thì (Verbs)": { "total": 0, "correct": 0 },
      "Giới từ (Prepositions)": { "total": 0, "correct": 0 },
      "Tính từ & Trạng từ": { "total": 0, "correct": 0 },
      "Đọc hiểu Thư từ & Email": { "total": 0, "correct": 0 },
      "Ngữ pháp & Từ loại khác": { "total": 0, "correct": 0 }
    }
  }, null, 2), 'utf8');
}

const VOCAB_DB_FILE = path.join(DATA_DIR, 'vocab_database.json');
const MASTERED_VOCAB_FILE = path.join(DATA_DIR, 'mastered_vocab.json');
if (!fs.existsSync(MASTERED_VOCAB_FILE)) {
  fs.writeFileSync(MASTERED_VOCAB_FILE, JSON.stringify([]), 'utf8');
}

function getToken() {
  const tokenFile = path.join(__dirname, 'auth_token.txt');
  if (fs.existsSync(tokenFile)) {
    return fs.readFileSync(tokenFile, 'utf8').trim();
  }
  return '';
}

function getCourseData() {
  const courseFile = path.join(__dirname, 'course_2769_all_lessons.json');
  if (fs.existsSync(courseFile)) {
    return JSON.parse(fs.readFileSync(courseFile, 'utf8'));
  }
  return { course: {}, lessons: [] };
}

async function fetchMoonApi(endpoint) {
  const token = getToken();
  const res = await fetch(`https://courseapi.moon.vn${endpoint}`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Mozilla/5.0'
    }
  });
  if (!res.ok) {
    throw new Error(`Moon API Error ${res.status}: ${res.statusText}`);
  }
  return await res.json();
}

function detectTopic(lessonName, explanation) {
  const text = (lessonName + ' ' + explanation).toLowerCase();
  if (text.includes('noun') || text.includes('danh từ')) return 'Danh từ (Nouns)';
  if (text.includes('verb') || text.includes('động từ') || text.includes('thì') || text.includes('tense')) return 'Động từ & Thì (Verbs)';
  if (text.includes('prep') || text.includes('giới từ')) return 'Giới từ (Prepositions)';
  if (text.includes('adj') || text.includes('tính từ') || text.includes('adv') || text.includes('trạng từ')) return 'Tính từ & Trạng từ';
  if (text.includes('email') || text.includes('letter') || text.includes('thư')) return 'Đọc hiểu Thư từ & Email';
  return 'Ngữ pháp & Từ loại khác';
}

function extractVocab(html) {
  const vocab = [];
  const regex = /([a-zA-Z\s-]+)\s*\((n|v|adj|adv|prep|conj|phr|a)\s*v?\)\s*:\s*([^<\n\r]+)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    vocab.push({
      word: match[1].trim(),
      pos: match[2].trim().toLowerCase() === 'a' ? 'adj' : match[2].trim().toLowerCase(),
      meaning: match[3].trim()
    });
  }
  return vocab;
}

// 1. Get Course Overview & Groups
app.get('/api/course', (req, res) => {
  const { course, lessons } = getCourseData();
  const groups = course.groupList || [];
  
  const groupStats = groups.map(g => {
    const groupLessons = lessons.filter(l => l.group_id === g.id);
    return {
      id: g.id,
      name: g.name,
      total: groupLessons.length,
      quizzes: groupLessons.filter(l => ['keys', 'readingkeys', 'stest-key', 'readingtestonline', 'readingtestoffline'].includes(l.pageName)).length,
      pdfs: groupLessons.filter(l => l.pageName === 'pdf').length,
      videos: groupLessons.filter(l => l.pageName === 'videolesson').length,
      vocab: groupLessons.filter(l => l.pageName === 'vocabulary').length
    };
  });

  res.json({
    course: {
      id: course.id,
      name: course.name,
      teacher: course.teacherName || 'Cô Thảo Min',
      avatar: course.avatarCourseFull
    },
    totalLessons: lessons.length,
    groups: groupStats
  });
});

// 2. Get Lessons for a Group
app.get('/api/lessons', (req, res) => {
  const groupId = parseInt(req.query.group_id);
  const { lessons } = getCourseData();
  const filtered = groupId ? lessons.filter(l => l.group_id === groupId) : lessons;
  res.json(filtered);
});

// 3. Get Lesson Detail
app.get('/api/lesson/:id', async (req, res) => {
  const lessonId = req.params.id;
  const cachePath = path.join(LESSONS_CACHE_DIR, `${lessonId}.json`);

  if (fs.existsSync(cachePath)) {
    return res.json(JSON.parse(fs.readFileSync(cachePath, 'utf8')));
  }

  try {
    const data = await fetchMoonApi(`/api/Course/LessonDetail/${lessonId}`);
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const LESSON_MAP = {
  19715180: 19715199, // Checkup 1 Audio -> Answer Key
  19715207: 19715255, // Checkup 2 Audio -> Answer Key
  19715214: 19715217, // Checkup 3 Audio -> Answer Key
  19715219: 19715220, // Checkup 4 Audio -> Answer Key
  19715222: 19715225, // Checkup 5 Audio -> Answer Key
  19715227: 19715231, // Checkup 6 Audio -> Answer Key
  19715233: 19715236, // Checkup 7 Audio -> Answer Key
  16790979: 13250872, // Checkup 8 Audio -> Answer Key
  16791027: 13250888, // Checkup 9 Audio -> Answer Key
  16791436: 16791275, // MINI TEST 1 Audio -> Answer Key
  16791834: 16791767  // MINI TEST 2 Audio -> Answer Key
};

async function getLessonQuizData(rawLessonId) {
  const lessonId = LESSON_MAP[rawLessonId] || rawLessonId;
  const quizCacheFile = path.join(CACHE_DIR, `quiz_${lessonId}.json`);
  if (fs.existsSync(quizCacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(quizCacheFile, 'utf8'));
    } catch (e) {}
  }

  let lessonDetail;
  const lessonCachePath = path.join(LESSONS_CACHE_DIR, `${lessonId}.json`);
  if (fs.existsSync(lessonCachePath)) {
    lessonDetail = JSON.parse(fs.readFileSync(lessonCachePath, 'utf8'));
  } else {
    lessonDetail = await fetchMoonApi(`/api/Course/LessonDetail/${lessonId}`);
    fs.writeFileSync(lessonCachePath, JSON.stringify(lessonDetail, null, 2), 'utf8');
  }

  const keyAll = lessonDetail.keyAllEnglish || [];
  if (!keyAll.length) {
    return { lessonId, title: lessonDetail.name, totalQuestions: 0, questions: [] };
  }

  const questionPromises = keyAll.map(async (k, index) => {
    const qId = k.questionId;
    const qCachePath = path.join(QUESTIONS_CACHE_DIR, `${qId}.json`);
    let qData;

    if (fs.existsSync(qCachePath)) {
      qData = JSON.parse(fs.readFileSync(qCachePath, 'utf8'));
    } else {
      try {
        qData = await fetchMoonApi(`/api/Course/ItemQuestion/${qId}`);
        fs.writeFileSync(qCachePath, JSON.stringify(qData, null, 2), 'utf8');
      } catch (e) {
        qData = { questionId: qId, questionText: 'Không thể tải câu hỏi.', key: k.key };
      }
    }

    const rawAns = qData.answer || '';
    const qText = qData.questionText || '';
    const cleanStr = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const hasABCD = rawAns.includes('(A)') && rawAns.includes('(B)') && rawAns.includes('(C)') && rawAns.includes('(D)');
    const isFillBlank = qText.includes('____') || (!hasABCD && rawAns.includes('<b>'));

    let type = 'multiple-choice';
    let photoOptions = null;
    let blankPart = '';
    let fullSentence = '';
    let vietnamese = '';

    const mImg = qText.match(/src="([^"]+)"/);
    const image = (qData.advImage || '').trim() || (mImg ? mImg[1] : '');

    if (hasABCD || (image && !qData.a)) {
      type = 'photo-listen';
      let enPart = rawAns;
      let viPart = '';
      if (rawAns.includes('Tạm dịch:')) {
        const parts = rawAns.split(/Tạm dịch:\s*<\/b><br>|Tạm dịch:\s*<br>|Tạm dịch:/i);
        enPart = parts[0] || '';
        viPart = parts[1] || '';
      } else if (rawAns.includes('<br><br>')) {
        const parts = rawAns.split(/<br\s*\/?>\s*<br\s*\/?>/i);
        enPart = parts[0] || '';
        viPart = parts[1] || '';
      }

      const extractOptions = (block) => {
        const a = (block.match(/\(A\)\s*([\s\S]*?)(?=(?:\(B\)|\(C\)|\(D\)|$))/i) || [])[1] || '';
        const b = (block.match(/\(B\)\s*([\s\S]*?)(?=(?:\(C\)|\(D\)|$))/i) || [])[1] || '';
        const c = (block.match(/\(C\)\s*([\s\S]*?)(?=(?:\(D\)|$))/i) || [])[1] || '';
        const d = (block.match(/\(D\)\s*([\s\S]*?)(?=(?:<br\s*\/?>\s*<br\s*\/?>|$))/i) || [])[1] || '';
        return { A: cleanStr(a), B: cleanStr(b), C: cleanStr(c), D: cleanStr(d) };
      };

      const en = extractOptions(enPart);
      const vi = extractOptions(viPart);
      photoOptions = {
        A: { text: en.A, vi: vi.A },
        B: { text: en.B, vi: vi.B },
        C: { text: en.C, vi: vi.C },
        D: { text: en.D, vi: vi.D }
      };
    } else if (isFillBlank) {
      type = 'fill-blank';
      const bMatch = rawAns.match(/<b>(.*?)<\/b>/i);
      blankPart = bMatch ? bMatch[1].replace(/&nbsp;/g, ' ').trim() : '';
      const parts = rawAns.split(/<br\s*\/?>/i);
      fullSentence = (parts[0] || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      vietnamese = (parts[1] || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    const parsedVocab = extractVocab(rawAns);
    const topic = (type === 'photo-listen' || lessonDetail.name.includes('Part 1')) ? 'Listening Part 1' : detectTopic(lessonDetail.name, rawAns);
    const passage = qData.conetentEnglish || qData.contentEnglish || '';
    const passageTitle = qData.titleEnglish || '';

    return {
      order: k.order || (index + 1),
      questionId: qId,
      type,
      questionText: qText,
      passage: passage.trim(),
      passageTitle: passageTitle.trim(),
      image,
      a: qData.a || (photoOptions?.A?.text) || 'A',
      b: qData.b || (photoOptions?.B?.text) || 'B',
      c: qData.c || (photoOptions?.C?.text) || 'C',
      d: qData.d || (photoOptions?.D?.text) || 'D',
      photoOptions,
      blankPart,
      fullSentence,
      vietnamese,
      key: (qData.key || k.key || '').trim().toUpperCase(),
      explanation: rawAns,
      audioUrl: qData.audioUrl || '',
      topic,
      vocabList: parsedVocab
    };
  });

  const questions = await Promise.all(questionPromises);

  const fullQuiz = {
    lessonId,
    title: lessonDetail.name,
    totalQuestions: questions.length,
    audioUrl: questions.find(q => q.audioUrl)?.audioUrl || '',
    questions
  };

  fs.writeFileSync(quizCacheFile, JSON.stringify(fullQuiz, null, 2), 'utf8');
  return fullQuiz;
}

// 4. Get Full Quiz
app.get('/api/quiz/:lessonId', async (req, res) => {
  const lessonId = req.params.lessonId;
  try {
    const fullQuiz = await getLessonQuizData(lessonId);
    res.json(fullQuiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Mock Exam Generator (20 Random Questions)
app.get('/api/mock-test', (req, res) => {
  const allQuestions = [];
  if (fs.existsSync(QUESTIONS_CACHE_DIR)) {
    const files = fs.readdirSync(QUESTIONS_CACHE_DIR);
    files.forEach(f => {
      if (f.endsWith('.json')) {
        try {
          const q = JSON.parse(fs.readFileSync(path.join(QUESTIONS_CACHE_DIR, f), 'utf8'));
          if (q.questionText && q.key && (q.a || q.b || q.c || q.d)) {
            allQuestions.push({
              questionId: q.questionId,
              questionText: q.questionText,
              passage: (q.conetentEnglish || q.contentEnglish || '').trim(),
              passageTitle: (q.titleEnglish || '').trim(),
              image: (q.advImage || '').trim(),
              a: q.a,
              b: q.b,
              c: q.c,
              d: q.d,
              key: q.key.trim().toUpperCase(),
              explanation: q.answer || '',
              topic: detectTopic('', q.answer || ''),
              vocabList: extractVocab(q.answer || '')
            });
          }
        } catch (e) {}
      }
    });
  }

  // Shuffle and pick 20
  const shuffled = allQuestions.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(20, shuffled.length)).map((q, idx) => ({
    ...q,
    order: idx + 1
  }));

  res.json({
    title: 'Đề Thi Thử TOEIC Mini (20 Câu ngẫu nhiên)',
    durationMinutes: 20,
    totalQuestions: selected.length,
    questions: selected
  });
});

// 6. Dictation & Word Typing Mode API
app.get('/api/dictation/items', async (req, res) => {
  const lessonId = req.query.lessonId || 'all';
  const mode = req.query.mode || 'word'; // 'word' or 'sentence'

  // Load vocab database for enriching IPA and examples
  let vocabDb = [];
  if (fs.existsSync(VOCAB_DB_FILE)) {
    try { vocabDb = JSON.parse(fs.readFileSync(VOCAB_DB_FILE, 'utf8')); } catch (e) {}
  }
  const vocabMap = new Map();
  vocabDb.forEach(v => {
    if (v.word) vocabMap.set(v.word.toLowerCase().trim(), v);
  });

  try {
    if (lessonId && lessonId !== 'all') {
      const quiz = await getLessonQuizData(lessonId);
      const questions = quiz.questions || [];

      if (mode === 'word') {
        const words = [];
        const seen = new Set();

        questions.forEach(q => {
          // 1. From vocabList
          (q.vocabList || []).forEach(v => {
            const wClean = (v.word || '').trim();
            const wKey = wClean.toLowerCase();
            if (wClean && !seen.has(wKey)) {
              seen.add(wKey);
              const dbInfo = vocabMap.get(wKey) || {};
              words.push({
                id: `v_${q.questionId}_${words.length}`,
                word: wClean,
                pos: v.pos || dbInfo.pos || 'từ vựng',
                meaning: v.meaning || dbInfo.meaning || 'Từ vựng quan trọng',
                ipa: dbInfo.pronunciation_us || dbInfo.pronunciation_uk || '',
                example: dbInfo.example || q.questionText.replace(/_{2,}/g, wClean).replace(/\s+/g, ' ').trim()
              });
            }
          });

          // 2. From target answer word
          const key = (q.key || '').trim().toLowerCase();
          const targetWord = (q[key] || '').trim();
          const targetClean = targetWord.replace(/[^a-zA-Z-]/g, '').trim();
          const targetKey = targetClean.toLowerCase();
          if (targetClean.length > 2 && !seen.has(targetKey)) {
            seen.add(targetKey);
            const dbInfo = vocabMap.get(targetKey) || {};
            const cleanMeaning = (q.explanation || '')
              .replace(/<[^>]*>?/gm, ' ')
              .replace(/\s+/g, ' ')
              .slice(0, 150)
              .trim();
            words.push({
              id: `w_${q.questionId}`,
              word: targetClean,
              pos: dbInfo.pos || 'từ trọng tâm',
              meaning: dbInfo.meaning || cleanMeaning || 'Đáp án đúng trong đề',
              ipa: dbInfo.pronunciation_us || dbInfo.pronunciation_uk || '',
              example: q.questionText.replace(/_{2,}/g, targetClean).replace(/\s+/g, ' ').trim()
            });
          }
        });

        if (words.length === 0) {
          questions.forEach(q => {
            if (q.blankPart) {
              const cleanWords = q.blankPart.split(/\s+/).filter(w => w.length > 2);
              cleanWords.forEach(w => {
                const wClean = w.replace(/[^a-zA-Z]/g, '').trim();
                if (wClean && !seen.has(wClean.toLowerCase())) {
                  seen.add(wClean.toLowerCase());
                  const dbInfo = vocabMap.get(wClean.toLowerCase()) || {};
                  words.push({
                    id: `w_${q.questionId}_${words.length}`,
                    word: wClean,
                    pos: dbInfo.pos || 'từ trong bài nghe',
                    meaning: dbInfo.meaning || q.vietnamese || 'Từ vựng trong bài nghe',
                    ipa: dbInfo.ipa || dbInfo.phonetic || '',
                    example: q.fullSentence || ''
                  });
                }
              });
            }
          });
        }

        // If lesson has few words, supplement from general vocab database
        if (words.length < 3 && vocabDb.length) {
          vocabDb.slice(0, 10).forEach(v => {
            if (!seen.has(v.word.toLowerCase())) {
              seen.add(v.word.toLowerCase());
              words.push({
                id: `db_${words.length}`,
                word: v.word,
                pos: v.pos || 'vocab',
                meaning: v.meaning,
                ipa: v.ipa || v.phonetic || '',
                example: v.example || ''
              });
            }
          });
        }

        return res.json({
          mode: 'word',
          lessonId,
          title: quiz.title || 'Bài học',
          total: words.length,
          items: words
        });
      } else {
        // mode === 'sentence'
        const sentences = [];
        questions.forEach(q => {
          if (q.fullSentence) {
            sentences.push({
              questionId: q.questionId,
              targetWord: q.blankPart || '',
              originalQuestion: q.questionText,
              fullSentence: q.fullSentence,
              explanation: q.vietnamese || q.explanation || '',
              vietnamese: q.vietnamese || ''
            });
          } else {
            const key = (q.key || '').trim().toLowerCase();
            const correctWord = (q[key] || '').trim();
            if (q.questionText && q.questionText.length > 10 && correctWord) {
              const fullSentence = q.questionText.replace(/_{2,}/g, correctWord).replace(/\s+/g, ' ').trim();
              sentences.push({
                questionId: q.questionId,
                targetWord: correctWord,
                originalQuestion: q.questionText,
                fullSentence,
                explanation: q.explanation || ''
              });
            }
          }
        });

        return res.json({
          mode: 'sentence',
          lessonId,
          title: quiz.title || 'Bài học',
          total: sentences.length,
          items: sentences
        });
      }
    } else {
      // All lessons
      if (mode === 'word') {
        const words = vocabDb.map((v, i) => ({
          id: `all_w_${i}`,
          word: v.word,
          pos: v.pos || 'vocab',
          meaning: v.meaning,
          ipa: v.pronunciation_us || v.pronunciation_uk || '',
          example: v.example || ''
        }));
        return res.json({
          mode: 'word',
          lessonId: 'all',
          title: 'Toàn bộ từ vựng khóa học',
          total: words.length,
          items: words
        });
      } else {
        // All sentences from cached questions
        const sentences = [];
        if (fs.existsSync(QUESTIONS_CACHE_DIR)) {
          const files = fs.readdirSync(QUESTIONS_CACHE_DIR);
          files.forEach(f => {
            if (f.endsWith('.json')) {
              try {
                const q = JSON.parse(fs.readFileSync(path.join(QUESTIONS_CACHE_DIR, f), 'utf8'));
                if (q.questionText && q.questionText.length > 15 && q.key) {
                  const correctWord = (q[q.key.toLowerCase()] || '').trim();
                  if (correctWord) {
                    const fullSentence = q.questionText.replace(/_{2,}/g, correctWord).replace(/\s+/g, ' ').trim();
                    sentences.push({
                      questionId: q.questionId,
                      targetWord: correctWord,
                      originalQuestion: q.questionText,
                      fullSentence,
                      explanation: q.answer || ''
                    });
                  }
                }
              } catch (e) {}
            }
          });
        }
        return res.json({
          mode: 'sentence',
          lessonId: 'all',
          title: 'Toàn bộ câu hỏi nghe chép',
          total: sentences.length,
          items: sentences
        });
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dictation/random', async (req, res) => {
  const lessonId = req.query.lessonId || 'all';
  const mode = req.query.mode || 'sentence';
  try {
    const qUrl = `/api/dictation/items?lessonId=${lessonId}&mode=${mode}`;
    // Reuse internal logic
    req.query.lessonId = lessonId;
    req.query.mode = mode;
    // Simple fetch from files
    const candidates = [];
    if (fs.existsSync(QUESTIONS_CACHE_DIR)) {
      const files = fs.readdirSync(QUESTIONS_CACHE_DIR);
      files.forEach(f => {
        if (f.endsWith('.json')) {
          try {
            const q = JSON.parse(fs.readFileSync(path.join(QUESTIONS_CACHE_DIR, f), 'utf8'));
            if (q.questionText && q.questionText.length > 20 && q.key) {
              const correctWord = q[q.key.toLowerCase()] || '';
              const fullSentence = q.questionText.replace(/_{2,}/g, correctWord).replace(/\s+/g, ' ').trim();
              candidates.push({
                questionId: q.questionId,
                targetWord: correctWord,
                originalQuestion: q.questionText,
                fullSentence,
                explanation: q.answer || ''
              });
            }
          } catch (e) {}
        }
      });
    }
    if (!candidates.length) return res.status(404).json({ error: 'Chưa có đủ câu hỏi.' });
    const randomItem = candidates[Math.floor(Math.random() * candidates.length)];
    res.json(randomItem);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 7. Study Stats & Analytics
app.get('/api/analytics', (req, res) => {
  try {
    const stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    const total = stats.totalAnswered || 0;
    const correct = stats.totalCorrect || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Estimate TOEIC score based on practice accuracy
    // Baseline: 550 scale
    let estimatedScore = 250;
    if (total >= 5) {
      if (accuracy >= 90) estimatedScore = 700;
      else if (accuracy >= 80) estimatedScore = 620;
      else if (accuracy >= 70) estimatedScore = 560;
      else if (accuracy >= 60) estimatedScore = 500;
      else if (accuracy >= 50) estimatedScore = 440;
      else estimatedScore = 380;
    }

    res.json({
      totalAnswered: total,
      totalCorrect: correct,
      accuracy,
      estimatedScore,
      topics: stats.topics || {},
      recentHistory: (stats.history || []).slice(-10).reverse()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/record-answer', (req, res) => {
  const { questionId, topic, isCorrect, lessonTitle } = req.body;
  try {
    const stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    stats.totalAnswered = (stats.totalAnswered || 0) + 1;
    if (isCorrect) stats.totalCorrect = (stats.totalCorrect || 0) + 1;

    const t = topic || 'Ngữ pháp & Từ loại khác';
    if (!stats.topics[t]) stats.topics[t] = { total: 0, correct: 0 };
    stats.topics[t].total += 1;
    if (isCorrect) stats.topics[t].correct += 1;

    if (!stats.history) stats.history = [];
    stats.history.push({
      questionId,
      topic: t,
      isCorrect,
      lessonTitle: lessonTitle || 'Luyện tập',
      timestamp: new Date().toISOString()
    });

    if (stats.history.length > 50) stats.history = stats.history.slice(-50);

    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
    res.json({ success: true, stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 8. Notebook
app.get('/api/notebook', (req, res) => {
  const notebook = JSON.parse(fs.readFileSync(NOTEBOOK_FILE, 'utf8'));
  res.json(notebook);
});

app.post('/api/notebook', (req, res) => {
  const item = req.body;
  let notebook = JSON.parse(fs.readFileSync(NOTEBOOK_FILE, 'utf8'));
  
  const existingIndex = notebook.findIndex(n => n.questionId === item.questionId);
  if (existingIndex >= 0) {
    notebook[existingIndex] = { ...notebook[existingIndex], ...item, updatedAt: new Date().toISOString() };
  } else {
    notebook.unshift({
      ...item,
      addedAt: new Date().toISOString(),
      mastered: false,
      reviewCount: 0
    });
  }

  fs.writeFileSync(NOTEBOOK_FILE, JSON.stringify(notebook, null, 2), 'utf8');
  res.json({ success: true, total: notebook.length });
});

app.delete('/api/notebook/:questionId', (req, res) => {
  const qId = parseInt(req.params.questionId);
  let notebook = JSON.parse(fs.readFileSync(NOTEBOOK_FILE, 'utf8'));
  notebook = notebook.filter(n => n.questionId !== qId);
  fs.writeFileSync(NOTEBOOK_FILE, JSON.stringify(notebook, null, 2), 'utf8');
  res.json({ success: true, total: notebook.length });
});

// 9. Flashcards with Anki Export
app.get('/api/flashcards', (req, res) => {
  let flashcards = [];
  if (fs.existsSync(VOCAB_DB_FILE)) {
    try {
      flashcards = JSON.parse(fs.readFileSync(VOCAB_DB_FILE, 'utf8'));
    } catch (e) {}
  }

  let mastered = [];
  try {
    mastered = JSON.parse(fs.readFileSync(MASTERED_VOCAB_FILE, 'utf8'));
  } catch (e) {}
  const masteredSet = new Set(mastered);

  const formatted = flashcards.map(f => ({
    ...f,
    isMastered: masteredSet.has(f.word.toLowerCase())
  }));

  res.json({
    total: formatted.length,
    masteredCount: formatted.filter(f => f.isMastered).length,
    flashcards: formatted
  });
});

app.post('/api/flashcards/toggle-mastered', (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: 'Word required' });
  let mastered = [];
  try {
    mastered = JSON.parse(fs.readFileSync(MASTERED_VOCAB_FILE, 'utf8'));
  } catch (e) {}
  const w = word.toLowerCase();
  if (mastered.includes(w)) {
    mastered = mastered.filter(x => x !== w);
  } else {
    mastered.push(w);
  }
  fs.writeFileSync(MASTERED_VOCAB_FILE, JSON.stringify(mastered, null, 2), 'utf8');
  res.json({ success: true, isMastered: mastered.includes(w) });
});

// 10. Export to Anki / Quizlet CSV
app.get('/api/export-anki', (req, res) => {
  let flashcards = [];
  if (fs.existsSync(VOCAB_DB_FILE)) {
    try {
      flashcards = JSON.parse(fs.readFileSync(VOCAB_DB_FILE, 'utf8'));
    } catch (e) {}
  }

  // Format: Front \t Back \n
  let tsvContent = "\uFEFFFront\tBack\n";
  flashcards.forEach(f => {
    const front = `${f.word} (${(f.pos || 'vocab').toUpperCase()})`;
    const back = `${f.meaning}<br><br><i>Ví dụ: ${f.example || ''}</i>`;
    tsvContent += `"${front.replace(/"/g, '""')}"\t"${back.replace(/"/g, '""')}"\n`;
  });

  res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="moon_toeic_550_flashcards.tsv"');
  res.send(tsvContent);
});

// 10b. Moon Original Audio Stream Proxy
app.get('/api/audio-proxy', async (req, res) => {
  const audioUrl = (req.query.url || '').trim();
  if (!audioUrl) return res.status(400).send('URL required');
  try {
    const upstream = await fetch(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Referer': 'https://moon.vn/',
        'Origin': 'https://moon.vn'
      }
    });
    if (!upstream.ok) return res.status(upstream.status).send('Audio fetch failed');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).send('Audio proxy error: ' + err.message);
  }
});

// 11. High Quality Warm Female Voice TTS (Speecher.org / Edge Neural)
const crypto = require('crypto');
const { execFile } = require('child_process');
const AUDIO_CACHE_DIR = path.join(CACHE_DIR, 'audio');
if (!fs.existsSync(AUDIO_CACHE_DIR)) fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });

app.get('/api/tts', (req, res) => {
  const text = (req.query.text || '').trim();
  const speed = req.query.speed || '1.0';
  const voice = (req.query.voice || 'speecher:hannah').trim();
  if (!text) return res.status(400).send('Text required');

  let rate = '+0%';
  const s = parseFloat(speed);
  if (s <= 0.8) rate = '-20%';
  else if (s >= 1.2) rate = '+20%';

  const hash = crypto.createHash('md5').update(`${voice}_${text}_${rate}`).digest('hex');
  const cacheFile = path.join(AUDIO_CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(cacheFile)) {
    res.setHeader('Content-Type', 'audio/mpeg');
    return fs.createReadStream(cacheFile).pipe(res);
  }

  // Generate with Python tts_worker.py (Default: speecher:hannah - warm natural female voice)
  const workerScript = path.join(__dirname, 'tts_worker.py');
  execFile('python', [workerScript, text, cacheFile, voice, rate], (err) => {
    if (err || !fs.existsSync(cacheFile)) {
      // Fallback: Google TTS female voice redirect
      const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=en&client=tw-ob`;
      return res.redirect(googleUrl);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    fs.createReadStream(cacheFile).pipe(res);
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 TOEIC Moon.vn English Study App Pro is running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
