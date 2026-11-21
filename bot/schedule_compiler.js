const fs = require('fs');
const path = require('path');

// Default technical descriptions for workouts
const DEFAULT_WORKOUT_DETAILS = {
  A: {
    key: "A",
    name: "Грудь + Дельты + Трицепс",
    title: "🏋️ ТРЕНИРОВКА A: Грудь (сила + памп) + Дельты + Трицепс",
    desc: "1. Жим гантелей на наклонной скамье 30° — 4×8–10 (32–36 кг, пауза 1 сек внизу для растяжки).\n2. Жим штанги лежа горизонтально — 3×6–8 (силовая база для плотности).\n3. Сведения Pec-Deck / кроссовер — 3×12–15 + ДРОП-СЕТ в финале (сброс 30% до жжения).\n4. Махи гантелями в стороны стоя — 4×12–15 (локти выше кистей).\n5. Французский жим со штангой лежа (EZ-гриф) — 3×8–10.\n6. Разгибания на блоке с канатом — 3×12–15 (разведение внизу с паузой 2 сек).\n🔥 Кардио: 15 минут в горку на дорожке (уклон 9–12%, скорость 5.3 км/ч)."
  },
  B: {
    key: "B",
    name: "Спина (Low Row) + Бицепс + Дельты",
    title: "🏋️ ТРЕНИРОВКА B: Спина (ширина + толщина) + Дельты (средняя + задняя) + Бицепс",
    desc: "1. Подтягивания с отягощением на поясе — 4–5 подходов:\n   • 1 подход: собств. вес × 10 (разминка).\n   • 2–4 подходы: с весом (+5…+15 кг) × 6–8 (максимальная ширина спины).\n   • 5 подход: собств. вес до отказа (сброс веса).\n2. Рычажная тяга с упором в грудь (Technogym Pure Strength Low Row) — 4×8–12:\n   • Упор в грудь снимает осевую нагрузку с поясницы, изолируя широчайшие.\n   • Вертикальный хват (локти вдоль ребер): бьет в низ/середину широчайших (V-конус к талии).\n   • Горизонтальный хват (локти под 45°): середина спины, ромбовидные и подостная мышца.\n   • В последнем подходе: уницикл поочередно одной рукой с фиксацией 1 сек за спиной!\n3. Горизонтальная тяга блока к поясу сидя (нейтральный/V-хват) — 3–4×10–12:\n   • Непрерывное натяжение троса. В растяжке подать плечи вперед, при тяге мощно свести лопатки.\n4. Махи гантелями в стороны (средняя дельта — специализация) — 4×12–15:\n   • Дроп-сет в финале: рабочий вес × 12, сброс 35% и сразу еще 8–10 без отдыха.\n5. Махи на заднюю дельту в кроссовере / обратный Pec-Deck — 3–4×12–15.\n   • Лайфхак: упр. 4 и 5 можно делать суперсетом для сумасшедшего 3D-пампа!\n6. Подъем штанги на бицепс стоя — 4×8–10:\n   • Строгая негативная фаза: медленный спуск 3 секунды вниз!\n7. Молотковые сгибания на скамье Скотта / стоя — 3×10–12 (брахиалис и пик).\n🔥 Кардио: 15 минут ходьбы в горку (уклон 10–12%, скорость 5.3 км/ч)."
  },
  C: {
    key: "C",
    name: "Ноги (тяжелая база) + Пресс",
    title: "🏋️ ТРЕНИРОВКА C: Ноги (мощный жиросжигающий стимул) + Пресс",
    desc: "1. Приседания со штангой на спине — 4×8–10 (или жим ногами в тренажере 4×10–12 с хорошей глубиной).\n2. Болгарские сплит-приседания с гантелями (нога на скамье) — 4×10–12 на каждую ногу (наклон корпуса вперед 15–20° для взрывного включения ягодичных и бицепса бедра).\n3. Сгибания ног в тренажере лежа/сидя — 4×12–15 (доработка бицепса бедра).\n4. Разгибания ног в тренажере сидя — 3×12–15 (пампинг капель квадрицепса).\n5. Подъем на носки стоя (икры) — 4×15–20 с 2-секундной растяжкой внизу.\n6. Подъем прямых ног в висе на перекладине — 4×12–15.\n7. «Молитва» (скручивания на блоке на коленях с канатом) — 3×15.\n🔥 Кардио: 15 минут ходьбы в горку (уклон 10–12%, скорость 5.0–5.2 км/ч)."
  },
  D: {
    key: "D",
    name: "3D-Дельты + Руки (Суперсеты)",
    title: "🏋️ ТРЕНИРОВКА D: 3D-Дельты (Ширина силуэта) + Руки (Суперсеты на рельеф)",
    desc: "1. Армейский жим штанги стоя (или жим гантелей сидя) — 4×6–8 (тяжелая база).\n2. Тяга штанги к подбородку широким хватом — 3×10–12 (средние дельты).\n3. Гигантский сет на дельты (3 круга без отдыха):\n   • Махи гантелями в стороны — 12 повт.\n   • Махи гантелями перед собой — 12 повт.\n   • Махи в наклоне на заднюю дельту — 12 повт.\n4. Суперсет 1 на руки (3 подхода):\n   • Сгибания с гантелями с супинацией на наклонной скамье — 3×10–12.\n   • Отжимания на брусьях с весом на поясе — 3×8–10.\n5. Суперсет 2 на памп и венозность (3 подхода):\n   • Сгибания на бицепс в кроссовере с нижнего блока — 3×12–15.\n   • Разгибания на трицепс из-за головы с канатом — 3×12–15.\n🔥 Кардио: 15 минут в горку на дорожке (уклон 9–12%, скорость 5.3 км/ч)."
  }
};

const DAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

/**
 * Universal Turnkey Schedule Compiler (Zero AI, deterministic, instant).
 * Customizes ANY aspect of the schedule:
 * - Sleep schedule (wakeup, bedtime)
 * - Gym days, training times, exercises and workouts (A, B, C, D or custom)
 * - Cooking days, meals and diet recipes
 * - Study and homework focus blocks
 * - Fixed events (doctor visits, deadlines, appointments)
 * - University classes (odd / even cycle)
 */
function compileScheduleFromClasses(config) {
  const weeksCount = config.weeksCount || 4;
  const startYear = config.startYear || 2026;
  const startMonth = config.startMonth || 11; // 1-12
  const startDay = config.startDay || 23; // default 23 Nov 2026

  // 1. Sleep customization
  const sleepCfg = config.sleep || {};
  const weekdayWakeup = sleepCfg.weekdayWakeup || "07:30";
  const weekendWakeup = sleepCfg.weekendWakeup || "08:30";
  const bedtime = sleepCfg.bedtime || "23:30";

  // 2. Gym & Workouts customization
  const gymCfg = config.gym || {};
  const gymDays = gymCfg.days || config.gymDays || ["Вторник", "Четверг", "Суббота"];
  const rotation = gymCfg.rotation || config.workoutRotation || ["C", "D", "A", "B"];
  let rotationIdx = (gymCfg.startWorkout || config.startWorkout) ? rotation.indexOf(gymCfg.startWorkout || config.startWorkout) : 0;
  if (rotationIdx === -1) rotationIdx = 0;

  // Merge custom workout descriptions if user defined them
  const workoutDetails = { ...DEFAULT_WORKOUT_DETAILS };
  if (config.workouts) {
    for (const k in config.workouts) {
      if (workoutDetails[k]) {
        workoutDetails[k] = { ...workoutDetails[k], ...config.workouts[k] };
      } else {
        workoutDetails[k] = { key: k, title: config.workouts[k].title || `Тренировка ${k}`, desc: config.workouts[k].desc || "" };
      }
    }
  }

  // 3. Nutrition & Batch cooking customization
  const cookCfg = config.cooking || {};
  const cookDays = cookCfg.days || config.cookDays || ["Среда", "Пятница", "Воскресенье"];
  const cookTime = cookCfg.time || "19:00 - 19:30";
  const cookDesc = cookCfg.desc || "Варим рис/гречку в мультиварке + филе со сковороды в томатах. Раскладываем по 2 лоткам — кухня свободна на 2 дня!";

  // 4. Fixed Events (Doctors, exams, appointments)
  const fixedEvents = config.fixedEvents || config.events || [];

  // 5. Classes
  const classes = config.classes || {};
  const oddClasses = classes.odd || classes["нечетная"] || classes["week1"] || {};
  const evenClasses = classes.even || classes["четная"] || classes["week2"] || {};

  const monthNamesRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  let currDate = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
  const generatedWeeks = [];

  for (let w = 1; w <= weeksCount; w++) {
    const isOdd = w % 2 === 1;
    const weekClasses = isOdd ? oddClasses : evenClasses;

    const weekStartDate = new Date(currDate);
    const weekEndDate = new Date(currDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    const startMonthStr = monthNamesRu[weekStartDate.getMonth()].substring(0, 4);
    const endMonthStr = monthNamesRu[weekEndDate.getMonth()].substring(0, 4);
    const dateRangeStr = startMonthStr === endMonthStr 
      ? `${weekStartDate.getDate()}–${weekEndDate.getDate()} ${startMonthStr}`
      : `${weekStartDate.getDate()} ${startMonthStr} – ${weekEndDate.getDate()} ${endMonthStr}`;

    const days = [];

    for (let d = 0; d < 7; d++) {
      const dayName = DAY_NAMES[d];
      const dayDateStr = `${currDate.getDate()} ${monthNamesRu[currDate.getMonth()]}`;
      const dayId = `w${w}-d${d + 1}`;
      const dayClasses = weekClasses[dayName] || [];

      const isGymDay = gymDays.includes(dayName);
      const isCookDay = cookDays.includes(dayName);
      const isWeekend = d >= 5;

      let workoutForToday = null;
      if (isGymDay) {
        const wKey = rotation[rotationIdx % rotation.length];
        workoutForToday = workoutDetails[wKey] || DEFAULT_WORKOUT_DETAILS[wKey] || DEFAULT_WORKOUT_DETAILS.A;
        rotationIdx++;
      }

      const tasks = [];
      let taskCounter = 1;
      function addTask(time, cat, title, desc = "") {
        tasks.push({
          id: `${dayId}-${taskCounter++}`,
          time,
          cat,
          title,
          desc,
          done: false
        });
      }

      // 1. Sleep & Wakeup
      if (isWeekend) {
        addTask(`${weekendWakeup} - 09:00`, "sleep", "Подъем без будильника, стакан воды", "Хороший отдых, настрой на день.");
      } else if (dayClasses.length > 0 && dayClasses[0].time && dayClasses[0].time.startsWith("10:00")) {
        addTask("07:15 - 07:45", "sleep", "Подъем, стакан воды, сбор вещей", "Зарядка, проверка формы и ланчбокса.");
      } else {
        addTask(`${weekdayWakeup} - 08:00`, "sleep", "Подъем, стакан воды, разминка", "Бодрое утро, стакан теплой воды натощак.");
      }

      // 2. Tuesday weigh-in
      if (dayName === "Вторник") {
        addTask("07:30 - 07:45", "other", "⚖️ Контрольное взвешивание натощак & Вода", "Зафиксировать вес в трекере для отслеживания динамики сушки.");
      }

      // 3. Breakfast
      if (isGymDay && dayName === "Четверг") {
        addTask("07:45 - 08:20", "food", "Завтрак БЕЗ ЯИЦ: Сырный картофель с курицей", "270 г отварного картофеля + 130 г филе + 35 г сыра подогреть 1.5 мин в СВЧ (530 ккал | Б: 43г).");
      } else if (isWeekend) {
        addTask("09:15 - 10:00", "food", "Завтрак: Сырные макароны с отварными яйцами", "65 г макарон т/с + 2 яйца всмятку + 35 г сыра (520 ккал | Б: 33г).");
      } else {
        addTask("08:00 - 08:35", "food", "Завтрак: Сырные макароны с отварными яйцами", "65 г макарон т/с + 2 яйца + 35 г сыра (520 ккал | Б: 33г).");
      }

      // 4. Sunday Laundry & Weekly clean
      if (dayName === "Воскресенье") {
        addTask("10:30 - 12:00", "chores", "🧺 ЕЖЕНЕДЕЛЬНАЯ ПОСТИРКА & ПОРЯДОК", "Стирка формы, влажная уборка, порядок на рабочем месте.");
        addTask("12:30 - 14:00", "chores", "🛒 Закупка продуктов на неделю", "Куриное филе, крупы, творог 5%, яйца, овощи по списку в боте.");
      }

      // 5. University commute & classes
      if (dayClasses.length > 0) {
        const firstTime = dayClasses[0].time || "10:00 - 11:40";
        const startH = parseInt(firstTime.split(":")[0]);

        if (startH === 10) {
          addTask("09:00 - 09:50", "uni", "Дорога в университет с рюкзаком", "Едем на пары.");
        } else if (startH === 12) {
          addTask("09:00 - 10:45", "free", "🛋️ Утренний отдых & Сбор рюкзака (форма в зал + ланчбокс)", "Подготовка к учебному и тренировочному дню.");
          addTask("11:15 - 12:00", "uni", "Дорога в университет (ГК-2)", "Едем на занятия.");
        }

        dayClasses.forEach((cls, idx) => {
          addTask(cls.time, "uni", cls.title, cls.desc || cls.room ? `Ауд. ${cls.room}` : "Учебная пара.");
          if (cls.time.includes("13:40") && idx < dayClasses.length - 1) {
            addTask("13:40 - 14:00", "food", "🍱 Обед из ланчбокса в университете", "Куриное филе с рисом в томатном соусе + свежий огурец (540 ккал | Б: 45г).");
          }
        });
      } else if (!isWeekend && dayName === "Понедельник") {
        addTask("09:30 - 12:30", "study", "📚 Фокус-сессия: Масштабное учебное задание (3 часа)", "Спокойная глубокая работа над курсовыми и проектами без спешки.");
        addTask("13:00 - 13:45", "food", "🍱 Обед из заготовки (разогреть 2 мин)", "Куриное филе с рисом басмати и томатами (540 ккал | Б: 45г).");
        addTask("14:00 - 17:00", "free", "🛋️ СВОБОДНОЕ ВРЕМЯ & РЕЛАКС (3 часа)", "Отдых без чувства вины: игры, фильмы, хобби.");
        addTask("17:30 - 18:00", "food", "Полдник: Творог 5% с ягодами и кефиром", "200 г творога + 50 г ягод + 150 мл кефира (320 ккал).");
        addTask("18:30 - 20:00", "other", "🚶 Прогулка на воздухе (добор 8 000 – 10 000 шагов)", "Фоновое жиросжигание и свежий воздух.");
        addTask("20:30 - 21:15", "food", "Ужин: Куриное филе с сырной гречкой", "Вкусный ужин из готового контейнера (490 ккал | Б: 50г).");
      }

      // 6. Fixed Events check (e.g. Doctors, Appointments)
      fixedEvents.forEach(fe => {
        // match date or dayName
        const matchesDate = fe.date && (fe.date === dayDateStr || fe.date === `${currDate.getFullYear()}-${String(currDate.getMonth()+1).padStart(2, '0')}-${String(currDate.getDate()).padStart(2, '0')}`);
        const matchesDay = fe.dayName && fe.dayName.toLowerCase() === dayName.toLowerCase() && fe.weekNumber === w;
        if (matchesDate || matchesDay) {
          addTask(fe.time || "17:00", fe.cat || "med", fe.title, fe.desc || "");
        }
      });

      // 7. Gym Workouts
      if (isGymDay && workoutForToday) {
        if (dayName === "Вторник") {
          addTask("17:40 - 18:15", "gym", "🚌 Дорога из университета в тренажерный зал (~35 мин)", "Переезд на вечернюю тренировку.");
          addTask("18:15 - 18:30", "food", "🍌 Легкий углеводный перекус перед залом", "Банан или творожок для энергии на силовой.");
          addTask("18:30 - 20:30", "gym", workoutForToday.title, workoutForToday.desc);
          addTask("20:30 - 21:15", "other", "🚌 Дорога домой после зала & Горячий душ", "Возвращение домой.");
          addTask("21:15 - 22:00", "food", "🍳 Ужин: готовое куриное филе со сковороды с гречкой/рисом", "Разогреть 2 мин из готовой заготовки (490 ккал | Б: 50г).");
        } else if (dayName === "Четверг") {
          if (dayClasses.length <= 1) {
            addTask("12:15 - 13:00", "food", "Обед дома из вчерашней заготовки", "Паста с курицей и овощами (540 ккал).");
            addTask("13:00 - 14:15", "free", "🛋️ Свободное время перед залом (1 час отдыха)", "Релакс перед силовой.");
            addTask("14:30 - 16:30", "gym", workoutForToday.title, workoutForToday.desc);
            addTask("17:00 - 17:30", "food", "Полдник: Творожный крем с ягодами", "410 ккал.");
            addTask("18:00 - 20:00", "study", "📚 Фокус-сессия: Масштабное учебное задание (2 часа)", "Работа над проектами.");
            addTask("20:30 - 21:15", "food", "Ужин: Куриное филе с гречкой (из готового лотка)", "490 ккал.");
          } else {
            addTask("17:40 - 18:15", "gym", "🚌 Дорога в тренажерный зал", "Выезд на тренировку.");
            addTask("18:15 - 18:30", "food", "🍌 Перекус перед залом (банан)", "Быстрые углеводы.");
            addTask("18:30 - 20:30", "gym", workoutForToday.title, workoutForToday.desc);
            addTask("20:30 - 21:15", "other", "Дорога домой & Душ", "Отдых после зала.");
            addTask("21:15 - 22:00", "food", "Ужин: куриное филе с гречкой/рисом", "490 ккал.");
          }
        } else if (dayName === "Суббота") {
          addTask("11:30 - 13:30", "gym", workoutForToday.title, workoutForToday.desc);
          addTask("14:00 - 14:45", "food", "🍱 Обед из заготовки (разогреть 2 мин)", "Курица с рисом + овощи (540 ккал).");
          addTask("15:00 - 17:30", "free", "🛋️ СВОБОДНОЕ ВРЕМЯ / ВОССТАНОВЛЕНИЕ (2.5 часа отдыха)", "Релакс, фильмы, хобби.");
          addTask("17:30 - 18:00", "food", "Полдник: Творожный крем с ягодами", "350 ккал.");
          addTask("18:00 - 20:00", "study", "📚 Фокус-сессия: Масштабное учебное задание (2 часа)", "Закрытие заданий на неделю.");
          addTask("20:30 - 21:15", "food", "Ужин из готового лотка: сырная гречка с филе", "490 ккал.");
        }
      }

      // 8. Batch cooking reminder
      if (isCookDay && !tasks.some(t => t.title.includes("БАТЧ-КУКИНГ"))) {
        addTask(cookTime, "food", "🥘 БАТЧ-КУКИНГ (готовка на 2 дня за 20 минут)", cookDesc);
      }

      // 9. Evening free time & sleep
      if (!tasks.some(t => t.title.includes("Свободное время") && t.time.includes("22:"))) {
        addTask("22:00 - 23:00", "free", "🛋️ Свободное время перед сном", "Отдых, сериалы, расслабление.");
      }
      addTask(`23:00 - ${bedtime}`, "sleep", `Сон: отбой в ${bedtime} (8 часов сна)`, "Глубокое восстановление нервной системы и мышц.");

      // Build Badges
      const badges = [];
      if (isGymDay && workoutForToday) {
        badges.push(`🏋️ Зал: Тренировка ${workoutForToday.key}`);
      }
      if (dayClasses.length > 0) {
        badges.push(`🎓 Пары (${dayClasses.length})`);
      } else {
        badges.push("🎉 Пар нет");
      }
      if (isCookDay) {
        badges.push("🥘 Готовка на 2 дня");
      }

      days.push({
        id: dayId,
        name: dayName,
        date: dayDateStr,
        badges: badges,
        tasks: tasks
      });

      currDate.setDate(currDate.getDate() + 1);
    }

    generatedWeeks.push({
      weekNumber: w,
      dateRange: dateRangeStr,
      title: `${w}-я неделя (${dateRangeStr})`,
      subtitle: `Зал: ${gymDays.join(', ')} • Готовка на 2 дня • Фокус-блоки ДЗ • Сон в ${bedtime}`,
      days: days
    });
  }

  return {
    weeks: generatedWeeks,
    totalWeeks: weeksCount,
    totalTasks: generatedWeeks.reduce((acc, w) => acc + w.days.reduce((a, d) => a + d.tasks.length, 0), 0)
  };
}

module.exports = {
  compileScheduleFromClasses,
  DEFAULT_WORKOUT_DETAILS,
  DAY_NAMES
};
