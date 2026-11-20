'use strict';

const byId = (id) => document.getElementById(id);
const main = byId('main');
const welcome = byId('welcome');
const course = byId('course');
const chapters = byId('chapters');
const narrow = matchMedia('(max-width: 750px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const greetings = [
  'Привет, любимая мамочка',
  'Этот сайт я сделал специально для тебя, чтобы ты могла хорошо освоить новые технологии',
  'Люблю тебя'
];
const stateKey = 'chatgpt-dlya-mamy-v1';
let state;
try {
  state = JSON.parse(localStorage.getItem(stateKey)) || {};
} catch {
  state = {};
}
if (typeof state !== 'object' || Array.isArray(state)) state = {};
state.done = Array.isArray(state.done)
  ? [...new Set(state.done)].filter((id) => lessons.some((lesson) => lesson.id === id))
  : [];
state.platform = ['android', 'windows'].includes(state.platform)
  ? state.platform
  : /Android/i.test(navigator.userAgent) ? 'android' : 'windows';
state.answers = state.answers && typeof state.answers === 'object' ? state.answers : {};
state.composers = state.composers && typeof state.composers === 'object' ? state.composers : {};
const composerFields = ['task', 'context', 'limits', 'format'];

let greetingIndex = 0;
let greetingBusy = false;
let greetingRun = 0;
let toastTimer;
let lastRoute;

function save() {
  try { localStorage.setItem(stateKey, JSON.stringify(state)); } catch {}
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

function sourceLinks(keys) {
  return keys.map((key) => {
    const [title, slug] = official[key];
    return `<li><a href="https://help.openai.com/en/articles/${slug}" target="_blank" rel="noopener noreferrer">${title}</a></li>`;
  }).join('');
}

function notify(message) {
  clearTimeout(toastTimer);
  byId('toast').textContent = message;
  toastTimer = setTimeout(() => { byId('toast').textContent = ''; }, 3000);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    notify('Скопировано. Можно вставить в ChatGPT.');
    return;
  } catch {}
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.setAttribute('aria-label', 'Текст для копирования');
  field.style.cssText = 'position:fixed;inset:auto auto 0 0;opacity:0';
  document.body.append(field);
  const active = document.activeElement;
  field.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch {}
  field.remove();
  active?.focus();
  if (copied) {
    notify('Скопировано. Можно вставить в ChatGPT.');
    return;
  }
  window.prompt('Выдели и скопируй текст', text);
}

function updateGreeting() {
  byId('welcome-title').textContent = greetings[greetingIndex];
  byId('welcome-step').classList.toggle('long', greetingIndex === 1);
  byId('welcome-next').innerHTML = (greetingIndex === greetings.length - 1 ? 'Начать учиться' : 'Дальше') + ' <span aria-hidden="true">✦</span>';
  byId('welcome-count').textContent = `${greetingIndex + 1} из ${greetings.length}`;
}

function showWelcome(focus) {
  greetingRun += 1;
  greetingIndex = 0;
  greetingBusy = false;
  updateGreeting();
  course.hidden = true;
  welcome.hidden = false;
  window.scrollTo(0, 0);
  if (focus) byId('welcome-title').focus({ preventScroll: true });
}

function showCourse(focus) {
  greetingRun += 1;
  state.intro = true;
  save();
  welcome.hidden = true;
  course.hidden = false;
  renderRoute(focus);
}

byId('welcome-next').addEventListener('click', async () => {
  if (greetingBusy) return;
  if (greetingIndex === greetings.length - 1) {
    showCourse(true);
    return;
  }
  const currentRun = greetingRun;
  const step = byId('welcome-step');
  const animate = !reducedMotion.matches && typeof step.animate === 'function';
  greetingBusy = true;
  try {
    if (animate) {
      await step.animate([
        { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
        { opacity: 0, transform: 'translateY(-32px) scale(.94)', filter: 'blur(10px)' }
      ], { duration: 220, easing: 'ease-in', fill: 'backwards' }).finished;
    }
    if (currentRun !== greetingRun) return;
    greetingIndex += 1;
    updateGreeting();
    byId('welcome-title').focus({ preventScroll: true });
    if (animate) {
      await step.animate([
        { opacity: 0, transform: 'translateY(38px) scale(1.07)', filter: 'blur(13px)' },
        { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' }
      ], { duration: 480, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }).finished;
    }
  } finally {
    if (currentRun === greetingRun) greetingBusy = false;
  }
});

byId('skip').addEventListener('click', () => showCourse(true));
byId('replay').addEventListener('click', () => showWelcome(true));

function updateFont() {
  document.documentElement.classList.toggle('large', !!state.large);
  byId('font-size').setAttribute('aria-pressed', String(!!state.large));
  byId('font-size').setAttribute('aria-label', state.large ? 'Вернуть обычный размер текста' : 'Увеличить текст');
}
byId('font-size').addEventListener('click', () => {
  state.large = !state.large;
  updateFont();
  save();
});

function updateNav(route) {
  byId('chapter-links').innerHTML = lessons.map((lesson, index) => {
    const done = state.done.includes(lesson.id);
    return `<a class="nav-item" href="#${lesson.id}"${route === lesson.id ? ' aria-current="page"' : ''}>
      <span class="nav-number${done ? ' done' : ''}" aria-hidden="true">${done ? '✓' : index + 1}</span>
      <span>${lesson.title}${lesson.optional ? '<small class="optional-label">На потом</small>' : ''}${done ? '<span hidden> (прочитано)</span>' : ''}</span></a>`;
  }).join('');
  const overview = byId('overview-link');
  if (route === 'home') overview.setAttribute('aria-current', 'page');
  else overview.removeAttribute('aria-current');
  byId('progress').max = lessons.length;
  byId('progress').value = state.done.length;
  byId('progress-count').textContent = `${state.done.length} / ${lessons.length}`;
}

function renderHome() {
  const lastLesson = lessons.find((lesson) => lesson.id === state.lastLesson);
  const next = lessons.find((lesson) => !state.done.includes(lesson.id));
  const resume = lastLesson || next;
  const resumeLabel = lastLesson || state.done.length
    ? 'Продолжить обучение'
    : 'Начать с первой главы';
  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Android и Windows</p>
        <h1>ChatGPT для мамы</h1>
        <p>Научись задавать понятные вопросы, находить нужные кнопки и проверять ответы. Можно идти по порядку или открыть любую главу.</p>
        <div class="composer-actions">
          <a class="button" href="#${resume?.id || 'practice'}">${resume ? resumeLabel : 'Открыть практику'}</a>
          <a class="outline" href="#prompts">Как писать запросы</a>
        </div>
      </div>
      <img class="hero-illustration" src="images/course-cover.jpg" alt="" width="900" height="600">
    </section>
    <section class="home-section">
      <h2>Главы курса</h2>
      <p>В каждой главе есть короткий тест. Его можно пропустить.</p>
      <div class="chapter-grid">${lessons.map((lesson, index) => {
        const done = state.done.includes(lesson.id);
        return `<a href="#${lesson.id}" class="chapter-card"><span class="card-number" aria-hidden="true">${done ? '✓' : index + 1}</span><span><strong>${lesson.title}</strong>${lesson.optional ? '<small class="optional-label">На потом</small>' : ''}<small>${lesson.summary}${done ? ' Глава прочитана.' : ''}</small></span></a>`;
      }).join('')}</div>
    </section>`;
}

function renderPlatform(key) {
  return `<div class="platform-switch" role="group" aria-label="Выбери устройство">
    <button type="button" data-platform="android" aria-pressed="false" aria-controls="platform-panel">Android</button>
    <button type="button" data-platform="windows" aria-pressed="false" aria-controls="platform-panel">Windows</button>
  </div>
  <div class="platform-panel" id="platform-panel" data-platform-steps="${key}" aria-live="polite"></div>`;
}

function updatePlatform() {
  const panel = main.querySelector('[data-platform-steps]');
  if (!panel) return;
  main.querySelectorAll('button[data-platform]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.platform === state.platform));
  });
  const topic = panel.dataset.platformSteps;
  const steps = platformSteps[topic][state.platform];
  panel.innerHTML = `<h3>${state.platform === 'android' ? 'На телефоне Android' : 'В приложении Windows'}</h3>
    <ol>${steps.map((step) => `<li>${step}</li>`).join('')}</ol>
    ${state.platform === 'android' && androidGuides[topic] ? renderAndroidGuide(androidGuides[topic]) : ''}`;
}

function renderAndroidGuide({ image, alt, caption, markers, send }) {
  return `<figure class="android-guide">
    <div class="android-screen">
      <img src="${image}" alt="${alt}" width="640" height="1138" loading="lazy">
      ${markers.map(([left, top]) => `<span class="screen-marker" style="--marker-left:${left}%;--marker-top:${top}%" aria-hidden="true"></span>`).join('')}
    </div>
    <figcaption>
      <p>${caption}</p>
      ${send ? '<p class="send-guide"><span aria-hidden="true">↑</span> <span>Отправка. Когда напишешь сообщение, ищи кнопку со стрелкой вверх справа от поля.</span></p>' : ''}
      <p><a href="https://play.google.com/store/apps/details?id=com.openai.chatgpt" target="_blank" rel="noopener noreferrer">Источник скриншота — страница ChatGPT в Google Play</a>. Интерфейс на твоём телефоне может немного отличаться.</p>
    </figcaption>
  </figure>`;
}

function renderExamples(examples) {
  return `<p class="section-note">Это учебные диалоги. Сравни, что можно сделать с каждым ответом.</p>
  ${examples.map(([title, weak, strong, weakAnswer, strongAnswer, why], index) => `
    <details class="example"${index === 0 ? ' open' : ''}>
      <summary>${escapeHtml(title)}</summary>
      <div class="comparison">
        <div class="sample">
          <strong>Слабый запрос</strong><blockquote>«${escapeHtml(weak)}»</blockquote>
          <div class="sample-reply"><strong>Неудачный ответ</strong><p>${escapeHtml(weakAnswer)}</p></div>
        </div>
        <div class="sample better">
          <strong>Удачный запрос</strong><blockquote>«${escapeHtml(strong)}»</blockquote>
          <div class="sample-reply"><strong>Удачный ответ</strong><p>${escapeHtml(strongAnswer)}</p></div>
        </div>
      </div>
      <div class="example-end"><p><strong>В чём разница.</strong> ${escapeHtml(why)}</p><button class="outline" type="button" data-copy="${escapeHtml(strong)}">Скопировать удачный запрос</button></div>
    </details>`).join('')}`;
}

function renderDinnerDemo() {
  return `<div class="dinner-demo" data-dinner-demo>
    <p>Выбери уточнение и посмотри, как изменится ответ в этом учебном чате.</p>
    <div class="chat-pair">
      <p class="chat-request"><strong>Ты</strong> Придумай быстрый ужин.</p>
      <p class="chat-response"><strong>ChatGPT</strong> Сделай салат с нутом. Для начала замочи нут на ночь.</p>
    </div>
    <div class="composer-actions" role="group" aria-label="Уточнить ответ">
      ${dinnerDemo.map(([label], index) => `<button class="outline" type="button" data-dinner-choice="${index}" aria-pressed="false">${label}</button>`).join('')}
    </div>
    <div data-dinner-result aria-live="polite"></div>
  </div>`;
}

function renderToolMap() {
  return `<ul class="tool-map">
    <li><span aria-hidden="true">⌕</span><strong>Поиск</strong><p>Нужно узнать актуальное. Например, проверить часы работы музея.</p></li>
    <li><span aria-hidden="true">▧</span><strong>Фото</strong><p>Нужно разобрать то, что видишь. Например, прочитать этикетку.</p></li>
    <li><span aria-hidden="true">≋</span><strong>Голос</strong><p>Хочется спросить вслух. Например, уточнить рецепт, пока руки заняты.</p></li>
  </ul>`;
}

function renderPhotoExercise() {
  const prompt = 'Прочитай этикетку на фото. Напиши три правила ухода. Если строку не видно, отметь это и не угадывай.';
  return `<div class="photo-exercise">
    <figure>
      <img src="images/practice-label.jpg" alt="Учебное фото носков с этикеткой об уходе" width="1200" height="800" loading="lazy">
      <figcaption>Учебное фото этикетки на вязаных носках.</figcaption>
    </figure>
    <p>Сохрани фото, прикрепи его в новом чате и отправь этот запрос.</p>
    <blockquote>«${escapeHtml(prompt)}»</blockquote>
    <div class="composer-actions">
      <a class="outline" href="images/practice-label.jpg" download="uchebnaya-etiketka.jpg">Скачать фото</a>
      <button class="outline" type="button" data-copy="${escapeHtml(prompt)}">Скопировать запрос для фото</button>
    </div>
    <details class="lesson-details">
      <summary>Сверить ответ с этикеткой</summary>
      <p>Ручная стирка. Температура воды до 30 °C. Сушить горизонтально.</p>
    </details>
  </div>`;
}

function renderPrivacyExample() {
  return `<figure class="privacy-example">
    <div class="privacy-pair">
      <div class="privacy-card"><h3>До</h3><p>Имя: Анна Примерова<br>Телефон: +7 000 000-00-00<br>Заказ: УЧЕБНЫЙ-019</p><p>Посылка пришла с повреждением. Как оформить замену?</p></div>
      <div class="privacy-card"><h3>После</h3><p>Имя: <span class="redaction">скрыто</span><br>Телефон: <span class="redaction">скрыт</span><br>Заказ: <span class="redaction">скрыт</span></p><p>Посылка пришла с повреждением. Как оформить замену?</p></div>
    </div>
    <figcaption>Вымышленное письмо. Оставь описание ситуации. Личные данные закрой непрозрачной заливкой или обрежь изображение, затем проверь сохранённый снимок.</figcaption>
  </figure>`;
}

function renderSection([title, content, note]) {
  let body;
  if (typeof content === 'string') body = `<p>${content}</p>`;
  else if (Array.isArray(content)) body = `<ol>${content.map((item) => `<li>${item}</li>`).join('')}</ol>`;
  else if (content.platform) body = renderPlatform(content.platform);
  else if (content.examples) body = renderExamples(content.examples);
  else if (content.demoChat) body = renderDinnerDemo();
  else if (content.toolMap) body = renderToolMap();
  else if (content.photoExercise) body = renderPhotoExercise();
  else if (content.privacyExample) body = renderPrivacyExample();
  else if (content.faq) body = content.faq.map(([question, answer]) => `<details class="lesson-details"><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('');
  else if (content.prompt) body = `<p>${content.instructions}</p>
    <blockquote>«${escapeHtml(content.prompt)}»</blockquote>
    <div class="composer-actions">
      <button class="outline" type="button" data-copy="${escapeHtml(content.prompt)}">Скопировать первый запрос</button>
      <a class="outline" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Открыть ChatGPT</a>
    </div>`;
  else body = `<div class="callout"><p>${content.callout}</p></div>`;
  return `<section class="article-section"><h2>${title}</h2>${body}${note ? `<p class="section-note">${note}</p>` : ''}</section>`;
}

function renderComposer() {
  return `<section class="composer">
    <h2>Собери свой запрос</h2>
    <p>Впиши задачу и добавь детали, которые могут повлиять на ответ.</p>
    <form id="composer">
      <div class="fields">
        <label>Что сделать? <input name="task" placeholder="Подбери идеи для ужина" maxlength="500" required></label>
        <label>Для кого или для чего? <input name="context" placeholder="Готовлю на двоих" maxlength="500"></label>
        <label>Какие условия? <input name="limits" placeholder="Без духовки, до 25 минут" maxlength="500"></label>
        <label>В каком виде ответ? <input name="format" placeholder="Три варианта со списком шагов" maxlength="500"></label>
      </div>
      <button class="button" type="submit">Собрать запрос</button>
    </form>
    <div id="composer-result" hidden>
      <div class="output" id="prompt-output" aria-live="polite"></div>
      <div class="composer-actions"><button class="outline" type="button" id="copy-composed">Скопировать запрос</button><a class="outline" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Открыть ChatGPT</a></div>
    </div>
  </section>`;
}

function renderPracticeResult() {
  return `<section class="composer">
    <h2>Мой результат</h2>
    <p id="practice-note">Запиши, что получилось и какое уточнение улучшило ответ. Можно сохранить короткую заметку или полезный фрагмент ответа. Заметка сохраняется в этом браузере.</p>
    <label class="practice-label" for="practice-result">Заметка о практике</label>
    <textarea id="practice-result" rows="4" maxlength="4000" aria-describedby="practice-note"></textarea>
  </section>`;
}

function renderQuiz(questions) {
  return `<details class="quiz">
    <summary>Короткий тест <small>· по желанию</small></summary>
    <p>Выбери вариант. Под вопросом появится объяснение.</p>
    ${questions.map(([question, options], index) => `<fieldset class="question" data-question="${index}">
      <legend>${question}</legend>
      <div class="answers">${options.map((option, answerIndex) => `<label class="answer"><input type="radio" name="question-${index}" value="${answerIndex}" aria-describedby="feedback-${index}"><span>${escapeHtml(option)}</span></label>`).join('')}</div>
      <div class="feedback" id="feedback-${index}" aria-live="polite" hidden></div>
    </fieldset>`).join('')}
  </details>`;
}

function renderLesson(lesson, index) {
  return `<article class="article">
    <header class="article-top"><p class="eyebrow">Глава ${index + 1} из ${lessons.length} · ${lesson.minutes} мин</p><h1>${lesson.title}</h1><p>${lesson.summary}</p></header>
    ${lesson.sections.map(renderSection).join('')}
    ${lesson.composer ? renderComposer() : ''}
    ${lesson.id === 'practice' ? renderPracticeResult() : ''}
    ${renderQuiz(lesson.questions)}
    <div class="lesson-footer">
      <button class="outline" type="button" id="mark-done"></button>
      <div>
        ${index ? `<a class="outline" href="#${lessons[index - 1].id}">Предыдущая глава</a>` : '<a class="outline" href="#home">Обзор курса</a>'}
        ${index + 1 < lessons.length ? `<a class="button" href="#${lessons[index + 1].id}">Следующая глава</a>` : '<a class="button" href="#home">К обзору курса</a>'}
      </div>
    </div>
    <section class="article-section"><details><summary>Справка к главе</summary><ul>${sourceLinks(lesson.sources)}</ul></details></section>
  </article>`;
}

function renderSources() {
  return `<article class="article"><header class="article-top"><h1>Справка OpenAI</h1>
    <p>Названия и расположение кнопок могут меняться с обновлениями. Здесь можно уточнить, как сейчас устроены функции.</p></header>
    <section class="article-section"><ul>${sourceLinks(Object.keys(official))}</ul></section></article>`;
}

function updateDoneButton(lesson) {
  const button = byId('mark-done');
  const done = state.done.includes(lesson.id);
  button.textContent = done ? '✓ Глава прочитана' : 'Отметить как прочитанное';
  button.setAttribute('aria-pressed', String(done));
}

function setUpLesson(lesson) {
  updatePlatform();
  updateDoneButton(lesson);
  byId('mark-done').addEventListener('click', () => {
    const index = state.done.indexOf(lesson.id);
    if (index < 0) state.done.push(lesson.id);
    else state.done.splice(index, 1);
    save();
    updateDoneButton(lesson);
    updateNav(lesson.id);
  });

  const quiz = main.querySelector('.quiz');
  const answers = Array.isArray(state.answers[lesson.id]) ? state.answers[lesson.id] : [];
  function showAnswer(fieldset, question, answer) {
    const [, options, correct, why] = lesson.questions[question];
    fieldset.querySelectorAll('.answer').forEach((label, index) => {
      label.classList.toggle('correct', index === correct);
      label.classList.toggle('incorrect', index === answer && answer !== correct);
    });
    const feedback = fieldset.querySelector('.feedback');
    feedback.classList.toggle('success', answer === correct);
    feedback.hidden = false;
    feedback.innerHTML = `<strong>${answer === correct ? 'Верно!' : `Правильный ответ: ${escapeHtml(options[correct])}`}</strong><p>${why}</p>`;
  }

  quiz.querySelectorAll('[data-question]').forEach((fieldset, question) => {
    const answer = answers[question];
    if (!Number.isInteger(answer)) return;
    const input = fieldset.querySelector(`input[value="${answer}"]`);
    if (!input) return;
    input.checked = true;
    quiz.open = true;
    showAnswer(fieldset, question, answer);
  });
  quiz.addEventListener('change', (event) => {
    const fieldset = event.target.closest('[data-question]');
    if (!fieldset) return;
    const question = Number(fieldset.dataset.question);
    const answer = Number(event.target.value);
    answers[question] = answer;
    state.answers[lesson.id] = answers;
    save();
    showAnswer(fieldset, question, answer);
  });

  const practiceResult = byId('practice-result');
  if (practiceResult) {
    if (typeof state.practiceResult === 'string') practiceResult.value = state.practiceResult;
    practiceResult.addEventListener('input', () => {
      state.practiceResult = practiceResult.value;
      save();
    });
  }

  const composer = byId('composer');
  if (!composer) return;
  const savedComposer = state.composers[lesson.id];
  const draft = savedComposer && typeof savedComposer === 'object' ? savedComposer : {};
  const output = byId('prompt-output');
  const result = byId('composer-result');
  for (const field of composerFields) {
    if (typeof draft[field] === 'string') composer.elements[field].value = draft[field];
  }
  if (typeof draft.output === 'string' && draft.output) {
    output.textContent = draft.output;
    result.hidden = false;
  }
  composer.addEventListener('input', (event) => {
    const { name, value } = event.target;
    if (!composerFields.includes(name)) return;
    if (name === 'task') composer.elements.task.setCustomValidity('');
    draft[name] = value;
    state.composers[lesson.id] = draft;
    save();
  });
  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(composer);
    const task = data.get('task').trim();
    if (!task) {
      composer.elements.task.setCustomValidity('Впиши, что нужно сделать.');
      composer.elements.task.reportValidity();
      return;
    }
    const context = data.get('context').trim();
    const limits = data.get('limits').trim();
    const format = data.get('format').trim();
    draft.output = [
      task,
      context && `Контекст: ${context}`,
      limits && `Условия: ${limits}`,
      format && `Формат ответа: ${format}`
    ].filter(Boolean).join('\n');
    output.textContent = draft.output;
    result.hidden = false;
    state.composers[lesson.id] = draft;
    save();
  });
  byId('copy-composed').addEventListener('click', () => copy(byId('prompt-output').textContent));
}

function renderRoute(focus) {
  const hash = location.hash.slice(1);
  const index = lessons.findIndex((lesson) => lesson.id === hash);
  const lesson = lessons[index];
  const route = lesson?.id || (hash === 'sources' ? 'sources' : 'home');
  if (route !== lastRoute) {
    if (lesson && state.lastLesson !== lesson.id) {
      state.lastLesson = lesson.id;
      save();
    }
    if (narrow.matches) chapters.open = false;
    updateNav(route);
    main.innerHTML = lesson ? renderLesson(lesson, index) : route === 'sources' ? renderSources() : renderHome();
    document.title = lesson ? `${lesson.title} · ChatGPT для мамы` : route === 'sources' ? 'Справка · ChatGPT для мамы' : 'ChatGPT для мамы';
    if (lesson) setUpLesson(lesson);
    lastRoute = route;
  }
  if (focus) {
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

main.addEventListener('click', (event) => {
  const copyButton = event.target.closest('button[data-copy]');
  if (copyButton) copy(copyButton.dataset.copy);
  const dinnerButton = event.target.closest('button[data-dinner-choice]');
  if (dinnerButton) {
    const demo = dinnerButton.closest('[data-dinner-demo]');
    const [, request, response, explanation] = dinnerDemo[Number(dinnerButton.dataset.dinnerChoice)];
    demo.querySelectorAll('button[data-dinner-choice]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button === dinnerButton));
    });
    demo.querySelector('[data-dinner-result]').innerHTML = `<div class="chat-pair">
      <p class="chat-request"><strong>Ты</strong> ${escapeHtml(request)}</p>
      <p class="chat-response"><strong>ChatGPT</strong> ${escapeHtml(response)}</p>
    </div><p class="section-note">${escapeHtml(explanation)}</p>`;
  }
  const platformButton = event.target.closest('button[data-platform]');
  if (platformButton) {
    state.platform = platformButton.dataset.platform;
    save();
    updatePlatform();
  }
});

chapters.addEventListener('click', (event) => {
  if (narrow.matches && event.target.closest('a')) chapters.open = false;
});
narrow.addEventListener('change', (event) => { chapters.open = !event.matches; });
window.addEventListener('hashchange', () => {
  if (location.hash === '#main') {
    main.focus();
    return;
  }
  showCourse(true);
});
updateFont();
if (state.intro || (location.hash && location.hash !== '#home')) showCourse(false);
else showWelcome(false);
