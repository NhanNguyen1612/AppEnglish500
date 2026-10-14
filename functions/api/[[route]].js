import data from './_data.json';

const SPEECHER_VOICES = {
  hannah: '3bf4442b798f',
  madison: '390ab1dc80e9',
  isla: 'c54647aa1e7f',
  natalie: '56ce9e1bef17',
  megan: 'ecf763d41acf'
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  // 1. TTS Audio Proxy (Speecher.org Warm Female Voice / Google TTS)
  if (path === '/api/tts') {
    const text = url.searchParams.get('text') || '';
    const voice = url.searchParams.get('voice') || 'speecher:hannah';
    if (!text.trim()) return new Response('Text required', { status: 400 });

    const vname = voice.replace('speecher:', '').toLowerCase();
    const voiceId = SPEECHER_VOICES[vname] || SPEECHER_VOICES.hannah;
    const targetUrl = `https://speecher.org/index.php?action=std_tts&voice=${voiceId}&text=${encodeURIComponent(text.trim())}`;

    try {
      const resp = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://speecher.org/'
        }
      });
      if (resp.ok) {
        return new Response(resp.body, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=604800, immutable',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } catch (e) {}

    // Fallback: Google TTS
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=en&client=tw-ob`;
    return fetch(googleUrl);
  }

  // 2. Course Overview
  if (path === '/api/course') {
    const groups = data.course.groupList || [];
    const lessons = data.lessons || [];
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

    return jsonResponse({
      course: {
        id: data.course.id,
        name: data.course.name,
        teacher: data.course.teacherName || 'Cô Thảo Min',
        avatar: data.course.avatarCourseFull
      },
      totalLessons: lessons.length,
      groups: groupStats
    });
  }

  // 3. Lessons list for a group
  if (path === '/api/lessons') {
    const groupId = parseInt(url.searchParams.get('group_id'));
    const lessons = data.lessons || [];
    const filtered = groupId ? lessons.filter(l => l.group_id === groupId) : lessons;
    return jsonResponse(filtered);
  }

  // 4. Quiz Questions for a lesson
  if (path.startsWith('/api/quiz/')) {
    const lessonId = path.replace('/api/quiz/', '').trim();
    if (data.quizzes && data.quizzes[lessonId]) {
      return jsonResponse(data.quizzes[lessonId]);
    }

    // Try reconstruct from cached questions
    const lDetail = data.lessons_cache ? data.lessons_cache[lessonId] : null;
    if (lDetail && lDetail.keyAllEnglish) {
      const questions = lDetail.keyAllEnglish.map((k, idx) => {
        const qid = str(k.questionId);
        const q = (data.questions && data.questions[qid]) ? data.questions[qid] : {};
        return {
          order: k.order || (idx + 1),
          questionId: k.questionId,
          questionText: q.questionText || '',
          passage: (q.conetentEnglish || q.contentEnglish || '').trim(),
          passageTitle: (q.titleEnglish || '').trim(),
          image: (q.advImage || '').trim(),
          a: q.a || '',
          b: q.b || '',
          c: q.c || '',
          d: q.d || '',
          key: (q.key || k.key || '').trim().toUpperCase(),
          explanation: q.answer || '',
          topic: 'TOEIC Practice',
          vocabList: []
        };
      });
      return jsonResponse({
        lessonId,
        title: lDetail.name || 'Bài học',
        totalQuestions: questions.length,
        questions
      });
    }

    return jsonResponse({ error: 'Quiz not found' }, 404);
  }

  // 5. Dictation & Word Typing items
  if (path === '/api/dictation/items') {
    const lessonId = url.searchParams.get('lessonId') || 'all';
    const mode = url.searchParams.get('mode') || 'word';

    const vocabList = data.vocab || [];

    if (lessonId && lessonId !== 'all') {
      const quiz = (data.quizzes && data.quizzes[lessonId]) ? data.quizzes[lessonId] : null;
      const questions = quiz ? (quiz.questions || []) : [];

      if (mode === 'word') {
        const words = [];
        const seen = new Set();
        questions.forEach(q => {
          (q.vocabList || []).forEach(v => {
            const w = (v.word || '').trim();
            if (w && !seen.has(w.toLowerCase())) {
              seen.add(w.toLowerCase());
              words.push({
                id: `v_${q.questionId}_${words.length}`,
                word: w,
                pos: v.pos || 'từ vựng',
                meaning: v.meaning || '',
                example: q.questionText.replace(/_{2,}/g, w).replace(/\s+/g, ' ').trim()
              });
            }
          });
          const key = (q.key || '').trim().toLowerCase();
          const target = (q[key] || '').replace(/[^a-zA-Z-]/g, '').trim();
          if (target.length > 2 && !seen.has(target.toLowerCase())) {
            seen.add(target.toLowerCase());
            words.push({
              id: `w_${q.questionId}`,
              word: target,
              pos: 'từ trọng tâm',
              meaning: (q.explanation || '').replace(/<[^>]*>?/gm, ' ').slice(0, 150).trim(),
              example: q.questionText.replace(/_{2,}/g, target).replace(/\s+/g, ' ').trim()
            });
          }
        });

        if (words.length < 3) {
          vocabList.slice(0, 10).forEach(v => {
            if (!seen.has(v.word.toLowerCase())) {
              seen.add(v.word.toLowerCase());
              words.push(v);
            }
          });
        }

        return jsonResponse({
          mode: 'word',
          lessonId,
          title: quiz ? quiz.title : 'Bài học',
          total: words.length,
          items: words
        });
      } else {
        // mode === 'sentence'
        const sentences = [];
        questions.forEach(q => {
          const key = (q.key || '').trim().toLowerCase();
          const target = (q[key] || '').trim();
          if (q.questionText && target) {
            sentences.push({
              questionId: q.questionId,
              targetWord: target,
              originalQuestion: q.questionText,
              fullSentence: q.questionText.replace(/_{2,}/g, target).replace(/\s+/g, ' ').trim(),
              explanation: q.explanation || ''
            });
          }
        });
        return jsonResponse({
          mode: 'sentence',
          lessonId,
          title: quiz ? quiz.title : 'Bài học',
          total: sentences.length,
          items: sentences
        });
      }
    } else {
      // All
      if (mode === 'word') {
        return jsonResponse({
          mode: 'word',
          lessonId: 'all',
          title: 'Toàn bộ từ vựng khóa học',
          total: vocabList.length,
          items: vocabList
        });
      } else {
        const sentences = [];
        const qMap = data.questions || {};
        Object.values(qMap).forEach(q => {
          const key = (q.key || '').trim().toLowerCase();
          const target = (q[key] || '').trim();
          if (q.questionText && target) {
            sentences.push({
              questionId: q.questionId,
              targetWord: target,
              originalQuestion: q.questionText,
              fullSentence: q.questionText.replace(/_{2,}/g, target).replace(/\s+/g, ' ').trim(),
              explanation: q.answer || ''
            });
          }
        });
        return jsonResponse({
          mode: 'sentence',
          lessonId: 'all',
          title: 'Toàn bộ câu hỏi nghe chép',
          total: sentences.length,
          items: sentences
        });
      }
    }
  }

  // 6. Flashcards
  if (path === '/api/flashcards') {
    return jsonResponse({
      total: (data.vocab || []).length,
      masteredCount: 0,
      flashcards: data.vocab || []
    });
  }

  // 7. Mock test (20 random questions)
  if (path === '/api/mock-test') {
    const all = Object.values(data.questions || {}).filter(q => q.questionText && q.key);
    const shuffled = all.sort(() => 0.5 - Math.random()).slice(0, 20);
    return jsonResponse({
      title: 'Đề Thi Thử TOEIC Mini (20 Câu ngẫu nhiên)',
      durationMinutes: 20,
      totalQuestions: shuffled.length,
      questions: shuffled.map((q, idx) => ({
        order: idx + 1,
        questionId: q.questionId,
        questionText: q.questionText,
        a: q.a,
        b: q.b,
        c: q.c,
        d: q.d,
        key: q.key,
        explanation: q.answer || ''
      }))
    });
  }

  // 8. Analytics
  if (path === '/api/analytics') {
    return jsonResponse({
      totalAnswered: 0,
      totalCorrect: 0,
      accuracy: 0,
      estimatedScore: 450,
      topics: {},
      recentHistory: []
    });
  }

  return jsonResponse({ error: 'Endpoint not found' }, 404);
}
