// Dictation — /{ui}/{content-language}/dictation (e.g. /ru/english/dictation).
//
// Sibling of reading.js and listening.js: same catalogue, and the same TWO PAGES — the catalogue
// carries #dcCatalog, a dictation's own page (/{ui}/{content}/dictation/{slug}) carries
// #dcExercise, and opening one is a plain link. What is different is that the ANSWER never
// reaches the browser until the learner has pressed Check — the text is the exercise, so the
// marking happens on the server (action=dictation_check) and the original comes back with the
// verdict.
(function () {
    'use strict';
    const catalog = document.getElementById('dcCatalog');
    const exercise = document.getElementById('dcExercise');
    if ((!catalog && !exercise) || !Array.isArray(window.DC_TEXTS)) return;

    // ── vowel marks ── as in reading.js: the page PICKS between two strings the server wrote. The
    // marking of an answer is always against the plain text (dictation_voc_result() in helpers.php);
    // the vocalised words ride beside it as `wv`, and the page's own title as DC_VOC_TITLE.
    const H = window.Harakat || null;
    const shown = (plain, voc) => (H ? H.pick(plain, voc) : plain);
    const wantOf = op => shown(op.want, op.wv);
    const titleOf = meta => shown(meta.title, meta.slug === window.DC_TEXT ? window.DC_VOC_TITLE : null);
    let lastReview = null;       // the last check's result, repainted when the marks are switched

    // Every dictation's address is the catalogue's plus /{slug} — url_text() on the server.
    const BASE = window.DC_BASE || (exercise ? location.pathname.replace(/\/[^/]*\/?$/, '')
                                             : location.pathname.replace(/\/$/, ''));
    const textUrl = slug => BASE + '/' + encodeURIComponent(slug);

    const T = window.T || {};
    const t = (k, dflt) => T[k] || dflt;
    // The INTERFACE language, needed for the plural rules below. It had no reader before this and
    // the comment beside window.DC_CONTENT_LANG in the view said so; it has one now.
    const UI_LANG = window.DC_LANG || 'en';
    // A sentence with a count in it — assets/plural.js, the twin of tn() in app/helpers.php.
    const tn = (key, n, dflt) => window.pluralForm(T, UI_LANG, key, n, dflt);
    const TEXTS = window.DC_TEXTS;
    const PROGRESS_KEY = 'dc_progress';
    const PREF_KEY = 'dc_prefs';
    const el = (id) => document.getElementById(id);

    let current = null;      // { slug, level, title, words, secs: [] }
    let sentence = 0;        // which sentence the player is on
    let speed = 1;
    let strict = 'loose';
    let checked = false;

    // ── preferences ──
    function prefs() {
        try {
            const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {};
            return { speed: [0.6, 0.8, 1].indexOf(+p.speed) >= 0 ? +p.speed : 1,
                     strict: ['loose', 'case', 'full'].indexOf(p.strict) >= 0 ? p.strict : 'loose' };
        } catch { return { speed: 1, strict: 'loose' }; }
    }
    function setPref(k, v) {
        try { const p = prefs(); p[k] = v; localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch {}
    }
    speed = prefs().speed; strict = prefs().strict;

    // ── progress ──
    function loadProgress() {
        try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {}; } catch { return {}; }
    }
    function saveProgress(slug, correct, total) {
        try {
            const p = loadProgress();
            p[slug] = { correct, total, at: Date.now() };
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
        } catch {}
        paintProgress();
    }
    // Exposed because catalogue.js builds a whole new set of sections when the visitor switches to
    // the topic view, and their progress lines start empty. Called there after every switch.
    window.rdPaintProgress = paintProgress;
    function paintProgress() {
        const p = loadProgress();
        document.querySelectorAll('.rd-card').forEach(card => {
            const r = p[card.dataset.slug];
            const cta = card.querySelector('.rd-card-cta');
            if (!cta) return;
            cta.classList.toggle('is-done', !!r);
            cta.classList.toggle('is-perfect', !!r && r.correct === r.total);
            if (r) cta.textContent = (r.correct === r.total ? '✓ ' : '') + r.correct + '/' + r.total;
            else { cta.textContent = ''; cta.append(t('listening_open', 'Listen') + ' ', arrow('→')); }
        });
        document.querySelectorAll('.rd-section').forEach(sec => {
            const cards = sec.querySelectorAll('.rd-card');
            const done = [...cards].filter(c => p[c.dataset.slug]).length;
            const out = sec.querySelector('.rd-section-done');
            if (out) out.textContent = done
                ? t('reading_completed', '%1$s of %2$s completed').replace('%1$s', done).replace('%2$s', cards.length)
                : '';
        });
    }
    function arrow(ch) {
        const s = document.createElement('span');
        s.className = 'rd-arrow';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = ch;
        return s;
    }
    const fmt = (s) => {
        if (!isFinite(s) || s < 0) s = 0;
        return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    };

    // ── audio: one element, one sentence at a time ──
    const audio = new Audio();
    audio.preload = 'auto';
    const CONTENT_LANG = window.DC_CONTENT_LANG || 'en';
    const clipUrl = (slug, i) => '/index.php?action=dictation_audio&lang=' + encodeURIComponent(CONTENT_LANG) +
        '&slug=' + encodeURIComponent(slug) + '&i=' + i;

    audio.addEventListener('play', paintTransport);
    audio.addEventListener('pause', paintTransport);
    audio.addEventListener('timeupdate', paintTransport);
    audio.addEventListener('ended', paintTransport);
    audio.addEventListener('loadedmetadata', paintTransport);
    audio.addEventListener('error', () => {
        note(t('dictation_not_ready', 'The audio is not ready yet.'));
        paintTransport();
    });
    function note(msg) { const n = el('dcNote'); if (n) n.textContent = msg || ''; }

    function paintTransport() {
        const play = el('dcPlay'), time = el('dcTime'), pos = el('dcSentence');
        if (play) play.textContent = audio.paused ? '▶' : '❚❚';
        const total = current ? current.secs.length : 0;
        if (pos && total) {
            pos.textContent = t('dictation_sentence_of', 'Sentence %1$s of %2$s')
                .replace('%1$s', sentence + 1).replace('%2$s', total);
        }
        if (time) {
            const d = isFinite(audio.duration) && audio.duration > 0
                ? audio.duration : (current ? (current.secs[sentence] || 0) : 0);
            time.textContent = fmt(audio.currentTime) + ' / ' + fmt(d);
        }
        const prev = el('dcPrev'), next = el('dcNext');
        if (prev) prev.disabled = sentence <= 0;
        if (next) next.disabled = !current || sentence >= current.secs.length - 1;
    }

    // `play` is false when only the position changes (arriving on a text, stepping back to
    // re-read the counter) — the audio should not start on its own the moment a page opens.
    function goSentence(i, play) {
        if (!current) return;
        const n = current.secs.length;
        sentence = Math.max(0, Math.min(n - 1, i));
        audio.src = clipUrl(current.slug, sentence);
        audio.playbackRate = speed;
        note('');
        if (play) audio.play().catch(() => {});
        paintTransport();
    }

    function stopAudio() { try { audio.pause(); } catch {} }

    // ── catalogue filter ──
    // The chip filter lives in catalogue.js now. Filtering on data-level alone hid every section
    // the moment a chip was pressed in the topic view, where sections carry data-topic and match
    // nothing — so it belongs beside the code that builds them. See page_reading.php.

    // ── the exercise ──
    function open(meta, focus) {
        stopAudio();
        current = meta;
        checked = false;
        lastReview = null;
        sentence = 0;
        el('dcTitle').textContent = titleOf(meta);
        el('dcLevel').textContent = String(meta.level || '').toUpperCase();
        const lvl = t('reading_level_' + String(meta.level || '').toLowerCase(), '');
        const secs = Math.round(meta.secs.reduce((a, b) => a + b, 0));
        el('dcMeta').textContent = fmt(secs) + (lvl ? ' · ' + lvl : '');
        const input = el('dcInput');
        input.value = '';
        input.disabled = false;
        el('dcBanner').hidden = true;
        el('dcReview').hidden = true;
        el('dcReview').textContent = '';
        el('dcActions').hidden = false;
        goSentence(0, false);
        updateCount();
        if (focus) input.focus();
        // Полоска связей — общая, из assets/catalogue.js. Зовём её здесь, при открытии: связь —
        // свойство текста. И В КОНЦЕ, а не в начале: упражнение не должно зависеть от украшения
        // под ним, а стояло это первой строкой.
        if (window.showRelated) window.showRelated('dictation', meta.slug);
    }

    // ── the word counter ──
    // Counts WORDS, not characters, because that is the unit the exercise is marked in. It says
    // how many are still owed rather than how many have been written: "12 more to write" is the
    // question a learner is actually asking, and it tells them the length without giving the
    // text away.
    // Scripts that write no space between words. A TWIN of DICTATION_NOSPACE_RE in
    // app/helpers.php, and helpers.php is the authority: the server decides what a word is for
    // the diff and for the target count, this only has to agree with it while the learner types,
    // which cannot wait for a round trip. Keep the two ranges identical.
    //
    // Hangul is absent here for the same reason it is absent there: Korean spaces its words. Note
    // that NO_SPACE_SCRIPTS_RE in app.js DOES include Hangul — that one drives the karaoke timer,
    // where a per-character step is right. Different question, different list.
    const DC_NOSPACE = /[぀-ゟ゠-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿฀-๿຀-໿ក-៿က-႟ༀ-࿿]/u;

    /**
     * Count as the checker counts. Mirrors dictation_tokens() in app/helpers.php step for step:
     * whitespace-separated, except that a word containing a space-less script is split one token
     * per grapheme cluster, punctuation joins the token before it, and a run of Latin letters
     * stays whole ("Wi-Fiを使う" is Wi-Fi + を + 使 + う, four tokens).
     */
    function countTokens(text) {
        const v = (text || '').trim();
        if (!v) return 0;
        let n = 0;
        for (const word of v.split(/\s+/).filter(Boolean)) {
            if (!DC_NOSPACE.test(word)) { n++; continue; }
            // Grapheme clusters, not code points: Thai hangs its vowels and tone marks off the
            // consonant, and counting those apart would inflate a Thai text by about half.
            const parts = (typeof Intl !== 'undefined' && Intl.Segmenter)
                ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)].map(s => s.segment)
                : [...word];
            const toks = [];
            for (const g of parts) {
                if (!/^[\p{L}\p{N}]/u.test(g)) { if (!toks.length) toks.push(g); continue; }
                if (DC_NOSPACE.test(g)) { toks.push(g); continue; }
                const last = toks.length ? toks[toks.length - 1] : null;
                if (last !== null && !DC_NOSPACE.test(last)) toks[toks.length - 1] += g;
                else toks.push(g);
            }
            n += toks.length;
        }
        return n;
    }

    function typedWords() {
        return countTokens(el('dcInput').value);
    }
    function updateCount() {
        const out = el('dcCount');
        if (!out || !current) return;
        const have = typedWords(), want = current.words;
        out.classList.remove('is-full', 'is-over');
        if (have < want) {
            out.textContent = tn('dictation_remaining', want - have, '%s more words to write').replace('%s', want - have);
        } else if (have === want) {
            out.textContent = t('dictation_complete', 'All words written');
            out.classList.add('is-full');
        } else {
            out.textContent = tn('dictation_over', have - want, '%s words more than the text').replace('%s', have - want);
            out.classList.add('is-over');
        }
    }

    // ── checking ──
    async function check() {
        if (!current || checked) return;
        const input = el('dcInput');
        if (!(input.value || '').trim()) {
            note(t('dictation_empty_warn', 'Write something first.'));
            input.focus();
            return;
        }
        const btn = el('dcCheck');
        btn.disabled = true;
        try {
            const res = await fetch('/index.php?action=dictation_check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: current.slug, lang: CONTENT_LANG, mode: strict, text: input.value }),
            });
            // A REFUSAL IS NOT A BROKEN CONNECTION, and saying so sent people to fix the wrong
            // thing. The check is limited to 120 an hour PER NETWORK, which one learner never
            // reaches and a classroom behind one address does — and every one of them was being
            // told their connection was at fault while it was working. The string is the contact
            // form's, reused rather than duplicated: it already says «too many submissions from
            // your network, try again in an hour», which is exactly what happened, and it is
            // already translated and reviewed in all 43 languages.
            if (res.status === 429) {
                note(t('contact_err_rate', 'Too many submissions from your network. Please try again in an hour.'));
                return;
            }
            if (!res.ok) throw new Error('http');
            const d = await res.json();
            if (!d || typeof d.total !== 'number') throw new Error('empty');
            checked = true;
            input.disabled = true;
            el('dcActions').hidden = true;
            stopAudio();
            saveProgress(current.slug, d.correct, d.total);
            showResult(d);
        } catch {
            note(t('js_reading_load_failed', 'Could not check. Check your connection and try again.'));
        } finally {
            btn.disabled = false;
        }
    }

    function showResult(d) {
        const banner = el('dcBanner');
        banner.textContent = '';
        banner.hidden = false;
        const perfect = d.correct === d.total && !d.wrong && !d.missing && !d.extra;
        banner.classList.toggle('is-perfect', perfect);

        const score = document.createElement('span');
        score.className = 'rd-banner-score';
        score.setAttribute('dir', 'ltr');
        score.textContent = d.correct + ' / ' + d.total;

        const msg = document.createElement('span');
        msg.className = 'rd-banner-msg';
        // The noun agrees with the TOTAL, not with how many were right: "1 of 41 words correct".
        const bits = [tn('dictation_result', d.total, '%1$s of %2$s words correct')
            .replace('%1$s', d.correct).replace('%2$s', d.total)];
        // Counted apart from the errors, and deliberately not styled as one: a spelling variety is
        // a word the learner got right in a spelling the recording does not use.
        if (d.variants) bits.push(tn('dictation_variant', d.variants, '%s spelling variant').replace('%s', d.variants));
        if (d.wrong)   bits.push(tn('dictation_wrong', d.wrong, '%s wrong').replace('%s', d.wrong));
        if (d.missing) bits.push(tn('dictation_missing', d.missing, '%s missed').replace('%s', d.missing));
        if (d.extra)   bits.push(tn('dictation_extra', d.extra, '%s extra').replace('%s', d.extra));
        msg.textContent = bits.join(' · ');

        const btns = document.createElement('span');
        btns.className = 'rd-banner-btns';
        const again = document.createElement('button');
        again.type = 'button';
        again.className = 'btn btn-ghost';
        again.textContent = t('reading_again', 'Try again');
        again.addEventListener('click', () => open(current, true));
        // A LINK to the next dictation's page, not a button — see the same place in reading.js.
        const next = document.createElement('a');
        next.className = 'btn btn-primary';
        const after = pickNext();
        if (after) {
            next.href = textUrl(after.slug);
            next.append(t('reading_next', 'Next') + ' ', arrow('→'));
        } else {
            next.href = BASE;
            next.textContent = t('reading_back_all', 'Back to all texts');
        }
        btns.append(again, next);
        banner.append(score, msg, btns);

        paintReview(d);
        banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // The marked-up text. Every word carries its verdict, so the learner sees WHERE they went
    // wrong and what the word should have been — a score alone teaches nothing.
    // Right-to-left content languages. The block used to be hardcoded dir="ltr" lang="en", which
    // was true while English was the only corpus and has been wrong since Arabic joined: an Arabic
    // dictation was laid out left to right in the one place the learner compares it letter by
    // letter against what they typed.
    const DC_RTL = /^(ar|he|ur|fa)$/;

    /** One word of the marked-up answer. */
    function markWord(op) {
        const w = document.createElement('span');
        w.className = 'dc-w dc-' + op.t;
        if (op.t === 'ok' || op.t === 'extra') w.textContent = op.got;
        else if (op.t === 'miss') w.textContent = wantOf(op);
        else if (op.t === 'variant') {
            // What they wrote STAYS, unstruck, because it is right. The stored spelling rides
            // beside it so the difference is taught instead of being either punished or hidden.
            // The explanation is a title AND an aria-label: a tooltip alone is invisible on a
            // touch screen and to a screen reader, which is most of the people this is for.
            w.textContent = op.got;
            const alt = document.createElement('span');
            alt.className = 'dc-alt';
            alt.textContent = wantOf(op);
            w.appendChild(alt);
            const note = t('dictation_variant_note', 'Also correct — the recording uses the British spelling');
            w.title = note;
            w.setAttribute('aria-label', op.got + ' — ' + note);
        } else {                                    // wrong: what was written, then the truth
            w.textContent = op.got;
            const fix = document.createElement('span');
            fix.className = 'dc-fix';
            fix.textContent = wantOf(op);
            w.appendChild(fix);
        }
        return w;
    }

    /**
     * Split the flat list of word operations into one group per sentence of the ORIGINAL.
     *
     * WHAT MAKES THE LINE COUNT COME OUT RIGHT is that the per-sentence word counts SUM to the
     * word count of the whole body — only then does consuming every `want` land exactly on the
     * last sentence, with nothing left over to open a line numbered one past the end. Verified,
     * not assumed: over all 650 published dictations in 30 languages the two agree in every text.
     * The same sweep confirms the two tokenisers agree — countTokens here against
     * dictation_tokens() in PHP, 7 449 strings, 0 mismatches — which is the twin this file's
     * counter and the server's diff both depend on.
     *
     * Anchored on the original, never on what the learner typed: every op that carries a `want`
     * consumes one original word, so counting those against the per-sentence word counts keeps the
     * ten lines in place however much was written. An `extra` op — a word typed that is not in the
     * original — has no `want`, does not advance the count, and stays on the line it appeared in.
     */
    function groupBySentence(ops, sentences) {
        const per = sentences.map(countTokens);
        const out = [];
        let line = [], used = 0, si = 0, full = false;
        for (const op of ops) {
            const has = op.want !== null && op.want !== undefined;
            // THE LINE CLOSES ON THE NEXT WORD OF THE ORIGINAL, not the moment its own count is
            // reached, and that one beat is the whole of a defect reported from Japan (Sep 2026).
            // Closing eagerly puts the boundary between a sentence's last word and any EXTRA word
            // typed after it — so a learner who wrote «candle light» where the text has
            // «candlelight» saw their own two words drawn at the start of the NEXT line, under a
            // sentence they had not written them in. Waiting for the next word that consumes the
            // original is what makes the comment above true: an extra really does stay where it
            // appeared.
            if (full && has) { out.push(line); line = []; used = 0; si++; full = false; }
            line.push(op);
            if (!has) continue;
            used++;
            if (si < per.length && used >= per[si]) full = true;
        }
        // A TAIL JOINS THE LAST LINE, it does not become one of its own. Words typed after the
        // final sentence carry no `want`, so they never cross a boundary and would otherwise be
        // pushed as an eleventh group under a text that has ten sentences — a line numbered 11
        // with nothing to be 11 of, and no counterpart to pair with in the original.
        // ... but a leftover that CONTAINS words of the original is a sentence of its own, and
        // conflating the two is how the lazy close breaks the end of the text: written as a plain
        // merge it gave ten lines for eleven sentences, the last two run together. `used > 0` is
        // the test — only a tail of pure extras has nothing of the original in it.
        if (line.length) {
            if (used > 0 || !out.length) out.push(line);
            else out[out.length - 1].push(...line);
        }
        return out;
    }

    /**
     * Hovering a sentence lights the same sentence in the other block.
     *
     * ONE delegated listener on the box, not one per line: the review is rebuilt on every check,
     * and listeners attached to the lines would have to be torn down with them — the kind of leak
     * that only shows up after a learner has retried a text twenty times.
     *
     * `mouseover`/`mouseout` rather than `mouseenter`/`mouseleave` because only the first pair
     * bubbles, which is what delegation needs. relatedTarget is checked so that crossing between
     * two spans INSIDE the same line does not flicker the highlight off and on.
     *
     * No `tabindex`: making twenty paragraphs focusable would add twenty stops to the tab order
     * and cost a keyboard user far more than the highlight gives them. On a touch screen a tap
     * fires mouseover, so the pairing works there and simply stays until the next tap — which is
     * the useful behaviour on a phone anyway.
     */
    function linkSentences(box) {
        // ONCE per element. paintReview() runs on every check and box is always the same node, so
        // an unguarded call would stack a fresh pair of listeners on each retry — the very leak
        // the comment above claims delegation avoids. Clearing the children does not remove
        // listeners bound to the parent.
        if (box.dataset.linked) return;
        box.dataset.linked = '1';
        const paint = (idx) => {
            box.querySelectorAll('.is-linked').forEach(n => n.classList.remove('is-linked'));
            if (idx === null) return;
            box.querySelectorAll('[data-s="' + idx + '"]').forEach(n => n.classList.add('is-linked'));
        };
        box.addEventListener('mouseover', e => {
            const line = e.target.closest && e.target.closest('[data-s]');
            if (line) paint(line.dataset.s);
        });
        box.addEventListener('mouseout', e => {
            const line = e.target.closest && e.target.closest('[data-s]');
            if (!line) return;
            // Still inside the same line — a move between its own spans, not a real exit.
            const to = e.relatedTarget;
            if (to && to.closest && to.closest('[data-s]') === line) return;
            paint(null);
        });
    }

    function paintReview(d) {
        lastReview = d;
        const box = el('dcReview');
        box.textContent = '';
        box.hidden = false;
        const lang = CONTENT_LANG;
        const dir = DC_RTL.test(lang) ? 'rtl' : 'ltr';
        // No sentences from the server (an older cached response) — fall back to one block, which
        // is what this looked like before. Degrades, never breaks.
        const sentences = Array.isArray(d.sentences) && d.sentences.length ? d.sentences : null;

        const h = document.createElement('h4');
        h.textContent = t('dictation_your_text', 'What you wrote');
        box.appendChild(h);

        const groups = sentences ? groupBySentence(d.ops || [], sentences) : [d.ops || []];
        groups.forEach((ops, i) => {
            const line = document.createElement('p');
            // The fallback keeps the OLD class, and the old class still exists for it: .dc-line
            // carries a hanging indent that only makes sense with a number hanging in it, so an
            // unnumbered fallback line would sit indented under nothing.
            line.className = sentences ? 'dc-line' : 'dc-diff';
            line.setAttribute('dir', dir);
            line.setAttribute('lang', lang);
            if (sentences) {
                line.dataset.s = String(i);
                const num = document.createElement('span');
                num.className = 'dc-num';
                num.setAttribute('aria-hidden', 'true');   // decoration; the sentence reads without it
                num.textContent = (i + 1) + '.';
                line.appendChild(num);
            }
            // The separating space is Latin punctuation. Japanese, Chinese and Thai write none,
            // and since the fix above makes every CJK character its own token, adding one between
            // them printed the text as 私 は 毎 日 早 く — spaced out like a ransom note and
            // harder to read than the wall of text this change set out to fix. A space goes in
            // only where the original had one: between two tokens that are both from a spaced
            // script.
            let prev = null;
            ops.forEach(op => {
                const text = op.got !== null && op.got !== undefined ? op.got : (wantOf(op) || '');
                if (prev !== null && !DC_NOSPACE.test(prev) && !DC_NOSPACE.test(text)) {
                    line.appendChild(document.createTextNode(' '));
                }
                line.appendChild(markWord(op));
                prev = text;
            });
            box.appendChild(line);
        });

        const h2 = document.createElement('h4');
        h2.textContent = t('dictation_original', 'The original');
        box.appendChild(h2);
        const vs = d.voc && Array.isArray(d.voc.sentences) ? d.voc.sentences : [];
        (sentences ? sentences.map((s, i) => shown(s, vs[i]))
                   : [shown(d.original || '', d.voc && d.voc.original)]).forEach((s, i) => {
            const line = document.createElement('p');
            line.className = sentences ? 'dc-oline' : 'dc-original';
            line.setAttribute('dir', dir);
            line.setAttribute('lang', lang);
            if (sentences) {
                line.dataset.s = String(i);
                const num = document.createElement('span');
                num.className = 'dc-num';
                num.setAttribute('aria-hidden', 'true');
                num.textContent = (i + 1) + '.';
                line.appendChild(num);
            }
            line.appendChild(document.createTextNode(s));
            box.appendChild(line);
        });

        if (sentences) linkSentences(box);
    }

    function pickNext() {
        const i = TEXTS.findIndex(x => x.slug === current.slug);
        return i >= 0 && i + 1 < TEXTS.length ? TEXTS[i + 1] : null;
    }

    el('dcPlay')?.addEventListener('click', () => {
        if (audio.paused) audio.play().catch(() => {}); else audio.pause();
    });
    el('dcRepeat')?.addEventListener('click', () => { audio.currentTime = 0; audio.play().catch(() => {}); });
    el('dcPrev')?.addEventListener('click', () => goSentence(sentence - 1, true));
    el('dcNext')?.addEventListener('click', () => goSentence(sentence + 1, true));
    el('dcSpeeds')?.addEventListener('click', e => {
        const b = e.target.closest('[data-speed]');
        if (!b) return;
        speed = parseFloat(b.dataset.speed) || 1;
        setPref('speed', speed);
        audio.playbackRate = speed;
        e.currentTarget.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('is-on', x === b));
    });
    el('dcStrict')?.addEventListener('change', e => { strict = e.target.value; setPref('strict', strict); });
    el('dcInput')?.addEventListener('input', updateCount);
    el('dcCheck')?.addEventListener('click', check);
    el('dcReset')?.addEventListener('click', () => { if (current) open(current, true); });

    // Ctrl/Cmd+Enter checks, Tab is left alone — the learner is typing prose and needs it.
    el('dcInput')?.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); check(); }
    });

    window.addEventListener('pagehide', stopAudio);

    const back = el('dcBack');
    if (back) { back.textContent = ''; back.append(arrow('←'), ' ' + t('reading_back', 'All texts')); }
    const sel = el('dcStrict');
    if (sel) {
        // The offered modes depend on the CONTENT language — a script with no capitals gets two
        // options, Thai gets no selector at all (see dictation_marking_modes). A preference saved
        // on an English text can therefore name a mode this page does not have, and assigning it
        // leaves the select showing its first option while `strict` still says something else:
        // the control would then contradict what the marking actually does. Clamp to what exists.
        const has = [...sel.options].some(o => o.value === strict);
        // NOT persisted, same as the no-selector branch below and for the same reason: visiting a
        // Japanese page is not a decision about how English should be marked. The first version
        // wrote the clamped value back, so a learner who chose "Case matters" on English and then
        // opened one Japanese dictation came back to English with their choice silently gone.
        // Only an explicit change (the listener above) writes the preference.
        if (!has) strict = sel.options[0] ? sel.options[0].value : 'loose';
        sel.value = strict;
    } else if (strict !== 'loose') {
        // No selector on this page: every mode would mark the same, so say so in the one place
        // that decides. Not persisted — the learner's choice on other languages stays theirs.
        strict = 'loose';
    }
    document.querySelectorAll('#dcSpeeds [data-speed]').forEach(x =>
        x.classList.toggle('is-on', parseFloat(x.dataset.speed) === speed));

    // An address from the fragment era (#a1/slug, #lesson-a1-14-write) reaching the catalogue —
    // see the same function in reading.js for why it is replace() and why an unknown slug is left
    // alone.
    function redirectLegacyFragment() {
        let frag = '';
        try { frag = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
        const slug = frag.split('/').pop();
        if (slug && TEXTS.some(x => x.slug === slug)) location.replace(textUrl(slug));
    }

    const meta = window.DC_TEXT ? TEXTS.find(x => x.slug === window.DC_TEXT) : null;
    if (exercise && meta) {
        // This page's dictation. No focus move: the initial paint is not something the learner did,
        // and the input taking focus on load would throw a screen reader past the heading.
        open(meta, false);
        // Vowel marks on/off: the title, and the review if there is one — nothing the learner typed.
        if (H && (window.DC_VOC_TITLE || window.DC_HAS_VOC)) H.segment(el('dcHarakat'), () => {
            el('dcTitle').textContent = titleOf(current || meta);
            if (lastReview) paintReview(lastReview);
        });
    } else if (catalog) {
        paintProgress();
        if (location.hash.length > 1) redirectLegacyFragment();
    }
})();
