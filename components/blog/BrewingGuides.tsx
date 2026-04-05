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
    ratio: "15–20 г / 200 мл",
    temp: "Мин. нагрев",
    time: "До подъёма пенки + 2 мин",
    content: [
      "Для турки лучше всего подходит кофе средней обжарки. Тёмная обжарка придаст жжёный вкус, светлая — чрезмерную кислотность.",
      "Помол: мелкий, «в пыль». Чем мельче помол — тем сильнее экстракция. Лучше молоть свежеобжаренный кофе непосредственно перед приготовлением.",
      "Пропорции: для турки 200 мл — 15 г кофе. Воды лучше наливать на 50 мл меньше объёма турки. Рекомендуемая пропорция: 1:10.",
      "Вода: холодная фильтрованная, без хлора и щёлочи. Оптимальная кислотность 6,7–7,0 pH.",
      "Засыпаем молотый кофе в турку, при необходимости добавляем специи и сахар, заливаем холодную воду до момента сужения горлышка. Не размешиваем сразу — через минуту после начала заваривания. Температура плиты минимальна. Когда пенка начнёт подниматься — сразу снять с плиты. Перелить в прогретую чашку, дать настояться 2 минуты.",
    ],
  },
  {
    id: "french-press",
    name: "Френч-пресс",
    icon: "🫖",
    grind: "Крупный (морская соль)",
    ratio: "60 г / 1 л (21 г / 350 мл)",
    temp: "95°C",
    time: "5–8 мин",
    content: [
      "Помол: крупный, размером с сахарный песок или крупную морскую соль.",
      "Пропорции: 60 г зерна на 1 литр воды. На стандартный френч-пресс 350 мл — 21 г кофе.",
      "Температура воды: фильтрованная вода с минерализацией 50–150 г/л, подогретая до 95°C. Альтернатива: вскипятить чайник, открыть крышку, дать постоять около минуты.",
      "Ополоснуть френч-пресс горячей водой (чтобы температура не понизилась). Засыпать молотый кофе, залить водой. Слегка размешать, не опуская поршень, оставить на 5–8 мин.",
      "Плавно опустить поршень, сразу налить кофе в чашки, чтобы кофе не переэкстрагировался.",
    ],
  },
  {
    id: "moka",
    name: "Мока",
    icon: "⬡",
    grind: "Средний",
    ratio: "До краёв фильтра",
    temp: "На огне",
    time: "~2 мин",
    content: [
      "Подогреть воду в чайнике, не доводя до кипения. Холодная вода увеличивает время приготовления и даёт горечь и металлический привкус.",
      "Раскрутить моку, залить горячую воду в основание до клапана безопасности (не выше). Засыпать кофе в фильтр до краёв. Аккуратно прикрутить основание к верхней части.",
      "Поставить на огонь, закрыть крышку. Через пару минут давление вытеснит воду в верхнюю часть.",
      "Открыть крышку. Как только струйки кофе посветлеют и станут тонкими — снять с плиты и подставить основание под струю холодной воды, чтобы прервать экстракцию. Перелить кофе в чашку.",
    ],
  },
  {
    id: "espresso",
    name: "Эспрессо",
    icon: "☕",
    grind: "Мелкий (под машину)",
    ratio: "18 г → 30 г эспрессо",
    temp: "~93°C",
    time: "28 сек",
    content: [
      "Всё зависит от напитка, который вы хотите приготовить. Закладка кофе для эспрессо настраивается под каждый сорт отдельно.",
      "Ориентир: из 18 грамм кофе приготовить 30 грамм эспрессо за время 28 секунд.",
      "Если напиток льётся слишком быстро — помол слишком крупный. Если слишком медленно — помол слишком мелкий. Регулируйте помол пока не найдёте баланс вкуса.",
    ],
  },
  {
    id: "pourover",
    name: "Воронка",
    icon: "△",
    grind: "Крупный (морская соль)",
    ratio: "27 г / 500 мл",
    temp: "92–95°C",
    time: "3–5 мин",
    content: [
      "Оборудование: воронка, фильтр, кофемолка, 27 г кофе, вода 92–95°C.",
      "Помол: крупный, больше сахара. Без весов: в столовой ложке «с горкой» примерно 9 г кофе. Для 500 мл — 3 столовые ложки.",
      "Поставить воронку на сервер, установить фильтр, смочить горячей водой (прогреть), слить воду.",
      "Засыпать кофе, равномерно распределить. Круговыми движениями залить 50 мл воды, ждать 30 секунд (блуминг).",
      "Долить 150 мл, пауза 30 секунд. Долить оставшиеся 300 мл. Ожидать пока последние капли пройдут. Убрать фильтр, взболтать сервер, налить в чашку.",
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
      "Помол: средний. Оптимальная закладка: 18 г кофе. Около 70 г на 1 литр.",
      "Температура воды: 90°C (вскипятить, остудить 1,5 мин с открытой крышкой). Чем темнее обжарка — тем ниже температура.",
      "Пролить через бумажный фильтр горячую воду (убрать привкус бумаги). Засыпать 18 г молотого кофе.",
      "Влить 50–60 мл воды, ждать 30 секунд (блуминг). Залить оставшиеся 120–130 мл воды.",
      "Установить поршень, сделать небольшое обратное движение. Оставить на 40 секунд. Снять поршень, перемешать, установить обратно.",
      "С постоянным давлением плавно опускать поршень 20–30 секунд. Не продавливать до самого конца.",
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
      "Выбор чашки: толстые стенки (дольше сохранят тепло), высокая (гуща не помешает).",
      "Помол: средний, свежеобжаренный кофе. Пропорции: 12 г на 200 мл. Без весов: ~4 г в чайной ложке с горкой, нужно 3 ч.л.",
      "Вода: бутилированная питьевая, pH около 7. Температура 93–95°C (дать остыть чайнику 2 минуты после закипания).",
      "Залить кофе непрерывной струей. Перемешать, оставить завариваться 4–5 мин. Через 4 мин активно перемешать, ждать пока частицы осядут.",
      "Убрать всплывающие крупные частицы перед употреблением. Пить, не давая стоять долго (продолжится экстракция, появится горечь). Сахар/корицу добавлять на 4-й минуте.",
    ],
  },
  {
    id: "auto",
    name: "Автомат",
    icon: "⚙",
    grind: "Под машину",
    ratio: "По машине",
    temp: "По машине",
    time: "По машине",
    content: [
      "Приготовление кофе в автоматической кофемашине зависит от конкретной модели и её настроек.",
      "Главное — подобрать оптимальный помол. Слишком мелкий — кофе будет горьким, слишком крупный — водянистым.",
      "Используйте свежеобжаренный кофе и фильтрованную воду для лучшего результата.",
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
