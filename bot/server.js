const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();
const { compileScheduleFromClasses } = require('./schedule_compiler.js');

let TelegramBot;
try {
  TelegramBot = require('node-telegram-bot-api');
} catch (e) {
  console.warn('node-telegram-bot-api not loaded, bot features will be disabled until installed.');
}

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const APP_URL = process.env.APP_URL || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const SCHEDULE_FILE = path.join(__dirname, 'schedule_data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Load schedule data
let scheduleData = { weeks: [] };
if (fs.existsSync(SCHEDULE_FILE)) {
  try {
    scheduleData = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
  } catch (e) {
    console.error('Error loading schedule_data.json:', e);
  }
}

// Default Groceries List (Supermarket for relief diet)
const DEFAULT_GROCERIES = [
  { id: 'g_chick', name: '🥩 Куриное филе — 3.2 кг (на 10 порций)' },
  { id: 'g_rice', name: '🍚 Рис басмати — 1 пачка (900 г)' },
  { id: 'g_buckwheat', name: '🌾 Гречневая крупа — 1 пачка (900 г)' },
  { id: 'g_potato', name: '🥔 Картофель свежий — 2 кг' },
  { id: 'g_cheese', name: '🧀 Сыр полутвердый 45% — 350 г' },
  { id: 'g_eggs', name: '🥚 Яйца куриные С0 — 2 десятка (20 шт)' },
  { id: 'g_curd', name: '🥛 Творог 5% в пачках — 7 шт по 200 г (1.4 кг)' },
  { id: 'g_kefir', name: '🥛 Кефир 1% — 2 бутылки по 900 мл' },
  { id: 'g_cuke', name: '🥒 Огурцы свежие — 1.5 кг' },
  { id: 'g_tomato', name: '🥫 Томаты протертые (пассата в с/с) — 2 банки' },
  { id: 'g_berries', name: '🫐 Замороженные ягоды (вишня/черника) — 2 пачки' },
  { id: 'g_banana', name: '🍌 Бананы спелые — 1 связка (4–5 шт)' }
];

// Initialize State
let state = {
  tasksDone: {},
  customTasks: [],
  weightHistory: [
    { date: "17.11.2026", time: "07:30", timestamp: 1731817800000, weight: 91.85, note: "Стартовый замер" }
  ],
  workoutLogs: { A: [], B: [], C: [], D: [] },
  groceries: {},
  subscribers: [],
  sentReminders: {},
  version: 1,
  lastUpdated: Date.now()
};

if (fs.existsSync(STATE_FILE)) {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    state.tasksDone = parsed.tasksDone || {};
    state.customTasks = parsed.customTasks || [];
    state.weightHistory = parsed.weightHistory || [
      { date: "17.11.2026", time: "07:30", timestamp: 1731817800000, weight: 91.85, note: "Стартовый замер" }
    ];
    state.workoutLogs = parsed.workoutLogs || { A: [], B: [], C: [], D: [] };
    state.groceries = parsed.groceries || {};
    state.subscribers = parsed.subscribers || [];
    state.sentReminders = parsed.sentReminders || {};
    state.version = parsed.version || 1;
    state.lastUpdated = parsed.lastUpdated || Date.now();
  } catch (e) {
    console.error('Error reading state.json, initializing fresh state:', e);
  }
}

function saveState() {
  state.version = (state.version || 0) + 1;
  state.lastUpdated = Date.now();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving state:', e);
  }
}

// Full 4 Workout programs description
const WORKOUT_PROGRAMS = {
  A: {
    title: "🏋️ ТРЕНИРОВКА A: Грудь (сила + памп) + Дельты + Трицепс",
    desc: "1. Жим гантелей на наклонной скамье 30° — 4×8–10 (32–36 кг, пауза 1 сек внизу для растяжки).\n2. Жим штанги лежа горизонтально — 3×6–8 (силовая база для плотности).\n3. Сведения Pec-Deck / кроссовер — 3×12–15 + ДРОП-СЕТ в финале (сброс 30% до жжения).\n4. Махи гантелями в стороны стоя — 4×12–15 (локти выше кистей).\n5. Французский жим со штангой лежа (EZ-гриф) — 3×8–10.\n6. Разгибания на блоке с канатом — 3×12–15 (разведение внизу с паузой 2 сек).\n🔥 Кардио: 15 минут в горку на дорожке (уклон 9–12%, скорость 5.3 км/ч)."
  },
  B: {
    title: "🏋️ ТРЕНИРОВКА B: Спина (ширина + толщина) + Дельты (средняя + задняя) + Бицепс",
    desc: "1. Подтягивания с отягощением на поясе — 4–5 подходов:\n   • 1 подход: собств. вес × 10 (разминка).\n   • 2–4 подходы: с весом (+5…+15 кг) × 6–8 (максимальная ширина спины).\n   • 5 подход: собств. вес до отказа (сброс веса).\n2. Рычажная тяга с упором в грудь (Technogym Pure Strength Low Row) — 4×8–12:\n   • Упор в грудь снимает осевую нагрузку с поясницы, изолируя широчайшие.\n   • Вертикальный хват (локти вдоль ребер): бьет в низ/середину широчайших (V-конус к талии).\n   • Горизонтальный хват (локти под 45°): середина спины, ромбовидные и подостная мышца.\n   • В последнем подходе: уницикл поочередно одной рукой с фиксацией 1 сек за спиной!\n3. Горизонтальная тяга блока к поясу сидя (нейтральный/V-хват) — 3–4×10–12:\n   • Непрерывное натяжение троса. В растяжке подать плечи вперед, при тяге мощно свести лопатки.\n4. Махи гантелями в стороны (средняя дельта — специализация) — 4×12–15:\n   • Дроп-сет в финале: рабочий вес × 12, сброс 35% и сразу еще 8–10 без отдыха.\n5. Махи на заднюю дельту в кроссовере / обратный Pec-Deck — 3–4×12–15.\n   • Лайфхак: упр. 4 и 5 можно делать суперсетом для сумасшедшего 3D-пампа!\n6. Подъем штанги на бицепс стоя — 4×8–10:\n   • Строгая негативная фаза: медленный спуск 3 секунды вниз!\n7. Молотковые сгибания на скамье Скотта / стоя — 3×10–12 (брахиалис и пик).\n🔥 Кардио: 15 минут ходьбы в горку (уклон 10–12%, скорость 5.3 км/ч)."
  },
  C: {
    title: "🏋️ ТРЕНИРОВКА C: Ноги (мощный жиросжигающий стимул) + Пресс",
    desc: "1. Приседания со штангой на спине — 4×8–10 (или жим ногами в тренажере 4×10–12 с хорошей глубиной).\n2. Болгарские сплит-приседания с гантелями (нога на скамье) — 4×10–12 на каждую ногу (наклон корпуса вперед 15–20° для взрывного включения ягодичных и бицепса бедра).\n3. Сгибания ног в тренажере лежа/сидя — 4×12–15 (доработка бицепса бедра).\n4. Разгибания ног в тренажере сидя — 3×12–15 (пампинг капель квадрицепса).\n5. Подъем на носки стоя (икры) — 4×15–20 с 2-секундной растяжкой внизу.\n6. Подъем прямых ног в висе на перекладине — 4×12–15.\n7. «Молитва» (скручивания на блоке на коленях с канатом) — 3×15.\n🔥 Кардио: 15 минут ходьбы в горку (уклон 10–12%, скорость 5.0–5.2 км/ч)."
  },
  D: {
    title: "🏋️ ТРЕНИРОВКА D: 3D-Дельты (Ширина силуэта) + Руки (Суперсеты на рельеф)",
    desc: "1. Армейский жим штанги стоя (или жим гантелей сидя) — 4×6–8 (тяжелая база).\n2. Тяга штанги к подбородку широким хватом — 3×10–12 (средние дельты).\n3. Гигантский сет на дельты (3 круга без отдыха):\n   • Махи гантелями в стороны — 12 повт.\n   • Махи гантелями перед собой — 12 повт.\n   • Махи в наклоне на заднюю дельту — 12 повт.\n4. Суперсет 1 на руки (3 подхода):\n   • Сгибания с гантелями с супинацией на наклонной скамье — 3×10–12.\n   • Отжимания на брусьях с весом на поясе — 3×8–10.\n5. Суперсет 2 на памп и венозность (3 подхода):\n   • Сгибания на бицепс в кроссовере с нижнего блока — 3×12–15.\n   • Разгибания на трицепс из-за головы с канатом — 3×12–15.\n🔥 Кардио: 15 минут в горку на дорожке (уклон 9–12%, скорость 5.3 км/ч)."
  }
};

// Helper: flat list of all days
function getAllDays() {
  const list = [];
  scheduleData.weeks.forEach(w => {
    w.days.forEach(d => {
      list.push({ ...d, weekNumber: w.weekNumber, weekTitle: w.title });
    });
  });
  return list;
}

// Helper: find day by ID (e.g. 'w1-d4')
function getDayById(dayId) {
  const days = getAllDays();
  return days.find(d => d.id === dayId) || days[0];
}

// Helper: get current date & time in Europe/Moscow
function getMoscowTime() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const map = {};
  parts.forEach(p => map[p.type] = p.value);
  return {
    year: parseInt(map.year),
    month: parseInt(map.month),
    day: parseInt(map.day),
    hour: parseInt(map.hour),
    minute: parseInt(map.minute),
    dateStr: `${map.year}-${map.month}-${map.day}`,
    timeStr: `${map.hour}:${map.minute}`
  };
}

// Helper: map a date to day in schedule
function getTodayDay() {
  const days = getAllDays();
  const mTime = getMoscowTime();
  const monthNamesRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const todayStr = `${mTime.day} ${monthNamesRu[mTime.month - 1]}`;

  const match = days.find(d => d.date.toLowerCase().trim() === todayStr.toLowerCase().trim());
  if (match) return match;

  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const week2 = scheduleData.weeks.find(w => w.weekNumber === 2) || scheduleData.weeks[0];
  return week2.days[dayOfWeek] || days[0];
}

// Helper: get next / prev day IDs
function getAdjacentDayIds(currentDayId) {
  const days = getAllDays();
  const idx = days.findIndex(d => d.id === currentDayId);
  const prevId = idx > 0 ? days[idx - 1].id : days[days.length - 1].id;
  const nextId = idx < days.length - 1 ? days[idx + 1].id : days[0].id;
  return { prevId, nextId };
}

// Progress Bar Helper
function renderProgressBar(done, total) {
  if (total === 0) return '⬜⬜⬜⬜⬜ 0%';
  const percent = Math.round((done / total) * 100);
  const blocks = Math.round((done / total) * 10);
  const filled = '🟩'.repeat(blocks);
  const empty = '⬜'.repeat(10 - blocks);
  return `${filled}${empty} ${done}/${total} (${percent}%)`;
}

// Format Day Message for Telegram
function formatDayMessage(day) {
  const allTasks = [...(day.tasks || [])];
  const custom = (state.customTasks || []).filter(t => t.dayId === day.id);
  custom.forEach(c => allTasks.push(c));

  const total = allTasks.length;
  const doneCount = allTasks.filter(t => !!state.tasksDone[t.id]).length;

  let text = `📅 *${day.name}, ${day.date}* (${day.weekTitle || 'Неделя'})\n`;

  if (day.badges && day.badges.length > 0) {
    text += `🏷️ ${day.badges.join(' • ')}\n`;
  }

  text += `\n📊 *Прогресс:* ${renderProgressBar(doneCount, total)}\n\n`;
  text += `📋 *План на день:*\n`;

  allTasks.forEach(task => {
    const isDone = !!state.tasksDone[task.id];
    const mark = isDone ? '✅' : '▫️';
    const title = isDone ? `~${task.title}~` : `*${task.title}*`;
    text += `${mark} \`${task.time}\` ${title}\n`;
    if (task.desc && !isDone) {
      const shortDesc = task.desc.length > 85 ? task.desc.substring(0, 82) + '...' : task.desc;
      text += `    _${shortDesc}_\n`;
    }
  });

  text += `\n_Нажимайте кнопки ниже, чтобы отмечать дела (синхронизируется на всех экранах):_`;
  return text;
}

// Format Day Inline Keyboard
function formatDayKeyboard(day) {
  const allTasks = [...(day.tasks || [])];
  const custom = (state.customTasks || []).filter(t => t.dayId === day.id);
  custom.forEach(c => allTasks.push(c));

  const keyboard = [];

  allTasks.forEach(task => {
    const isDone = !!state.tasksDone[task.id];
    const timeShort = task.time.split(' - ')[0] || task.time;
    let cleanTitle = task.title.replace(/[🏋️🍳📚🛋️🚌😴🎓🏥🧺🛒📐🎉]/g, '').trim();
    if (cleanTitle.length > 22) cleanTitle = cleanTitle.substring(0, 20) + '..';

    const btnText = `${isDone ? '✅' : '⬜'} ${timeShort} ${cleanTitle}`;
    keyboard.push([{ text: btnText, callback_data: `toggle:${task.id}:${day.id}` }]);
  });

  const { prevId, nextId } = getAdjacentDayIds(day.id);
  keyboard.push([
    { text: '⬅️ Пред. день', callback_data: `day:${prevId}` },
    { text: '📅 Сегодня', callback_data: `day:${getTodayDay().id}` },
    { text: 'След. день ➡️', callback_data: `day:${nextId}` }
  ]);

  const extraRow = [];
  const hasGym = day.badges && day.badges.some(b => b.includes('Зал'));
  if (hasGym) {
    extraRow.push({ text: '🏋️ Разбор тренировки', callback_data: `workout:${day.id}` });
  }
  extraRow.push({ text: '🍳 Меню и готовка', callback_data: `food:${day.id}` });
  if (extraRow.length > 0) keyboard.push(extraRow);

  const actionRow = [
    { text: '🗓️ Выбрать дату', callback_data: 'menu:days' },
    { text: '🔄 Обновить', callback_data: `refresh:${day.id}` }
  ];
  if (APP_URL) {
    actionRow.unshift({ text: '🌐 Открыть Web App', web_app: { url: APP_URL } });
  }
  keyboard.push(actionRow);

  return { inline_keyboard: keyboard };
}

// Persistent Reply Keyboard for bottom of chat
function getPersistentReplyKeyboard() {
  const keyboard = [
    [{ text: '📅 Сегодня' }, { text: '📆 Завтра' }],
    [{ text: '🏋️ Тренировка' }, { text: '🍳 Питание & Готовка' }],
    [{ text: '🛒 Список продуктов' }, { text: '⚖️ Замер веса' }],
    [{ text: '🗓️ Все дни месяца' }, { text: '📊 Прогресс' }],
    [{ text: '🌐 Открыть трекер' }]
  ];
  return {
    keyboard: keyboard,
    resize_keyboard: true,
    persistent: true
  };
}

// Format Weight Response Card
function formatWeightCard(currentWeight) {
  const startWeight = 91.85;
  const targetWeight = 85.0;
  const totalLost = (startWeight - currentWeight).toFixed(2);
  const remaining = (currentWeight - targetWeight).toFixed(2);
  const progressRatio = Math.min(1, Math.max(0, (startWeight - currentWeight) / (startWeight - targetWeight)));
  const percent = Math.round(progressRatio * 100);
  const blocks = Math.round(progressRatio * 10);
  const bar = '🟩'.repeat(blocks) + '⬜'.repeat(10 - blocks);

  let weekDiff = null;
  const oneWeekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const oldEntry = (state.weightHistory || []).slice().reverse().find(w => w.timestamp <= oneWeekAgo);
  if (oldEntry) {
    weekDiff = (currentWeight - oldEntry.weight).toFixed(2);
  }

  let text = `⚖️ *ЗАМЕР ВЕСА ЗАФИКСИРОВАН: ${currentWeight} кг!*\n\n`;
  if (weekDiff !== null) {
    text += `📉 *Динамика за неделю:* ${weekDiff > 0 ? '+' : ''}${weekDiff} кг (чистый сброс жира)\n`;
  }
  text += `🔥 *Всего сброшено:* ${totalLost > 0 ? '-' : ''}${totalLost} кг\n`;
  text += `🎯 *До цели (85.0 кг):* осталось ${remaining > 0 ? remaining : 0} кг\n`;
  text += `📊 *Прогресс сушки:* ${bar} ${percent}%\n\n`;
  text += `💪 Отличный темп, дефицит соблюдается идеально! Продолжайте в том же духе.`;
  return text;
}

// Format Groceries Message & Keyboard
function formatGroceries() {
  const items = DEFAULT_GROCERIES;
  const keyboard = [];
  let total = items.length;
  let doneCount = 0;

  items.forEach(it => {
    const isDone = !!state.groceries[it.id];
    if (isDone) doneCount++;
    const mark = isDone ? '✅' : '⬜';
    keyboard.push([{ text: `${mark} ${it.name}`, callback_data: `groc:${it.id}` }]);
  });

  keyboard.push([
    { text: '🔄 Сбросить список для новой закупки', callback_data: 'groc:reset' },
    { text: '📅 К плану дня', callback_data: `day:${getTodayDay().id}` }
  ]);

  const percent = Math.round((doneCount / total) * 100);
  let text = `🛒 *СПИСОК ПРОДУКТОВ НА НЕДЕЛЮ (ДЛЯ СУШКИ И БАТЧ-КУКИНГА)*\n\n` +
    `Нажимайте на кнопки внизу прямо в супермаркете, чтобы вычеркивать купленное:\n\n` +
    `📊 *Собрано в корзину:* ${doneCount}/${total} (${percent}%)`;

  return { text, keyboard };
}

// --- EXPRESS SERVER ---
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// API Endpoints
app.get('/api/state', (req, res) => {
  res.json({
    tasksDone: state.tasksDone,
    customTasks: state.customTasks,
    weightHistory: state.weightHistory,
    workoutLogs: state.workoutLogs,
    groceries: state.groceries,
    version: state.version,
    lastUpdated: state.lastUpdated,
    weeks: scheduleData.weeks
  });
});

app.get('/api/version', (req, res) => {
  res.json({
    version: state.version,
    lastUpdated: state.lastUpdated
  });
});

app.post('/api/toggle', (req, res) => {
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId is required' });

  const current = !!state.tasksDone[taskId];
  state.tasksDone[taskId] = !current;
  saveState();

  res.json({
    success: true,
    taskId,
    done: state.tasksDone[taskId],
    version: state.version
  });
});

app.post('/api/weight', (req, res) => {
  const { weight } = req.body;
  if (!weight) return res.status(400).json({ error: 'weight is required' });
  const val = parseFloat(weight);
  state.weightHistory.push({
    date: new Date().toLocaleDateString('ru-RU'),
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    timestamp: Date.now(),
    weight: val
  });
  saveState();
  res.json({ success: true, weightHistory: state.weightHistory });
});

// Start Express HTTP Server
const server = app.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const addr of interfaces[k]) {
      if (addr.family === 'IPv4' && !addr.internal) {
        addresses.push(addr.address);
      }
    }
  }

  console.log('\n=============================================================');
  console.log(`🚀 Сервер запущен на порту ${PORT}!`);
  console.log(`💻 Локально на ПК:         http://localhost:${PORT}`);
  addresses.forEach(ip => {
    console.log(`📱 С телефона по Wi-Fi:   http://${ip}:${PORT}`);
  });
  console.log('=============================================================\n');
});

// --- TELEGRAM BOT LOGIC ---
let bot = null;
const userStates = {};

if (BOT_TOKEN && TelegramBot) {
  try {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    console.log('🤖 Телеграм-бот успешно подключен и слушает команды!');

    function ensureSubscriber(chatId) {
      if (!state.subscribers.includes(chatId)) {
        state.subscribers.push(chatId);
        saveState();
      }
    }

    // Handle /start and /menu
    bot.onText(/\/(start|menu)/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const today = getTodayDay();
      
      const welcomeText = `👋 Привет! Это твой персональный ассистент расписания и сушки «Под ключ».\n\n` +
        `✨ *Что умеет этот бот:*\n` +
        `• ✅ *Чекбокс-трекер:* отмечай задачи прямо в чате кнопками — мгновенно синхронизируется с сайтом!\n` +
        `• 🔔 *Умные push-напоминания:* утренний брифинг в 07:30, напоминание о выезде за 40 мин, батч-кукинг в 19:00 и отбой в 23:00.\n` +
        `• ⚖️ *Трекер веса:* отправь вес (например: \`/weight 91.2\` или просто \`91.2\`) — бот покажет темп сброса и прогресс до 85 кг.\n` +
        `• 📝 *Дневник тренировок:* кнопка «Записать веса» или \`/log\` — бот запоминает веса и напоминает их перед следующим разом!\n` +
        `• 🎙️ *Голосовое управление:* наговаривай дела голосом — бот сам расшифрует и добавит в нужный день!\n` +
        `• 🛒 *Список продуктов:* \`/groceries\` — интерактивный чек-лист для похода в магазин.\n\n` +
        `Выбирай действие в меню внизу или отмечай дела на карточке 👇`;

      await bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'Markdown',
        reply_markup: getPersistentReplyKeyboard()
      });

      await bot.sendMessage(chatId, formatDayMessage(today), {
        parse_mode: 'Markdown',
        reply_markup: formatDayKeyboard(today)
      });
    });

    // Handle "📅 Сегодня" or /today
    bot.onText(/(\/today|📅 Сегодня)/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const today = getTodayDay();
      await bot.sendMessage(chatId, formatDayMessage(today), {
        parse_mode: 'Markdown',
        reply_markup: formatDayKeyboard(today)
      });
    });

    // Handle "📆 Завтра" or /tomorrow
    bot.onText(/(\/tomorrow|📆 Завтра)/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const today = getTodayDay();
      const { nextId } = getAdjacentDayIds(today.id);
      const tomorrow = getDayById(nextId);

      await bot.sendMessage(chatId, formatDayMessage(tomorrow), {
        parse_mode: 'Markdown',
        reply_markup: formatDayKeyboard(tomorrow)
      });
    });

    // Handle "🏋️ Тренировка" or /workout
    bot.onText(/(\/workout|🏋️ Тренировка)/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const today = getTodayDay();
      const gymTask = today.tasks.find(t => t.cat === 'gym' && (t.title.includes('ТРЕНИРОВКА') || t.title.includes('Зал')) && !t.title.includes('Дорога'));

      if (gymTask) {
        const wKey = gymTask.title.includes('[A]') ? 'A' : gymTask.title.includes('[B]') ? 'B' : gymTask.title.includes('[C]') ? 'C' : 'D';
        const pastLogs = state.workoutLogs[wKey] || [];
        const lastLog = pastLogs.length > 0 ? pastLogs[pastLogs.length - 1] : null;

        let response = `🏋️ *ПОДРОБНЫЙ ПЛАН ТРЕНИРОВКИ НА СЕГОДНЯ (${today.name}, ${today.date}):*\n\n`;
        response += `*${gymTask.title}*\n\n`;
        response += `📋 *Упражнения, подходы и техника:*\n${gymTask.desc}\n\n`;

        if (lastLog) {
          response += `💡 *Прошлый результат (${lastLog.date}):*\n_${lastLog.text}_\n\n🎯 *Цель на сегодня:* пробуй взять на 1–2 кг больше или сделать +1–2 повторения (прогрессивная перегрузка)!\n\n`;
        }

        response += `💡 *Статус:* ${state.tasksDone[gymTask.id] ? '✅ Выполнено!' : '▫️ Еще не сделано'}`;

        await bot.sendMessage(chatId, response, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: state.tasksDone[gymTask.id] ? '✅ Выполнено (нажмите для отмены)' : '⬜ Отметить тренировку выполненной', callback_data: `toggle:${gymTask.id}:${today.id}` }],
              [{ text: '📝 Записать рабочие веса', callback_data: `log:prompt:${today.id}:${wKey}` }],
              [{ text: '📅 Вернуться к расписанию', callback_data: `day:${today.id}` }],
              [{ text: '📋 Меню всех тренировок (A, B, C, D)', callback_data: 'workouts:all' }]
            ]
          }
        });
      } else {
        const allDays = getAllDays();
        const todayIdx = allDays.findIndex(d => d.id === today.id);
        let nextGym = null;
        for (let i = 1; i <= 7; i++) {
          const checkDay = allDays[(todayIdx + i) % allDays.length];
          const task = checkDay.tasks.find(t => t.cat === 'gym' && (t.title.includes('ТРЕНИРОВКА') || t.title.includes('Зал')) && !t.title.includes('Дорога'));
          if (task) {
            nextGym = { day: checkDay, task };
            break;
          }
        }

        let restText = `🎉 *Сегодня (${today.name}) день отдыха от зала!*\n\n` +
          `Идет суперкомпенсация и рост мышц. По вашему обновленному графику тренировки проходят по дням: **ВТОРНИК, ЧЕТВЕРГ, СУББОТА**.\n\n`;
        if (nextGym) {
          restText += `🔜 *Следующая тренировка:* ${nextGym.day.name} (${nextGym.day.date})\n*${nextGym.task.title}*`;
        }

        const buttons = [];
        if (nextGym) {
          buttons.push([{ text: `👁️ Разбор тренировки на ${nextGym.day.name}`, callback_data: `workout:${nextGym.day.id}` }]);
        }
        buttons.push([
          { text: '📋 Все тренировки (A, B, C, D)', callback_data: 'workouts:all' },
          { text: '📅 План на сегодня', callback_data: `day:${today.id}` }
        ]);

        await bot.sendMessage(chatId, restText, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons }
        });
      }
    });

    // Handle "🛒 Список продуктов" or /groceries
    bot.onText(/(\/groceries|🛒 Список продуктов)/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const { text, keyboard } = formatGroceries();
      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    });

    // Handle "⚖️ Замер веса" or /weight
    bot.onText(/(\/weight|⚖️ Замер веса)(?:\s+([0-9]+[.,]?[0-9]*))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const rawVal = match[2];

      if (rawVal) {
        const val = parseFloat(rawVal.replace(',', '.'));
        state.weightHistory.push({
          date: new Date().toLocaleDateString('ru-RU'),
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
          weight: val
        });
        saveState();

        await bot.sendMessage(chatId, formatWeightCard(val), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 История замеров', callback_data: 'weights:history' }],
              [{ text: '📅 К плану дня', callback_data: `day:${getTodayDay().id}` }]
            ]
          }
        });
      } else {
        userStates[chatId] = { action: 'awaiting_weight' };
        await bot.sendMessage(chatId, '⚖️ *Замер веса натощак*\n\nОтправьте в ответ ваш текущий вес (например: `91.4`):', {
          parse_mode: 'Markdown'
        });
      }
    });

    // Handle /weights (History)
    bot.onText(/\/weights/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      await sendWeightHistory(chatId);
    });

    async function sendWeightHistory(chatId, messageId = null) {
      const history = (state.weightHistory || []).slice(-10);
      let text = '📊 *ИСТОРИЯ ВЗВЕШИВАНИЙ (последние записи):*\n\n';
      history.forEach(h => {
        text += `• *${h.date}* (${h.time || 'утро'}): \`${h.weight} кг\` ${h.note ? `_(${h.note})_` : ''}\n`;
      });
      const latest = history[history.length - 1];
      if (latest) {
        const diff = (91.85 - latest.weight).toFixed(2);
        text += `\n🔥 *Суммарный сброс:* -${diff} кг от старта (91.85 кг)`;
      }

      const keyboard = [[{ text: '📅 Вернуться к расписанию', callback_data: `day:${getTodayDay().id}` }]];
      if (messageId) {
        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
      } else {
        await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } });
      }
    }

    // Handle /log <text>
    bot.onText(/\/log(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const text = match[1];
      const today = getTodayDay();
      const gymTask = today.tasks.find(t => t.cat === 'gym' && t.title.includes('ТРЕНИРОВКА'));
      const wKey = gymTask ? (gymTask.title.includes('[A]') ? 'A' : gymTask.title.includes('[B]') ? 'B' : gymTask.title.includes('[C]') ? 'C' : 'D') : 'A';

      if (text) {
        state.workoutLogs[wKey].push({
          date: new Date().toLocaleDateString('ru-RU'),
          dayId: today.id,
          workoutKey: wKey,
          text: text.trim(),
          timestamp: Date.now()
        });
        saveState();

        await bot.sendMessage(chatId, `📝 *Рабочие веса успешно записаны для Тренировки ${wKey}!*\n\n_${text.trim()}_\n\nПеред следующей тренировкой этого типа бот напомнит ваши веса! 🔥`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🏋️ Посмотреть тренировку', callback_data: `workout:${today.id}` }]]
          }
        });
      } else {
        userStates[chatId] = { action: 'awaiting_log', wKey, dayId: today.id };
        await bot.sendMessage(chatId, `📝 *Запись рабочих весов (Тренировка ${wKey})*\n\nНапишите в ответном сообщении упражнения и веса (например: \`Жим гантелей 34 кг × 10, подтягивания +12.5 кг × 8\`):`, {
          parse_mode: 'Markdown'
        });
      }
    });

    // Handle voice messages (Voice to Schedule & Data)
    bot.on('voice', async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);

      const waitMsg = await bot.sendMessage(chatId, '🎙️ _Слушаю и расшифровываю голосовое сообщение..._', { parse_mode: 'Markdown' });

      try {
        const fileLink = await bot.getFileLink(msg.voice.file_id);
        const audioRes = await fetch(fileLink);
        const arrayBuffer = await audioRes.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');

        if (!GEMINI_API_KEY) {
          await bot.editMessageText('🎙️ _Голосовое получено, но не указан GEMINI_API_KEY в .env._', { chat_id: chatId, message_id: waitMsg.message_id });
          return;
        }

        const prompt = `Ты умный персональный ассистент по расписанию и фитнесу. Пользователь наговорил голосом сообщение.
Расшифруй аудио строго и точно.
1. Если это задача или изменение расписания (например "завтра в 14:00 зайти в деканат", "в пятницу в 11 пары"), извлеки:
   - dayName: название дня недели (Понедельник, Вторник, Среда, Четверг, Пятница, Суббота, Воскресенье)
   - time: время (например 14:00)
   - title: короткий заголовок задачи
   - desc: подробности если есть
2. Если это замер веса (например "мой вес 91 и 2" или "взвесился 90.8"):
   - isWeight: true, weightValue: 91.2
3. Если это рабочие веса в зале (например "пожал 34 на 10"):
   - isWorkoutLog: true, logText: "..."

Ответь строго в формате JSON (без markdown-оберток):
{
  "recognizedText": "текст расшифровки",
  "type": "task" | "weight" | "workoutLog" | "general",
  "dayName": "...",
  "time": "...",
  "title": "...",
  "desc": "...",
  "weightValue": 0,
  "logText": "..."
}`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: 'audio/ogg', data: base64Audio } }
              ]
            }]
          })
        });

        const geminiData = await geminiRes.json();
        const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) throw new Error('Empty response from AI');

        const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.type === 'weight' && parsed.weightValue) {
          const val = parseFloat(parsed.weightValue);
          state.weightHistory.push({
            date: new Date().toLocaleDateString('ru-RU'),
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            weight: val
          });
          saveState();
          await bot.editMessageText(`🎙️ *Голос:* «${parsed.recognizedText}»\n\n` + formatWeightCard(val), {
            chat_id: chatId,
            message_id: waitMsg.message_id,
            parse_mode: 'Markdown'
          });
        }
        else if (parsed.type === 'workoutLog' && parsed.logText) {
          const today = getTodayDay();
          const gymTask = today.tasks.find(t => t.cat === 'gym' && t.title.includes('ТРЕНИРОВКА'));
          const wKey = gymTask ? (gymTask.title.includes('[A]') ? 'A' : gymTask.title.includes('[B]') ? 'B' : gymTask.title.includes('[C]') ? 'C' : 'D') : 'A';
          state.workoutLogs[wKey].push({
            date: new Date().toLocaleDateString('ru-RU'),
            dayId: today.id,
            workoutKey: wKey,
            text: parsed.logText,
            timestamp: Date.now()
          });
          saveState();
          await bot.editMessageText(`🎙️ *Голос:* «${parsed.recognizedText}»\n\n📝 *Рабочие веса записаны для Тренировки ${wKey}!*\n_${parsed.logText}_`, {
            chat_id: chatId,
            message_id: waitMsg.message_id,
            parse_mode: 'Markdown'
          });
        }
        else if (parsed.type === 'task' || (parsed.title && parsed.dayName)) {
          const allDays = getAllDays();
          const targetDay = allDays.find(d => d.name.toLowerCase().includes(parsed.dayName.toLowerCase())) || getTodayDay();
          const newTask = {
            id: `custom-${Date.now()}`,
            dayId: targetDay.id,
            time: parsed.time || '14:00',
            title: parsed.title,
            desc: parsed.desc || '',
            cat: 'other',
            done: false
          };
          state.customTasks.push(newTask);
          saveState();

          const successText = `🎙️ *Голос распознан:* «${parsed.recognizedText}»\n\n` +
            `✅ *Дело успешно добавлено в расписание!*\n` +
            `📅 *День:* ${targetDay.name} (${targetDay.date})\n` +
            `⏰ *Время:* \`${newTask.time}\`\n` +
            `📌 *Дело:* *${newTask.title}*`;

          await bot.editMessageText(successText, {
            chat_id: chatId,
            message_id: waitMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: `📅 Открыть ${targetDay.name}`, callback_data: `day:${targetDay.id}` }]]
            }
          });
        }
        else {
          await bot.editMessageText(`🎙️ *Голос распознан:* «${parsed.recognizedText}»\n\n💡 Для добавления дела укажите день недели и время (например: *«завтра в 14:00 зайти в деканат»*).`, {
            chat_id: chatId,
            message_id: waitMsg.message_id,
            parse_mode: 'Markdown'
          });
        }

      } catch (err) {
        console.error('Voice handling error:', err);
        await bot.editMessageText('🎙️ Не удалось обработать голосовое сообщение. Попробуйте надиктовать четче или отправьте текстом.', {
          chat_id: chatId,
          message_id: waitMsg.message_id
        });
      }
    });

    // Handle plain text for awaiting states (Weight or Log or bare numbers)
    bot.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const text = msg.text.trim();

      const numMatch = text.match(/^([0-9]{2}[.,][0-9]+)$/);
      if (numMatch || (userStates[chatId] && userStates[chatId].action === 'awaiting_weight')) {
        const valStr = numMatch ? numMatch[1] : text;
        const val = parseFloat(valStr.replace(',', '.'));
        if (!isNaN(val) && val > 40 && val < 200) {
          delete userStates[chatId];
          state.weightHistory.push({
            date: new Date().toLocaleDateString('ru-RU'),
            time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            weight: val
          });
          saveState();

          await bot.sendMessage(chatId, formatWeightCard(val), {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📊 История замеров', callback_data: 'weights:history' }],
                [{ text: '📅 К плану дня', callback_data: `day:${getTodayDay().id}` }]
              ]
            }
          });
          return;
        }
      }

      if (userStates[chatId] && userStates[chatId].action === 'awaiting_log') {
        const { wKey, dayId } = userStates[chatId];
        delete userStates[chatId];

        state.workoutLogs[wKey].push({
          date: new Date().toLocaleDateString('ru-RU'),
          dayId: dayId || getTodayDay().id,
          workoutKey: wKey,
          text: text,
          timestamp: Date.now()
        });
        saveState();

        await bot.sendMessage(chatId, `📝 *Рабочие веса успешно записаны для Тренировки ${wKey}!*\n\n_${text}_\n\nПеред следующей тренировкой этого типа бот напомнит эти результаты! 🔥`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🏋️ Вернуться к тренировке', callback_data: `workout:${dayId}` }]]
          }
        });
        return;
      }
    });

    // Handle "🍳 Питание & Готовка" or /food
    bot.onText(/(\/food|🍳 Питание|🍳 Питание & Готовка)/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const today = getTodayDay();
      const foodTasks = today.tasks.filter(t => t.cat === 'food' || (t.desc && t.desc.includes('ккал')));

      let text = `🍳 *План питания и готовки на ${today.name} (${today.date}):*\n\n`;
      text += `🎯 *Цель:* Рельеф без потери силы (1850–1900 ккал • Б: 155–160г | Ж: 50–55г | У: 180–190г)\n\n`;

      foodTasks.forEach(ft => {
        const isDone = !!state.tasksDone[ft.id];
        text += `${isDone ? '✅' : '▫️'} \`${ft.time}\` *${ft.title}*\n`;
        if (ft.desc) text += `    _${ft.desc}_\n\n`;
      });

      if (today.id.includes('d3') || today.id.includes('d5') || today.id.includes('d7')) {
        text += `🥘 *СЕГОДНЯ БАТЧ-КУКИНГ (готовка на 2 дня за 20 минут):*\n` +
          `Варим рис/гречку в мультиварке + куриное филе на сковороде в томатах. Раскладываем по 2 контейнерам, чтобы завтра кухня была свободна!`;
      } else {
        text += `🍱 *СЕГОДНЯ ДЕНЬ БЕЗ ГОТОВКИ:*\n` +
          `Еда уже готова во вчерашнем контейнере! Просто достаем и разогреваем за 2 минуты в микроволновке.`;
      }

      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '📅 Вернуться к дню', callback_data: `day:${today.id}` }]]
        }
      });
    });

    // Handle "📊 Прогресс" or /stats
    bot.onText(/(\/stats|📊 Прогресс)/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const days = getAllDays();
      let totalTasks = 0;
      let totalDone = 0;

      days.forEach(d => {
        d.tasks.forEach(t => {
          totalTasks++;
          if (state.tasksDone[t.id]) totalDone++;
        });
      });

      const today = getTodayDay();
      const todayTotal = today.tasks.length;
      const todayDone = today.tasks.filter(t => !!state.tasksDone[t.id]).length;

      let text = `📊 *ВАША СТАТИСТИКА ВЫПОЛНЕНИЯ ПЛАНА:*\n\n`;
      text += `📅 *Сегодня (${today.name}):*\n`;
      text += `${renderProgressBar(todayDone, todayTotal)}\n\n`;
      text += `🗓️ *Общий прогресс месяца (30 дней):*\n`;
      text += `${renderProgressBar(totalDone, totalTasks)}\n\n`;
      text += `💪 *Выполнено дел:* ${totalDone} из ${totalTasks}\n`;
      text += `🔥 Отличный темп, продолжай в том же духе!`;

      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 К сегодняшнему дню', callback_data: `day:${today.id}` }],
            [{ text: '🗓️ Выбрать другой день', callback_data: 'menu:days' }]
          ]
        }
      });
    });

    // Handle "🗓️ Все дни месяца"
    bot.onText(/(\/days|🗓️ Все дни месяца)/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      await sendDaysMenu(chatId);
    });

    // Handle "🌐 Открыть трекер"
    bot.onText(/(\/web|🌐 Открыть трекер)/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const interfaces = os.networkInterfaces();
      const ipList = [];
      for (const k in interfaces) {
        for (const addr of interfaces[k]) {
          if (addr.family === 'IPv4' && !addr.internal) ipList.push(addr.address);
        }
      }

      let text = `🌐 *Интерактивный трекер с галочками:*\n\n`;
      text += `💻 *На компьютере:* [Открыть локально](http://localhost:${PORT})\n`;
      if (ipList.length > 0) {
        text += `📱 *На телефоне (в одном Wi-Fi):* http://${ipList[0]}:${PORT}\n\n`;
      }
      text += `Все галочки, которые вы нажимаете на сайте или в боте, моментально сохраняются и синхронизируются на всех экранах!`;

      const keyboard = [];
      if (APP_URL) {
        keyboard.push([{ text: '🚀 Запустить прямо в Telegram (Mini App)', web_app: { url: APP_URL } }]);
      }
      keyboard.push([{ text: '📅 Вернуться к дню', callback_data: `day:${getTodayDay().id}` }]);

      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    });

    // Handle /workouts (all 4 programs)
    bot.onText(/\/workouts/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      await sendWorkoutsMenu(chatId);
    });

    async function sendWorkoutsMenu(chatId, messageId = null) {
      const text = `🏋️ *ПРОГРАММА ТРЕНИРОВОК НА РЕЛЬЕФ (4-ДНЕВНЫЙ СПЛИТ)*\n\n` +
        `График тренировок: **ВТОРНИК, ЧЕТВЕРГ, СУББОТА**\n` +
        `Циклическая ротация: **C ➔ D ➔ A ➔ B**\n\n` +
        `Выберите тренировку для подробного просмотра техники, весов и подходов:`;

      const keyboard = [
        [{ text: '🏋️ [A] Грудь + Дельты + Трицепс', callback_data: 'prog:A' }],
        [{ text: '🏋️ [B] Спина (Low Row) + Бицепс + Дельты', callback_data: 'prog:B' }],
        [{ text: '🏋️ [C] Ноги (тяжелая база) + Пресс', callback_data: 'prog:C' }],
        [{ text: '🏋️ [D] 3D-Дельты + Руки (Суперсеты)', callback_data: 'prog:D' }],
        [{ text: '📅 Вернуться к расписанию', callback_data: `day:${getTodayDay().id}` }]
      ];

      if (messageId) {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      } else {
        await bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
    }

    // Send Week / Days Menu
    async function sendDaysMenu(chatId, messageId = null) {
      const keyboard = [];
      scheduleData.weeks.forEach(w => {
        const row = [];
        w.days.forEach(d => {
          const shortName = d.name.substring(0, 2);
          const hasGym = d.badges && d.badges.some(b => b.includes('Зал'));
          const emoji = hasGym ? '🏋️' : '▫️';
          row.push({ text: `${emoji}${shortName}`, callback_data: `day:${d.id}` });
        });
        keyboard.push(row);
      });

      keyboard.push([{ text: '📅 Перейти к Сегодня', callback_data: `day:${getTodayDay().id}` }]);

      const text = `🗓️ *Выберите любой день месяца:*\n\n` +
        `• 🏋️ — дни тренировок в зале\n` +
        `• ▫️ — обычные дни учебы и отдыха\n` +
        `_Каждая строка — отдельная неделя (1–4):_`;

      if (messageId) {
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      } else {
        await bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        });
      }
    }

    // Callback Query Handler (Inline Buttons)
    bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;
      const data = query.data;

      try {
        if (data.startsWith('toggle:')) {
          const parts = data.split(':');
          const taskId = parts[1];
          const dayId = parts[2] || getTodayDay().id;

          const current = !!state.tasksDone[taskId];
          state.tasksDone[taskId] = !current;
          saveState();

          const day = getDayById(dayId);
          const targetTask = day.tasks.find(t => t.id === taskId);
          const feedback = !current 
            ? `✅ Выполнено: "${targetTask ? targetTask.title : 'Дело'}"` 
            : `▫️ Снята отметка: "${targetTask ? targetTask.title : 'Дело'}"`;

          await bot.answerCallbackQuery(query.id, { text: feedback, show_alert: false });

          await bot.editMessageText(formatDayMessage(day), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: formatDayKeyboard(day)
          });
        } 
        else if (data.startsWith('groc:')) {
          const sub = data.replace('groc:', '');
          if (sub === 'reset') {
            state.groceries = {};
            saveState();
            await bot.answerCallbackQuery(query.id, { text: '🔄 Список покупок сброшен!' });
          } else {
            const current = !!state.groceries[sub];
            state.groceries[sub] = !current;
            saveState();
            await bot.answerCallbackQuery(query.id, { text: !current ? '✅ Положено в корзину!' : '▫️ Убрано из корзины' });
          }
          const { text, keyboard } = formatGroceries();
          await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
        else if (data === 'weights:history') {
          await bot.answerCallbackQuery(query.id);
          await sendWeightHistory(chatId, messageId);
        }
        else if (data.startsWith('log:prompt:')) {
          const parts = data.split(':');
          const dayId = parts[2];
          const wKey = parts[3] || 'A';
          userStates[chatId] = { action: 'awaiting_log', wKey, dayId };

          await bot.answerCallbackQuery(query.id);
          await bot.sendMessage(chatId, `📝 *Запись рабочих весов для Тренировки ${wKey}*\n\nОтправьте сообщением ваши результаты (например: \`Жим гантелей 34 кг × 10, подтягивания +12.5 кг × 8\`):`, {
            parse_mode: 'Markdown'
          });
        }
        else if (data.startsWith('day:')) {
          const dayId = data.replace('day:', '');
          const day = getDayById(dayId);

          await bot.answerCallbackQuery(query.id);
          await bot.editMessageText(formatDayMessage(day), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: formatDayKeyboard(day)
          });
        }
        else if (data.startsWith('refresh:')) {
          const dayId = data.replace('refresh:', '');
          const day = getDayById(dayId);

          await bot.answerCallbackQuery(query.id, { text: '🔄 Данные обновлены!' });
          await bot.editMessageText(formatDayMessage(day), {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: formatDayKeyboard(day)
          });
        }
        else if (data === 'menu:days') {
          await bot.answerCallbackQuery(query.id);
          await sendDaysMenu(chatId, messageId);
        }
        else if (data === 'workouts:all') {
          await bot.answerCallbackQuery(query.id);
          await sendWorkoutsMenu(chatId, messageId);
        }
        else if (data.startsWith('prog:')) {
          const progKey = data.replace('prog:', '');
          const prog = WORKOUT_PROGRAMS[progKey];
          await bot.answerCallbackQuery(query.id);
          if (prog) {
            const pastLogs = state.workoutLogs[progKey] || [];
            const lastLog = pastLogs.length > 0 ? pastLogs[pastLogs.length - 1] : null;

            let text = `*${prog.title}*\n\n${prog.desc}\n\n`;
            if (lastLog) {
              text += `💡 *Прошлый результат (${lastLog.date}):*\n_${lastLog.text}_\n\n🎯 *Цель:* пробуйте +1–2 кг или +1–2 повторения!\n\n`;
            }

            await bot.sendMessage(chatId, text, {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📝 Записать рабочий вес', callback_data: `log:prompt:${getTodayDay().id}:${progKey}` }],
                  [{ text: '🔙 Назад ко всем тренировкам', callback_data: 'workouts:all' }],
                  [{ text: '📅 К сегодняшнему дню', callback_data: `day:${getTodayDay().id}` }]
                ]
              }
            });
          }
        }
        else if (data.startsWith('workout:')) {
          const dayId = data.replace('workout:', '');
          const day = getDayById(dayId);
          const gymTask = day.tasks.find(t => t.cat === 'gym' && (t.title.includes('ТРЕНИРОВКА') || t.title.includes('Зал')) && !t.title.includes('Дорога'));

          await bot.answerCallbackQuery(query.id);
          if (gymTask) {
            const wKey = gymTask.title.includes('[A]') ? 'A' : gymTask.title.includes('[B]') ? 'B' : gymTask.title.includes('[C]') ? 'C' : 'D';
            const pastLogs = state.workoutLogs[wKey] || [];
            const lastLog = pastLogs.length > 0 ? pastLogs[pastLogs.length - 1] : null;

            let desc = `🏋️ *ПОДРОБНЫЙ РАЗБОР ТРЕНИРОВКИ (${day.name}, ${day.date}):*\n\n*${gymTask.title}*\n\n${gymTask.desc}\n\n`;
            if (lastLog) {
              desc += `💡 *Прошлый результат (${lastLog.date}):*\n_${lastLog.text}_\n\n🎯 *Цель:* пробуйте +1–2 кг или +1–2 повторения!\n\n`;
            }
            desc += `💡 *Статус:* ${state.tasksDone[gymTask.id] ? '✅ Выполнено!' : '▫️ Еще не сделано'}`;

            await bot.sendMessage(chatId, desc, {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: state.tasksDone[gymTask.id] ? '✅ Отмечено как выполненное' : '⬜ Отметить тренировку', callback_data: `toggle:${gymTask.id}:${day.id}` }],
                  [{ text: '📝 Записать рабочий вес', callback_data: `log:prompt:${day.id}:${wKey}` }],
                  [{ text: '🔙 Назад к расписанию', callback_data: `day:${day.id}` }],
                  [{ text: '📋 Меню всех тренировок A/B/C/D', callback_data: 'workouts:all' }]
                ]
              }
            });
          }
        }
        else if (data.startsWith('food:')) {
          const dayId = data.replace('food:', '');
          const day = getDayById(dayId);
          await bot.answerCallbackQuery(query.id);

          const foodTasks = day.tasks.filter(t => t.cat === 'food' || (t.desc && t.desc.includes('ккал')));
          let text = `🍳 *Питание на ${day.name} (${day.date}):*\n\n`;
          foodTasks.forEach(ft => {
            text += `• \`${ft.time}\` *${ft.title}*\n_${ft.desc || ''}_\n\n`;
          });

          await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '🔙 Назад к расписанию', callback_data: `day:${day.id}` }]]
            }
          });
        }
      } catch (err) {
        console.error('Error handling callback_query:', err);
        try {
          await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка при обновлении' });
        } catch (_) {}
      }
    });

    
    // Handle /template (Send ready-to-edit classes JSON template)
    bot.onText(/\/template/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const tmplPath = path.join(__dirname, 'КОНСТРУКТОР_РАСПИСАНИЯ.json');
      if (fs.existsSync(tmplPath)) {
        await bot.sendDocument(chatId, tmplPath, {
          caption: '📋 *Универсальный конструктор расписания (КОНСТРУКТОР_РАСПИСАНИЯ.json)*\n\n' +
            '1. Скачайте этот файл на телефон или ПК.\n' +
            '2. В этом файле можно изменить АБСОЛЮТНО ВСЁ: время сна, дни тренировок, любые упражнения (A, B, C, D), дни готовки, приемы у врачей и пары.\n' +
            '3. Отправьте измененный .json файл обратно в этот чат.\n\n' +
            '⚙️ *Бот мгновенно перестроит всю жизнь:* встроит тренировки Вт/Чт/Сб, готовку на 2 дня, сон 23:30–07:30, обеды и ДЗ без использования ИИ!',
          parse_mode: 'Markdown'
        });
      } else {
        await bot.sendMessage(chatId, '⚠️ Файл classes_template.json не найден на сервере.');
      }
    });

    // Handle /export (Send full schedule JSON backup)
    bot.onText(/\/export/, async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      if (fs.existsSync(SCHEDULE_FILE)) {
        await bot.sendDocument(chatId, SCHEDULE_FILE, {
          caption: '💾 *Полный файл расписания на месяц (schedule_data.json)*\n\nВы можете отредактировать любые задачи и отправить файл обратно для обновления базы.',
          parse_mode: 'Markdown'
        });
      }
    });

    // Handle Document upload (.json schedule files) — ZERO AI, PURE DETERMINISTIC BUILDER
    bot.on('document', async (msg) => {
      const chatId = msg.chat.id;
      ensureSubscriber(chatId);
      const doc = msg.document;
      const fileName = doc.file_name || 'file';

      if (!fileName.toLowerCase().endsWith('.json')) {
        await bot.sendMessage(chatId, '⚠️ Пожалуйста, отправьте файл в формате `.json` (например: `classes_template.json` или `schedule_data.json`).', { parse_mode: 'Markdown' });
        return;
      }

      const statusMsg = await bot.sendMessage(chatId, '⏳ _Считываю и проверяю JSON-файл расписания..._', { parse_mode: 'Markdown' });

      try {
        const fileLink = await bot.getFileLink(doc.file_id);
        const res = await fetch(fileLink);
        const fileContent = await res.text();
        const parsedJson = JSON.parse(fileContent);

        // Case 1: Classes template (turnkey algorithmic compilation)
        if (parsedJson.classes || parsedJson.type === 'classes_template') {
          const compiled = compileScheduleFromClasses(parsedJson);
          scheduleData = { weeks: compiled.weeks };
          fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(scheduleData, null, 2), 'utf8');

          state.version = (state.version || 0) + 1;
          state.lastUpdated = Date.now();
          saveState();

          const successText = '✅ *РАСПИСАНИЕ УСПЕШНО ПЕРЕСТРОЕНО! (Без ИИ, чистый алгоритм)*\n\n' +
            '📊 *Параметры сгенерированной сетки:*\n' +
            `• Недель создано: *${compiled.totalWeeks}*\n` +
            `• Всего задач в базе: *${compiled.totalTasks}*\n` +
            '• Дни тренировок: *Вторник, Четверг, Суббота*\n' +
            '• Ротация сплита: *C ➔ D ➔ A ➔ B* (полные программы со всеми упражнениями)\n' +
            '• Батч-кукинг: *Среда, Пятница, Воскресенье (19:00)*\n' +
            '• Режим сна: *23:30 – 07:30 (8 часов)*\n\n' +
            '🚀 Новое расписание уже активно в боте и синхронизировано с сайтом!';

          await bot.editMessageText(successText, {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 Открыть расписание на сегодня', callback_data: `day:${getTodayDay().id}` }],
                [{ text: '🏋️ Посмотреть тренировки', callback_data: 'workouts:all' }]
              ]
            }
          });
        }
        // Case 2: Full Schedule JSON ({ weeks: [...] })
        else if (Array.isArray(parsedJson.weeks)) {
          scheduleData = parsedJson;
          fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(scheduleData, null, 2), 'utf8');

          state.version = (state.version || 0) + 1;
          state.lastUpdated = Date.now();
          saveState();

          let taskCount = 0;
          scheduleData.weeks.forEach(w => w.days.forEach(d => taskCount += (d.tasks || []).length));

          const fullSuccess = '✅ *ПОЛНЫЙ ФАЙЛ РАСПИСАНИЯ ПРИНЯТ И СОХРАНЕН!*\n\n' +
            `• Недель: *${scheduleData.weeks.length}*\n` +
            `• Всего задач: *${taskCount}*\n\n` +
            'Все экраны (бот, сайт, телефон) мгновенно переключились на обновленные данные!';

          await bot.editMessageText(fullSuccess, {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[{ text: '📅 Перейти к Сегодня', callback_data: `day:${getTodayDay().id}` }]]
            }
          });
        }
        else {
          await bot.editMessageText('⚠️ Неизвестная структура JSON. Отправьте шаблон пар `classes_template.json` или полный экспорт `schedule_data.json`. Получить шаблон: команда /template.', {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'Markdown'
          });
        }
      } catch (err) {
        console.error('Error importing JSON schedule:', err);
        await bot.editMessageText(`❌ Ошибка обработки JSON: ${err.message}. Проверьте синтаксис файла.`, {
          chat_id: chatId,
          message_id: statusMsg.message_id
        });
      }
    });

    // --- PUSH-NOTIFICATIONS & TIMERS ---
    setInterval(async () => {
      try {
        if (!state.subscribers || state.subscribers.length === 0) return;
        const mTime = getMoscowTime();
        const dateKey = mTime.dateStr;
        const today = getTodayDay();

        // 1. Утренний брифинг в 07:30
        const morningKey = `${dateKey}_morning`;
        if (mTime.hour === 7 && mTime.minute === 30 && !state.sentReminders[morningKey]) {
          state.sentReminders[morningKey] = true;
          saveState();

          const gymTask = today.tasks.find(t => t.cat === 'gym' && t.title.includes('ТРЕНИРОВКА'));
          const uniTasks = today.tasks.filter(t => t.cat === 'uni' && t.title.includes('пара'));

          let briefing = `☀️ *ДОБРОЕ УТРО! (${today.name}, ${today.date})*\n\n`;
          if (uniTasks.length > 0) {
            briefing += `🎓 *Учеба:* ${uniTasks.length} пары (${uniTasks[0].time.split(' - ')[0]} – ${uniTasks[uniTasks.length - 1].time.split(' - ')[1]}).\n`;
          } else {
            briefing += `🎉 *Учеба:* Пар нет! Свободный день для фокус-блоков ДЗ и отдыха.\n`;
          }

          if (gymTask) {
            briefing += `🏋️ *Зал:* ${gymTask.time.split(' - ')[0]} — *${gymTask.title}*.\n`;
            briefing += `⚠️ *Не забудь:* рюкзак с формой, кроссовками и ланчбокс с обедом!\n\n`;
          } else {
            briefing += `🛋️ *Зал:* День отдыха и восстановления мышц.\n\n`;
          }

          briefing += `⚖️ Не забудь взвеситься натощак и отправить вес: \`/weight 91.2\`\n`;
          briefing += `Продуктивного дня! 👊`;

          for (const sub of state.subscribers) {
            try {
              await bot.sendMessage(sub, briefing, { parse_mode: 'Markdown' });
            } catch (_) {}
          }
        }

        // 2. Напоминание о выезде в университет (за 40 мин до выезда)
        const travelTask = today.tasks.find(t => t.cat === 'uni' && t.title.includes('Дорога в университет'));
        if (travelTask) {
          const departureHour = parseInt(travelTask.time.split(':')[0]);
          const departureMin = parseInt(travelTask.time.split(':')[1]);
          let alertH = departureHour;
          let alertM = departureMin - 40;
          if (alertM < 0) {
            alertH -= 1;
            alertM += 60;
          }

          const travelKey = `${dateKey}_travel`;
          if (mTime.hour === alertH && mTime.minute === alertM && !state.sentReminders[travelKey]) {
            state.sentReminders[travelKey] = true;
            saveState();

            const travelMsg = `🚌 *ПОРА ВЫДВИГАТЬСЯ В УНИВЕРСИТЕТ! (Выезд в ${travelTask.time.split(' - ')[0]})*\n\n` +
              `Через 40 минут пора выходить. Проверьте:\n` +
              `• Контейнер с обедом\n` +
              `• Спортивную форму и обувь в зал\n` +
              `• Воду и пропуск`;

            for (const sub of state.subscribers) {
              try {
                await bot.sendMessage(sub, travelMsg, { parse_mode: 'Markdown' });
              } catch (_) {}
            }
          }
        }

        // 3. Напоминание о батч-кукинге в 19:00 (Ср / Пт / Вс)
        const isCookDay = today.id.includes('d3') || today.id.includes('d5') || today.id.includes('d7');
        const cookKey = `${dateKey}_cook`;
        if (isCookDay && mTime.hour === 19 && mTime.minute === 0 && !state.sentReminders[cookKey]) {
          state.sentReminders[cookKey] = true;
          saveState();

          const cookMsg = `🥘 *ВЕЧЕР БАТЧ-КУКИНГА (готовка на 2 дня за 20 минут)!*\n\n` +
            `Пора поставить рис/гречку в мультиварку и филе со сковороды в томатах.\n` +
            `Разложите по 2 лоткам — и следующие 2 дня кухня полностью свободна!`;

          for (const sub of state.subscribers) {
            try {
              await bot.sendMessage(sub, cookMsg, { parse_mode: 'Markdown' });
            } catch (_) {}
          }
        }

        // 4. Вечерний сигнал ко сну в 23:00 (каждый день)
        const sleepKey = `${dateKey}_sleep`;
        if (mTime.hour === 23 && mTime.minute === 0 && !state.sentReminders[sleepKey]) {
          state.sentReminders[sleepKey] = true;
          saveState();

          const sleepMsg = `😴 *30 МИНУТ ДО ОТБОЯ (Сон строго в 23:30)!*\n\n` +
            `Время убрать смартфон, выключить яркий свет, принять душ и проветрить комнату.\n` +
            `8 часов глубокого сна — ключевой фактор рельефа и выработки гормона роста! 🛌`;

          for (const sub of state.subscribers) {
            try {
              await bot.sendMessage(sub, sleepMsg, { parse_mode: 'Markdown' });
            } catch (_) {}
          }
        }

      } catch (cronErr) {
        console.error('Timer error:', cronErr);
      }
    }, 30000);

  } catch (botErr) {
    console.error('Ошибка инициализации Telegram-бота:', botErr.message);
  }
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN не указан в файле .env.');
  console.log('💡 Сервер работает в режиме веб-интерфейса. Чтобы включить Telegram-бота, укажите токен в .env.');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nОстановка сервера...');
  if (bot) bot.stopPolling();
  server.close(() => process.exit(0));
});
