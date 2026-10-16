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
const VOCAB_LESSON_CACHE_DIR = path.join(CACHE_DIR, 'vocab_lessons');

[DATA_DIR, CACHE_DIR, QUESTIONS_CACHE_DIR, LESSONS_CACHE_DIR, VOCAB_LESSON_CACHE_DIR].forEach(dir => {
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
  const groupId = parseInt(req.query.group_id || req.query.groupId);
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

function resolveLessonId(rawLessonId) {
  if (LESSON_MAP[rawLessonId]) return LESSON_MAP[rawLessonId];
  const { lessons } = getCourseData();
  const cur = lessons.find(l => l.id == rawLessonId);
  if (!cur) return rawLessonId;

  const name = cur.name || '';
  // Audio lesson -> Answer Key lesson
  if (name.includes('Audio')) {
    const base = name.replace(/-\s*Audio.*/i, '').trim();
    const pair = lessons.find(l => l.group_id === cur.group_id && l.id != cur.id && l.name.includes(base) && l.name.includes('Answer Key'));
    if (pair) return pair.id;
  }
  // Chữa lesson -> Test lesson
  if (name.includes('Chữa') || name.includes('Ch?a')) {
    const targetName = name.replace(/Chữa\s*|Ch\?a\s*/gi, '').trim();
    const pair = lessons.find(l => l.group_id === cur.group_id && l.id != cur.id && (l.name.trim() === targetName || l.name.trim() === targetName + ' - Answer Key'));
    if (pair) return pair.id;
  }
  return rawLessonId;
}

async function getLessonVocabulary(lessonId) {
  const cacheFile = path.join(VOCAB_LESSON_CACHE_DIR, `${lessonId}.json`);

  let lessonDetail;
  const lessonCachePath = path.join(LESSONS_CACHE_DIR, `${lessonId}.json`);
  if (fs.existsSync(lessonCachePath)) {
    try { lessonDetail = JSON.parse(fs.readFileSync(lessonCachePath, 'utf8')); } catch (e) {}
  }
  if (!lessonDetail) {
    try {
      lessonDetail = await fetchMoonApi(`/api/Course/LessonDetail/${lessonId}`);
      fs.writeFileSync(lessonCachePath, JSON.stringify(lessonDetail, null, 2), 'utf8');
    } catch (e) {
      const { lessons } = getCourseData();
      const match = lessons.find(l => l.id == lessonId);
      lessonDetail = { name: match ? match.name : 'Từ vựng chủ đề' };
    }
  }

  // Check cache: must exist, have words, and if lessonDetail has sumTest > 0, cache must be complete
  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached && cached.words && cached.words.length > 0) {
        const expectedCount = lessonDetail.sumTest && lessonDetail.sumTest > 0 ? lessonDetail.sumTest : 0;
        if (cached.isComplete && (!expectedCount || cached.words.length >= expectedCount)) {
          return cached;
        }
      }
    } catch (e) {}
  }

  let words = [];
  const seen = new Set();

  // 1. SOURCE A: Moon.vn FlashCard API (/api/Quiz/QuizFlashCardByLesson/:id)
  // This provides full flashcard word list with illustrations, audio, IPA, definition and example sentences
  try {
    const fcData = await fetchMoonApi(`/api/Quiz/QuizFlashCardByLesson/${lessonId}`);
    if (fcData && Array.isArray(fcData.listVocabularyModel) && fcData.listVocabularyModel.length > 0) {
      fcData.listVocabularyModel.forEach((item, idx) => {
        const w = (item.name || '').trim();
        if (!w || seen.has(w.toLowerCase())) return;
        seen.add(w.toLowerCase());

        let example = '';
        let exampleTranslation = '';
        if (Array.isArray(item.listExamVocabulary) && item.listExamVocabulary.length > 0) {
          example = (item.listExamVocabulary[0].name || '').replace(/<[^>]*>/g, '').trim();
          exampleTranslation = (item.listExamVocabulary[0].definition || '').replace(/<[^>]*>/g, '').trim();
        }

        let pos = (item.type || '').trim().toLowerCase();
        if (!pos) pos = 'từ vựng';
        else if (pos === 'n') pos = 'danh từ';
        else if (pos === 'np') pos = 'cụm danh từ';
        else if (pos === 'v') pos = 'động từ';
        else if (pos === 'vp') pos = 'cụm động từ';
        else if (pos === 'adj') pos = 'tính từ';
        else if (pos === 'adv') pos = 'trạng từ';
        else if (pos === 'prep') pos = 'giới từ';

        words.push({
          id: item.id || `fc_${lessonId}_${idx}`,
          word: w,
          ipa: (item.spelling || '').trim(),
          pronunciation_us: (item.spelling || '').trim(),
          phonetic: (item.spelling || '').trim(),
          meaning: (item.definition || '').trim(),
          pos: pos,
          imageUrl: item.imageUrl || '',
          audioUrl: item.audioUrl || '',
          example: example,
          exampleTranslation: exampleTranslation,
          lesson: lessonDetail.name || 'Từ vựng chủ đề',
          lessonId
        });
      });
    }
  } catch (err) {
    console.warn(`[Vocab] QuizFlashCardByLesson error for ${lessonId}:`, err.message);
  }

  // 2. SOURCE B: Moon.vn TikTokVocabularyTesting with multi-iteration discovery
  // If FlashCard API didn't return or has fewer than expected items, run multi-iteration discovery
  const targetCount = lessonDetail.sumTest && lessonDetail.sumTest > 0 ? lessonDetail.sumTest : 0;
  if (words.length === 0 || (targetCount > 0 && words.length < targetCount)) {
    try {
      const questionsById = new Map();
      let consecutiveNoNew = 0;
      let attempts = 0;
      const maxAttempts = 18;

      while (attempts < maxAttempts && consecutiveNoNew < 4) {
        attempts++;
        try {
          const vItems = await fetchMoonApi(`/api/tiktok/TikTokVocabularyTesting/${lessonId}`);
          if (Array.isArray(vItems) && vItems.length > 0) {
            let added = 0;
            for (const q of vItems) {
              if (!questionsById.has(q.id)) {
                questionsById.set(q.id, q);
                added++;
              }
            }
            if (added === 0) consecutiveNoNew++;
            else consecutiveNoNew = 0;

            if (targetCount > 0 && questionsById.size >= targetCount) break;
          } else {
            break;
          }
        } catch (e) {
          break;
        }
      }

      // First pass: Target question items
      for (const item of questionsById.values()) {
        const k = (item.key || 'A').toUpperCase();
        let mainWord = '';
        let mainDef = '';
        let mainIpa = (item['spelling' + k] || '').trim();
        let mainAudio = item.audioUrl || item['audio' + k + 'Url'] || '';

        if (item.typeId === 10) {
          mainDef = (item.questionText || item['definition' + k] || '').trim();
          mainWord = (item[k.toLowerCase()] || '').trim();
        } else {
          mainWord = (item.questionText || item[k.toLowerCase()] || '').trim();
          mainDef = (item['definition' + k] || '').trim();
        }

        if (mainWord && !seen.has(mainWord.toLowerCase())) {
          seen.add(mainWord.toLowerCase());
          words.push({
            id: item.id || `v_${lessonId}_${words.length}`,
            word: mainWord,
            ipa: mainIpa,
            pronunciation_us: mainIpa,
            phonetic: mainIpa,
            meaning: mainDef,
            pos: 'từ vựng',
            imageUrl: '',
            audioUrl: mainAudio,
            example: item.questionText && item.questionText !== mainWord && item.typeId !== 10 ? item.questionText : '',
            exampleTranslation: '',
            lesson: lessonDetail.name || 'Từ vựng chủ đề',
            lessonId
          });
        }
      }

      // Second pass: valid choice items with definitions
      for (const item of questionsById.values()) {
        ['A', 'B', 'C', 'D'].forEach(opt => {
          const w = (item[opt.toLowerCase()] || '').trim();
          const def = (item['definition' + opt] || '').trim();
          const ipa = (item['spelling' + opt] || '').trim();
          const audio = item['audio' + opt + 'Url'] || '';
          if (w && def && !seen.has(w.toLowerCase())) {
            seen.add(w.toLowerCase());
            words.push({
              id: item['id' + opt.toLowerCase()] || `v_${lessonId}_${words.length}_${opt}`,
              word: w,
              ipa: ipa,
              pronunciation_us: ipa,
              phonetic: ipa,
              meaning: def,
              pos: 'từ vựng',
              imageUrl: '',
              audioUrl: audio,
              example: '',
              exampleTranslation: '',
              lesson: lessonDetail.name || 'Từ vựng chủ đề',
              lessonId
            });
          }
        });
      }
    } catch (err) {
      console.warn(`[Vocab] TikTokVocabularyTesting error for ${lessonId}:`, err.message);
    }
  }

  // 3. SOURCE C: Quiz questions fallback
  if (words.length === 0) {
    try {
      const quiz = await getLessonQuizData(lessonId);
      (quiz.questions || []).forEach(q => {
        (q.vocabList || []).forEach(v => {
          if (v.word && !seen.has(v.word.toLowerCase())) {
            seen.add(v.word.toLowerCase());
            words.push({
              id: `qz_${q.questionId}_${words.length}`,
              word: v.word,
              ipa: v.ipa || '',
              pronunciation_us: v.ipa || '',
              phonetic: v.ipa || '',
              meaning: v.meaning || '',
              pos: v.pos || 'từ vựng',
              imageUrl: '',
              audioUrl: '',
              example: q.questionText || '',
              exampleTranslation: '',
              lesson: lessonDetail.name || 'Từ vựng',
              lessonId
            });
          }
        });
      });
    } catch (e) {}
  }

  // Auto-enrich audioUrl with Moon dictionary audio where missing
  for (const w of words) {
    if (!w.audioUrl && w.word) {
      const cleanW = w.word.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '');
      if (!cleanW.includes(' ') && cleanW.length > 2) {
        w.audioUrl = `https://media.moon.vn/dictionary/audio/us?id=${encodeURIComponent(cleanW)}`;
      }
    }
  }

  const result = {
    lessonId,
    title: lessonDetail.name || 'Từ vựng chủ đề',
    total: words.length,
    isComplete: true,
    words
  };

  if (words.length > 0) {
    fs.writeFileSync(cacheFile, JSON.stringify(result, null, 2), 'utf8');

    // Enrich master vocab database
    try {
      if (fs.existsSync(VOCAB_DB_FILE)) {
        const db = JSON.parse(fs.readFileSync(VOCAB_DB_FILE, 'utf8'));
        const existingMap = new Map();
        db.forEach((d, i) => existingMap.set(d.word.toLowerCase(), i));
        let added = false;
        words.forEach(w => {
          const key = w.word.toLowerCase();
          if (!existingMap.has(key)) {
            db.push({
              word: w.word,
              pos: w.pos || 'từ vựng',
              meaning: w.meaning,
              example: w.example || '',
              lesson: lessonDetail.name,
              ipa: w.ipa || '',
              phonetic: w.ipa || '',
              pronunciation_us: w.ipa || '',
              imageUrl: w.imageUrl || '',
              audioUrl: w.audioUrl || ''
            });
            added = true;
          } else {
            const item = db[existingMap.get(key)];
            if (!item.audioUrl && w.audioUrl) item.audioUrl = w.audioUrl;
            if (!item.imageUrl && w.imageUrl) item.imageUrl = w.imageUrl;
            if (!item.ipa && w.ipa) {
              item.ipa = w.ipa;
              item.phonetic = w.ipa;
              item.pronunciation_us = w.ipa;
            }
          }
        });
        if (added) {
          fs.writeFileSync(VOCAB_DB_FILE, JSON.stringify(db, null, 2), 'utf8');
        }
      }
    } catch (e) {
      console.warn('Failed to enrich vocab database:', e.message);
    }
  }

  return result;
}

async function getLessonQuizData(rawLessonId) {
  const lessonId = resolveLessonId(rawLessonId);
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
    // Check if Moon TikTok Vocabulary API has items for this lesson (pageName: vocabulary)
    try {
      const vItems = await fetchMoonApi(`/api/tiktok/TikTokVocabularyTesting/${lessonId}`);
      if (Array.isArray(vItems) && vItems.length > 0) {
        const questions = vItems.map((item, idx) => {
          const k = (item.key || 'A').toUpperCase();
          const correctWord = item[k.toLowerCase()] || '';
          const correctDef = item['definition' + k] || '';
          const correctIpa = item['spelling' + k] || '';
          const audioUrl = item.audioUrl || item['audio' + k + 'Url'] || '';

          const isEngPrompt = item.typeId === 11 || /^[a-zA-Z\s\/\(\)]+$/.test((item.questionText || '').trim());
          const prompt = isEngPrompt
            ? `Nghe & chọn từ vựng đúng: <b class="text-blue-600 dark:text-blue-400 font-bold text-lg">${item.questionText}</b> ${correctIpa ? `<span class="text-xs text-slate-500 font-mono">${correctIpa}</span>` : ''}`
            : `Chọn từ vựng tiếng Anh có nghĩa: <b class="text-blue-600 dark:text-blue-400 font-bold text-lg">"${item.questionText}"</b>`;

          const vocabList = ['A', 'B', 'C', 'D'].map(opt => ({
            word: item[opt.toLowerCase()],
            ipa: item['spelling' + opt] || '',
            meaning: item['definition' + opt] || '',
            pos: 'từ vựng'
          })).filter(v => v.word);

          return {
            order: idx + 1,
            questionId: item.id || `v_${lessonId}_${idx}`,
            type: 'multiple-choice',
            questionText: prompt,
            passage: '',
            passageTitle: '',
            image: '',
            a: item.a ? `${item.a} ${item.definitionA ? `(${item.definitionA})` : ''}` : '',
            b: item.b ? `${item.definitionB ? `${item.b} (${item.definitionB})` : item.b}` : '',
            c: item.c ? `${item.definitionC ? `${item.c} (${item.definitionC})` : item.c}` : '',
            d: item.d ? `${item.definitionD ? `${item.d} (${item.definitionD})` : item.d}` : '',
            key: k,
            audioUrl,
            explanation: `<b>${correctWord}</b> ${correctIpa ? `<i>${correctIpa}</i>` : ''}: ${correctDef}`,
            topic: 'Từ vựng chủ đề (Vocabulary)',
            vocabList
          };
        });

        const fullQuiz = {
          lessonId,
          title: lessonDetail.name,
          totalQuestions: questions.length,
          audioUrl: questions.find(q => q.audioUrl)?.audioUrl || '',
          questions
        };

        if (questions.length > 0) {
          fs.writeFileSync(quizCacheFile, JSON.stringify(fullQuiz, null, 2), 'utf8');
        }
        return fullQuiz;
      }
    } catch (e) {
      console.warn(`Vocab fallback failed for lesson ${lessonId}:`, e.message);
    }

    return { lessonId, title: lessonDetail.name, totalQuestions: 0, questions: [] };
  }

  const lessonTitleLower = (lessonDetail.name || '').toLowerCase();
  const isReadingLesson = lessonDetail.name.includes('[REA]') || lessonTitleLower.includes('reading') || lessonTitleLower.includes('đọc');
  const isListeningLesson = !isReadingLesson && (lessonDetail.name.includes('[LIS]') || lessonTitleLower.includes('listening') || lessonTitleLower.includes('nghe') || lessonTitleLower.includes('part 1'));

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
    let qText = qData.questionText || '';
    const cleanStr = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

    let cleanA = cleanStr(qData.a || '');
    let cleanB = cleanStr(qData.b || '');
    let cleanC = cleanStr(qData.c || '');
    let cleanD = cleanStr(qData.d || '');

    const isPlaceholder = (s) => {
      if (!s) return true;
      const t = s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (!t || /^[A-D]$/i.test(t) || /^\([A-D]\)$/i.test(t)) return true;
      if (/^[\s_.\-–—()]+$/.test(t)) return true;
      if (/^([A-D]\s*[\.\:\)]\s*)?_{3,}/i.test(t)) return true;
      if (/^(The\s+man|The\s+woman|A\s+man|A\s+woman|They|He|She|People|Some\s+people|There\s+is|There\s+are)\s+(is|are)?\s*_{3,}/i.test(t)) return true;
      if (/_{3,}|-{4,}/.test(t) && t.length < 60) return true;
      return false;
    };

    let hasRealChoices = Boolean(cleanA && cleanB && !isPlaceholder(cleanA) && !isPlaceholder(cleanB));
    const rawKey = (qData.key || k.key || '').trim().toUpperCase();
    const hasOptionsInAns = rawAns.includes('(A)') && rawAns.includes('(B)');

    const mImg = qText.match(/src="([^"]+)"/);
    const image = (qData.advImage || '').trim() || (mImg ? mImg[1] : '');

    let type = 'multiple-choice';
    let photoOptions = null;
    let blankPart = '';
    let fullSentence = '';
    let vietnamese = '';

    // Check if options can be extracted from rawAns (e.g. listening transcripts like "(A) The woman is ... (B) ...")
    if ((!hasRealChoices || isPlaceholder(cleanA)) && hasOptionsInAns) {
      const extractOptions = (block) => {
        const a = (block.match(/\(A\)\s*([\s\S]*?)(?=(?:\(B\)|\(C\)|\(D\)|$))/i) || [])[1] || '';
        const b = (block.match(/\(B\)\s*([\s\S]*?)(?=(?:\(C\)|\(D\)|$))/i) || [])[1] || '';
        const c = (block.match(/\(C\)\s*([\s\S]*?)(?=(?:\(D\)|$))/i) || [])[1] || '';
        const d = (block.match(/\(D\)\s*([\s\S]*?)(?=(?:<br\s*\/?>\s*<br\s*\/?>|$))/i) || [])[1] || '';
        return { A: cleanStr(a), B: cleanStr(b), C: cleanStr(c), D: cleanStr(d) };
      };

      let enPart = rawAns;
      let viPart = '';
      if (/tạm\s*dịch/i.test(rawAns)) {
        const parts = rawAns.split(/tạm\s*dịch\s*:?/i);
        enPart = parts[0] || '';
        viPart = parts[1] || '';
      } else if (rawAns.includes('<br><br>') || rawAns.includes('<br/><br/>')) {
        const parts = rawAns.split(/<br\s*\/?>\s*<br\s*\/?>/i);
        enPart = parts[0] || '';
        viPart = parts[1] || '';
      }

      const en = extractOptions(enPart);
      const vi = extractOptions(viPart);
      if (en.A && en.B) {
        photoOptions = {
          A: { text: en.A, vi: vi.A },
          B: { text: en.B, vi: vi.B },
          C: { text: en.C, vi: vi.C },
          D: { text: en.D, vi: vi.D }
        };
        cleanA = en.A;
        cleanB = en.B;
        cleanC = en.C;
        cleanD = en.D;
        hasRealChoices = true;
      }
    }

    // CASE 1: TOEIC Part 1 Photo Listening
    if (isListeningLesson && image && (hasRealChoices || photoOptions || rawKey)) {
      type = 'photo-listen';
    } 
    // CASE 2: Dictation Fill-in-the-Blank
    else if (!hasRealChoices && !photoOptions && (rawAns.includes('<b>') || qText.includes('____') || !rawKey)) {
      type = 'fill-blank';
      const boldMatches = [...rawAns.matchAll(/<b>(.*?)<\/b>/gi)].map(m => cleanStr(m[1])).filter(Boolean);
      blankPart = boldMatches[0] || '';
      fullSentence = boldMatches.join(' / ') || cleanStr(rawAns);

      // Extract Vietnamese meaning from questionText or explanation
      const viFromQ = qText.replace(/<[^>]+>/g, ' ').replace(/_{2,}|-{2,}/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      if (viFromQ.length > 0 && viFromQ.length < 150) {
        vietnamese = viFromQ;
      } else {
        const parts = rawAns.split(/<br\s*\/?>/i);
        vietnamese = cleanStr(parts[1] || '');
      }

      // Format question prompt cleanly
      if (/^[_\s\-\–—.&nbsp;]+$/.test(cleanStr(qText)) || (vietnamese && cleanStr(qText).replace(vietnamese, '').replace(/[_\s\-\–—.&nbsp;]+/g, '').length === 0)) {
        qText = vietnamese ? `🎧 Nghe đoạn băng và điền từ vựng tiếng Anh có nghĩa: "${vietnamese}"` : '🎧 Nghe đoạn băng và điền từ vựng còn thiếu:';
      } else {
        qText = qText.replace(/_{4,}/g, '________').replace(/-{4,}/g, '--------');
      }
    } 
    // CASE 3: Standard Multiple Choice (Reading Part 5, 6, 7 or grammar or listening with printed options)
    else {
      type = 'multiple-choice';
    }

    const parsedVocab = extractVocab(rawAns);
    const topic = (type === 'photo-listen' || (isListeningLesson && lessonDetail.name.includes('Part 1'))) 
      ? 'Listening Part 1' 
      : (isListeningLesson ? 'Listening' : detectTopic(lessonDetail.name, rawAns));
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
      a: cleanA || (photoOptions?.A?.text) || 'A',
      b: cleanB || (photoOptions?.B?.text) || 'B',
      c: cleanC || (photoOptions?.C?.text) || 'C',
      d: cleanD || (photoOptions?.D?.text) || 'D',
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

  if (!fullQuiz.audioUrl && isListeningLesson) {
    const { lessons } = getCourseData();
    const cur = lessons.find(l => l.id == lessonId);
    if (cur) {
      const base = (cur.name || '').replace(/-\s*Answer Key.*/i, '').trim();
      const audioPair = lessons.find(l => l.group_id === cur.group_id && l.id != cur.id && l.name.includes(base) && l.name.includes('Audio'));
      if (audioPair) {
        const audioLessonPath = path.join(LESSONS_CACHE_DIR, `${audioPair.id}.json`);
        if (fs.existsSync(audioLessonPath)) {
          try {
            const aData = JSON.parse(fs.readFileSync(audioLessonPath, 'utf8'));
            if (aData.fileDownloadFullUrl) fullQuiz.audioUrl = aData.fileDownloadFullUrl;
          } catch (e) {}
        }
      }
    }
  }

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
function stripHtml(s) {
  if (!s) return '';
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCleanEnglishSentence(s) {
  if (!s || s.length < 10) return false;
  // If it has Vietnamese accents, reject
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(s)) return false;
  // If it starts with or contains Vietnamese question prompts
  if (/^(chọn|nghe|điền|tìm|câu|nghĩa|đáp án|từ vựng)/i.test(s.trim())) return false;
  if (/có nghĩa|tiếng anh|chọn đáp án|đáp án đúng/i.test(s)) return false;
  // Must contain mostly English letters
  const englishChars = s.replace(/[^a-zA-Z]/g, '').length;
  if (englishChars < 8) return false;
  return true;
}

function cleanTypingWord(raw) {
  if (!raw) return '';
  let cleaned = raw.replace(/\([^)]*\)/g, '').trim();
  if (cleaned.includes('/') && cleaned.length > 20) {
    const parts = cleaned.split('/').map(p => p.trim()).filter(Boolean);
    cleaned = parts[0] || cleaned;
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

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
      if (mode === 'word') {
        const vocabData = await getLessonVocabulary(lessonId);
        if (vocabData.words && vocabData.words.length > 0) {
          const words = [];
          vocabData.words.forEach((w, idx) => {
            const rawWord = (w.word || '').trim();
            const cleanWord = cleanTypingWord(rawWord);
            if (cleanWord) {
              words.push({
                id: w.id || `v_${lessonId}_${idx}`,
                word: cleanWord,
                rawWord: rawWord !== cleanWord ? rawWord : undefined,
                pos: w.pos || 'từ vựng',
                meaning: w.meaning || 'Nghĩa từ vựng',
                ipa: w.ipa || w.phonetic || w.pronunciation_us || '',
                example: w.example || '',
                audioUrl: w.audioUrl || ''
              });
            }
          });
          return res.json({
            mode: 'word',
            lessonId,
            title: vocabData.title || 'Bài học',
            total: words.length,
            items: words
          });
        }
      }

      const quiz = await getLessonQuizData(lessonId);
      const questions = quiz.questions || [];

      if (mode === 'word') {
        const words = [];
        const seen = new Set();

        questions.forEach(q => {
          // 1. From vocabList
          (q.vocabList || []).forEach(v => {
            const wClean = cleanTypingWord((v.word || '').trim());
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
                example: dbInfo.example || stripHtml(q.questionText).replace(/_{2,}/g, wClean).replace(/\s+/g, ' ').trim()
              });
            }
          });

          // 2. From target answer word
          const key = (q.key || '').trim().toLowerCase();
          const targetWord = (q[key] || '').trim();
          const targetClean = cleanTypingWord(targetWord.replace(/[^a-zA-Z-]/g, '').trim());
          const targetKey = targetClean.toLowerCase();
          if (targetClean.length > 2 && !seen.has(targetKey)) {
            seen.add(targetKey);
            const dbInfo = vocabMap.get(targetKey) || {};
            const cleanMeaning = stripHtml(q.explanation || '')
              .replace(/\s+/g, ' ')
              .slice(0, 150)
              .trim();
            words.push({
              id: `w_${q.questionId}`,
              word: targetClean,
              pos: dbInfo.pos || 'từ trọng tâm',
              meaning: dbInfo.meaning || cleanMeaning || 'Đáp án đúng trong đề',
              ipa: dbInfo.pronunciation_us || dbInfo.pronunciation_uk || '',
              example: stripHtml(q.questionText).replace(/_{2,}/g, targetClean).replace(/\s+/g, ' ').trim()
            });
          }
        });

        if (words.length === 0) {
          questions.forEach(q => {
            if (q.blankPart) {
              const cleanWords = q.blankPart.split(/\s+/).filter(w => w.length > 2);
              cleanWords.forEach(w => {
                const wClean = cleanTypingWord(w.replace(/[^a-zA-Z]/g, '').trim());
                if (wClean && !seen.has(wClean.toLowerCase())) {
                  seen.add(wClean.toLowerCase());
                  const dbInfo = vocabMap.get(wClean.toLowerCase()) || {};
                  words.push({
                    id: `w_${q.questionId}_${words.length}`,
                    word: wClean,
                    pos: dbInfo.pos || 'từ trong bài nghe',
                    meaning: dbInfo.meaning || q.vietnamese || 'Từ vựng trong bài nghe',
                    ipa: dbInfo.ipa || dbInfo.phonetic || '',
                    example: stripHtml(q.fullSentence || '')
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
        const seenSentences = new Set();

        // 1. Try questions from current lesson quiz (Part 5 blanks, listening fullSentence, etc.)
        questions.forEach(q => {
          if (q.fullSentence) {
            const cleanFull = stripHtml(q.fullSentence);
            if (isCleanEnglishSentence(cleanFull) && !seenSentences.has(cleanFull.toLowerCase())) {
              seenSentences.add(cleanFull.toLowerCase());
              const cleanTarget = stripHtml(q.blankPart || q.key || '').replace(/[^a-zA-Z-]/g, '').trim();
              sentences.push({
                questionId: q.questionId,
                targetWord: cleanTarget,
                originalQuestion: stripHtml(q.questionText),
                fullSentence: cleanFull,
                explanation: stripHtml(q.vietnamese || q.explanation || ''),
                vietnamese: stripHtml(q.vietnamese || '')
              });
            }
          } else if (q.questionText && /_{2,}/.test(q.questionText)) {
            const key = (q.key || '').trim().toLowerCase();
            const correctWord = stripHtml(q[key] || '').replace(/[^a-zA-Z-]/g, '').trim();
            if (correctWord) {
              const fullSentence = stripHtml(q.questionText).replace(/_{2,}/g, correctWord).replace(/\s+/g, ' ').trim();
              if (isCleanEnglishSentence(fullSentence) && !seenSentences.has(fullSentence.toLowerCase())) {
                seenSentences.add(fullSentence.toLowerCase());
                sentences.push({
                  questionId: q.questionId,
                  targetWord: correctWord,
                  originalQuestion: stripHtml(q.questionText),
                  fullSentence,
                  explanation: stripHtml(q.explanation || q.answer || '')
                });
              }
            }
          }
        });

        // 2. If lesson has few or no sentences (e.g. Vocabulary lessons like 13250827),
        // match vocabulary words against all cached clean TOEIC sentences
        if (sentences.length < 5) {
          const vocabData = await getLessonVocabulary(lessonId);
          const targetVocab = (vocabData.words || []).map(w => w.word.toLowerCase().replace(/[^a-z]/g, ' ')).filter(Boolean);

          const cachedCleanSentences = [];
          if (fs.existsSync(QUESTIONS_CACHE_DIR)) {
            const files = fs.readdirSync(QUESTIONS_CACHE_DIR);
            files.forEach(f => {
              if (f.endsWith('.json')) {
                try {
                  const q = JSON.parse(fs.readFileSync(path.join(QUESTIONS_CACHE_DIR, f), 'utf8'));
                  if (q.questionText && /_{2,}/.test(q.questionText) && q.key) {
                    const correctWord = stripHtml(q[q.key.toLowerCase()] || '').replace(/[^a-zA-Z-]/g, '').trim();
                    if (correctWord) {
                      const full = stripHtml(q.questionText).replace(/_{2,}/g, correctWord).replace(/\s+/g, ' ').trim();
                      if (isCleanEnglishSentence(full)) {
                        cachedCleanSentences.push({
                          questionId: q.questionId,
                          targetWord: correctWord,
                          originalQuestion: stripHtml(q.questionText),
                          fullSentence: full,
                          explanation: stripHtml(q.answer || '')
                        });
                      }
                    }
                  }
                } catch (e) {}
              }
            });
          }

          // First pass: sentences containing words from this lesson's vocabulary
          targetVocab.forEach(vw => {
            const parts = vw.split(/\s+/).filter(p => p.length > 2);
            parts.forEach(part => {
              const regex = new RegExp(`\\b${part}\\b`, 'i');
              cachedCleanSentences.forEach(cs => {
                if (regex.test(cs.fullSentence) && !seenSentences.has(cs.fullSentence.toLowerCase())) {
                  seenSentences.add(cs.fullSentence.toLowerCase());
                  sentences.push(cs);
                }
              });
            });
          });

          // Second pass: if still under 10 sentences, add standard high-quality TOEIC sentences from cache
          if (sentences.length < 10 && cachedCleanSentences.length > 0) {
            cachedCleanSentences.forEach(cs => {
              if (sentences.length < 20 && !seenSentences.has(cs.fullSentence.toLowerCase())) {
                seenSentences.add(cs.fullSentence.toLowerCase());
                sentences.push(cs);
              }
            });
          }
        }

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
          word: cleanTypingWord(v.word),
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
        const seen = new Set();
        if (fs.existsSync(QUESTIONS_CACHE_DIR)) {
          const files = fs.readdirSync(QUESTIONS_CACHE_DIR);
          files.forEach(f => {
            if (f.endsWith('.json')) {
              try {
                const q = JSON.parse(fs.readFileSync(path.join(QUESTIONS_CACHE_DIR, f), 'utf8'));
                if (q.questionText && /_{2,}/.test(q.questionText) && q.key) {
                  const correctWord = stripHtml(q[q.key.toLowerCase()] || '').replace(/[^a-zA-Z-]/g, '').trim();
                  if (correctWord) {
                    const fullSentence = stripHtml(q.questionText).replace(/_{2,}/g, correctWord).replace(/\s+/g, ' ').trim();
                    if (isCleanEnglishSentence(fullSentence) && !seen.has(fullSentence.toLowerCase())) {
                      seen.add(fullSentence.toLowerCase());
                      sentences.push({
                        questionId: q.questionId,
                        targetWord: correctWord,
                        originalQuestion: stripHtml(q.questionText),
                        fullSentence,
                        explanation: stripHtml(q.answer || '')
                      });
                    }
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

// 9. Vocabulary & Flashcards APIs
app.get('/api/vocabulary-lessons', (req, res) => {
  const { lessons } = getCourseData();
  const vocabLessons = lessons.filter(l => {
    if (l.pageName === 'videolesson' || l.pageName === 'pdf') return false;
    if (l.name.includes('- Audio')) return false; // Filter out audio duplicates, keep test/key
    if (l.pageName === 'vocabulary' || l.contentViewTypeLMS === 'vocabulary') return true;
    const nameLower = (l.name || '').toLowerCase();
    if (nameLower.includes('chữa') || nameLower.includes('ch?a')) return false;
    return nameLower.includes('từ vựng') || nameLower.includes('bảng n+n');
  }).map(l => ({
    id: l.id,
    name: l.name,
    group_id: l.group_id,
    group_name: l.group_name || `Unit ${l.group_id}`,
    pageName: l.pageName,
    isPrimaryVocab: l.pageName === 'vocabulary' || l.contentViewTypeLMS === 'vocabulary'
  })).sort((a, b) => {
    if (a.isPrimaryVocab && !b.isPrimaryVocab) return -1;
    if (!a.isPrimaryVocab && b.isPrimaryVocab) return 1;
    return a.group_id - b.group_id;
  });
  res.json(vocabLessons);
});

app.get('/api/vocabulary/:lessonId', async (req, res) => {
  try {
    const data = await getLessonVocabulary(req.params.lessonId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/flashcards', async (req, res) => {
  const lessonId = req.query.lessonId;
  let mastered = [];
  try {
    mastered = JSON.parse(fs.readFileSync(MASTERED_VOCAB_FILE, 'utf8'));
  } catch (e) {}
  const masteredSet = new Set(mastered);

  if (lessonId && lessonId !== 'all') {
    try {
      const vocab = await getLessonVocabulary(lessonId);
      const formatted = (vocab.words || []).map(f => ({
        ...f,
        isMastered: masteredSet.has(f.word.toLowerCase())
      }));
      return res.json({
        lessonId,
        title: vocab.title,
        total: formatted.length,
        masteredCount: formatted.filter(f => f.isMastered).length,
        flashcards: formatted
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  let flashcards = [];
  if (fs.existsSync(VOCAB_DB_FILE)) {
    try {
      flashcards = JSON.parse(fs.readFileSync(VOCAB_DB_FILE, 'utf8'));
    } catch (e) {}
  }

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

// Graceful shutdown endpoint
app.post('/api/shutdown', (req, res) => {
  res.json({ success: true, message: 'Máy chủ đang được tắt...' });
  console.log('🛑 Nhận lệnh tắt máy chủ từ người dùng. Đang dừng Node.js process...');
  setTimeout(() => {
    process.exit(0);
  }, 600);
});

// 12. SPA Fallback routing for distinct lesson/quiz/tab pages (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.includes('.')) {
    return next();
  }
  const indexPath = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
    ? path.join(__dirname, 'public', 'index.html')
    : path.join(__dirname, 'index.html');
  res.sendFile(indexPath);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 TOEIC Moon.vn English Study App Pro is running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
