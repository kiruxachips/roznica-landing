"use client"

import { useState } from "react"
import { X } from "lucide-react"

interface BrewingMethod {
  id: string
  name: string
  icon: string
  grind: string
  ratio: string
  temp: string
  time: string
  content: string[]
}

const methods: BrewingMethod[] = [
  {
    id: "turka",
    name: "Турка",
    icon: "☕",
    grind: "Пыль (очень мелкий)",
    ratio: "15 г / 200 мл",
    temp: "Мин. нагрев",
    time: "~5 мин",
    content: [
      "Используйте кофе средней обжарки — тёмная даст жжёный вкус, светлая — чрезмерную кислотность. Помол — мелкий «в пыль». Молоть лучше прямо перед приготовлением.",
      "Пропорции: 15 г кофе на 200 мл воды (воды наливайте на 50 мл меньше объёма турки). Вода — холодная фильтрованная, без хлора, pH 6,7–7,0.",
      "Засыпьте кофе в турку, по желанию добавьте специи и сахар. Залейте холодной водой до сужения горлышка. Не размешивайте сразу — подождите минуту.",
      "Поставьте на минимальный огонь. Когда пенка (крема) начнёт подниматься — сразу снимайте с плиты. Не доводите до кипения.",
      "Перелейте в предварительно прогретую чашку и дайте настояться 2 минуты. Рекомендуем медные турки с посеребрением — они дают равномерный нагрев.",
    ],
  },
  {
    id: "french-press",
    name: "Френч-пресс",
    icon: "🫖",
    grind: "Крупный (морская соль)",
    ratio: "21 г / 350 мл",
    temp: "95°C",
    time: "5–8 мин",
    content: [
      "Помол — крупный, размером с сахарный песок или морскую соль. Пропорция: 60 г кофе на 1 литр воды, то есть 21 г на стандартный френч-пресс 350 мл.",
      "Вода — фильтрованная, подогретая до 95°C. Если нет термометра: вскипятите чайник, откройте крышку и подождите минуту.",
      "Ополосните френч-пресс горячей водой, чтобы стенки прогрелись. Слейте воду, засыпьте молотый кофе.",
      "Залейте водой, слегка размешайте. Не опуская поршень, оставьте завариваться на 5–8 минут в зависимости от вкусовых предпочтений.",
      "Плавно опустите поршень. Сразу разлейте кофе по чашкам — если оставить во френч-прессе, кофе переэкстрагируется и начнёт горчить.",
    ],
  },
  {
    id: "moka",
    name: "Мока",
    icon: "⬡",
    grind: "Средне-мелкий",
    ratio: "До краёв фильтра",
    temp: "На огне",
    time: "3–4 мин",
    content: [
      "Подогрейте воду в чайнике, не доводя до кипения. Холодная вода увеличивает время приготовления и может дать горечь с металлическим привкусом.",
      "Раскрутите моку, залейте горячую воду в нижнюю часть до клапана безопасности (не выше). Засыпьте кофе в фильтр до краёв, не утрамбовывая.",
      "Аккуратно прикрутите верхнюю часть к основанию. Поставьте на средний огонь, закройте крышку.",
      "Через пару минут давление вытолкнет воду через кофе наверх. Откройте крышку — как только струйки посветлеют и станут тонкими, снимите с огня.",
      "Подставьте основание моки под холодную воду на пару секунд — это остановит экстракцию. Перелейте кофе в чашку.",
    ],
  },
  {
    id: "espresso",
    name: "Эспрессо",
    icon: "☕",
    grind: "Мелкий (под машину)",
    ratio: "18 г → 30 г",
    temp: "~93°C",
    time: "25–30 сек",
    content: [
      "Закладка кофе для эспрессо настраивается под каждый сорт индивидуально. Стартовый ориентир: 18 г молотого кофе → 30 г эспрессо за 28 секунд.",
      "Если напиток льётся слишком быстро и вкус водянистый — помол слишком крупный, сделайте мельче. Если еле капает и горчит — помол слишком мелкий.",
      "Перед закладкой кофе протрите корзину портафильтра насухо. Распределите кофе равномерно и темперуйте с постоянным давлением.",
      "Первые капли должны появиться через 3–5 секунд после старта. Хороший эспрессо имеет плотную рыжую крему и сладковатое послевкусие.",
      "Экспериментируйте с дозировкой и помолом — даже небольшие изменения заметно меняют вкус. Каждый сорт Millor раскрывается в эспрессо по-своему.",
    ],
  },
  {
    id: "pourover",
    name: "Воронка",
    icon: "△",
    grind: "Средне-крупный",
    ratio: "27 г / 500 мл",
    temp: "92–95°C",
    time: "3–5 мин",
    content: [
      "Помол — средне-крупный, чуть крупнее сахара. Без весов: в столовой ложке «с горкой» примерно 9 г кофе. На 500 мл нужно 3 ложки.",
      "Установите фильтр в воронку, пролейте горячей водой (прогреть + убрать привкус бумаги). Слейте воду из сервера.",
      "Засыпьте кофе, выровняйте поверхность. Круговым движением залейте 50 мл воды — это блуминг. Подождите 30 секунд, пока кофе «дышит».",
      "Долейте ещё 150 мл воды, снова пауза 30 секунд. Затем влейте оставшиеся 300 мл плавной тонкой струёй по кругу.",
      "Дождитесь пока вся вода пройдёт через кофе. Снимите воронку, взболтайте сервер для равномерного вкуса. Разлейте и наслаждайтесь.",
    ],
  },
  {
    id: "aeropress",
    name: "Аэропресс",
    icon: "⇩",
    grind: "Средний",
    ratio: "18 г / 180 мл",
    temp: "90°C",
    time: "~2 мин",
    content: [
      "Помол — средний, как для пуровера. Закладка: 18 г кофе на 180 мл воды. Температура — 90°C (вскипятить, остудить 1,5 минуты с открытой крышкой).",
      "Пролейте горячую воду через бумажный фильтр, чтобы убрать привкус бумаги. Засыпьте молотый кофе в аэропресс.",
      "Залейте 50–60 мл воды, подождите 30 секунд (блуминг). Долейте оставшиеся 120–130 мл. Установите поршень сверху и слегка потяните вверх, чтобы создать вакуум.",
      "Оставьте на 40 секунд. Снимите поршень, перемешайте кофе, установите обратно.",
      "Плавно давите поршень вниз 20–30 секунд с постоянным усилием. Не продавливайте до конца — это добавит горечи в напиток.",
    ],
  },
  {
    id: "cup",
    name: "Чашка",
    icon: "☕",
    grind: "Средний",
    ratio: "12 г / 200 мл",
    temp: "93–95°C",
    time: "4–5 мин",
    content: [
      "Самый простой способ — кружка всегда под рукой. Выбирайте чашку с толстыми стенками (дольше сохранит тепло) и достаточно высокую.",
      "Помол — средний, из свежеобжаренного зерна. Пропорции: 12 г на 200 мл, или 3 чайных ложки с горкой. Вода — бутилированная, pH около 7, температура 93–95°C.",
      "Засыпьте кофе в чашку (можно предварительно прогреть её). Залейте непрерывной струёй, перемешайте и оставьте на 4–5 минут.",
      "Через 4 минуты активно перемешайте. Подождите, пока частицы осядут на дно. Уберите крупные частицы, всплывшие на поверхность.",
      "Пейте сразу — если кофе долго стоит, экстракция продолжается и появляется горечь. Сахар или корицу лучше добавлять на 4-й минуте заваривания.",
    ],
  },
  {
    id: "auto",
    name: "Автомат",
    icon: "⚙",
    grind: "Под машину",
    ratio: "По инструкции",
    temp: "По машине",
    time: "По машине",
    content: [
      "Вкус кофе из автоматической кофемашины зависит от модели и настроек. Главное — подобрать правильный помол под вашу машину.",
      "Слишком мелкий помол — кофе будет горьким и с пережжённым привкусом. Слишком крупный — водянистый и безвкусный. Начните со среднего и корректируйте.",
      "Используйте свежеобжаренный кофе (не старше 4 недель) и фильтрованную воду. Регулярно чистите кофемашину от масел и накипи.",
      "Если машина позволяет настроить температуру — установите 92–95°C. Если есть регулировка крепости — экспериментируйте, каждый сорт раскрывается по-разному.",
      "Попробуйте разные сорта Millor в вашей машине — даже одна и та же кофемашина даёт совершенно разный результат с разным зерном.",
    ],
  },
]

function GuideModal({ method, onClose }: { method: BrewingMethod; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-border/50 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-bold">{method.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick params */}
        <div className="px-6 py-4 grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Помол</p>
            <p className="text-sm font-medium mt-0.5">{method.grind}</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Пропорции</p>
            <p className="text-sm font-medium mt-0.5">{method.ratio}</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Температура</p>
            <p className="text-sm font-medium mt-0.5">{method.temp}</p>
          </div>
          <div className="bg-secondary/50 rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Время</p>
            <p className="text-sm font-medium mt-0.5">{method.time}</p>
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 pb-6 space-y-3">
          {method.content.map((step, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BrewingGuides() {
  const [activeMethod, setActiveMethod] = useState<BrewingMethod | null>(null)

  return (
    <>
      <section className="py-10 sm:py-12 bg-secondary/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-center mb-8">
            Приготовление кофе разными способами
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4 max-w-3xl mx-auto">
            {methods.map((method) => (
              <button
                key={method.id}
                onClick={() => setActiveMethod(method)}
                className="group flex flex-col items-center gap-2 p-3 sm:p-4 rounded-2xl bg-white border border-border/50 hover:border-primary/30 hover:shadow-md transition-all"
              >
                <span className="text-2xl sm:text-3xl">{method.icon}</span>
                <span className="text-[11px] sm:text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">
                  {method.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeMethod && (
        <GuideModal method={activeMethod} onClose={() => setActiveMethod(null)} />
      )}
    </>
  )
}
