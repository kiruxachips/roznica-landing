"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Coffee, Loader2, Sparkles, X } from "lucide-react"
import { questions, type Answers } from "./quiz/questions"
import { QuizStep } from "./quiz/QuizStep"
import { QuizResult } from "./quiz/QuizResult"
import type { ProductCard as ProductCardType } from "@/lib/types"
import { cn } from "@/lib/utils"

type QuizPhase = "intro" | "questions" | "loading" | "result"

interface Match {
  productId: string
  percent: number
  reasons: string[]
}

export function TasteQuiz() {
  const [phase, setPhase] = useState<QuizPhase>("intro")
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [products, setProducts] = useState<ProductCardType[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [error, setError] = useState("")
  const sectionRef = useRef<HTMLElement>(null)
  const stepBodyRef = useRef<HTMLDivElement>(null)

  const currentQuestion = questions[step]
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined
  const isLastStep = step === questions.length - 1

  // Auto-scroll to top of quiz when step changes (inside questions phase)
  useEffect(() => {
    if (phase !== "questions") return
    stepBodyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [step, phase])

  // Lock body scroll when result modal is open
  useEffect(() => {
    if (phase !== "result") return
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [phase])

  function handleStart() {
    setPhase("questions")
    setStep(0)
  }

  function handleSelect(id: string) {
    if (!currentQuestion) return
    setAnswers({ ...answers, [currentQuestion.id]: id })
  }

  async function handleNext() {
    if (!currentAnswer) return
    if (!isLastStep) {
      setStep(step + 1)
      return
    }
    setPhase("loading")
    setError("")
    try {
      const res = await fetch("/api/quiz/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      })
      if (!res.ok) throw new Error("bad response")
      const data = await res.json()
      setProducts(data.products ?? [])
      setMatches(data.matches ?? [])
      setPhase("result")
    } catch {
      setError("Не удалось получить подборку. Попробуйте ещё раз.")
      setPhase("questions")
    }
  }

  function handleBack() {
    if (step === 0) {
      setPhase("intro")
      return
    }
    setStep(step - 1)
  }

  function handleRestart() {
    setAnswers({})
    setProducts([])
    setMatches([])
    setStep(0)
    setPhase("intro")
  }

  return (
    <section ref={sectionRef} id="quiz" aria-label="Подбор кофе" className="py-12 sm:py-16 lg:py-20 bg-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={stepBodyRef} className="max-w-3xl mx-auto scroll-mt-20">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm p-5 sm:p-8 lg:p-10 border border-border/40">
            {phase === "intro" && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-5">
                  <Sparkles className="w-4 h-4" strokeWidth={1.75} />
                  Подбор за 60 секунд
                </div>
                <h2 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight">
                  Не знаете какой кофе выбрать?
                </h2>
                <p className="text-base sm:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Ответьте на 5 вопросов — подберём 3 сорта под ваш вкус и способ заваривания.
                </p>
                <button
                  onClick={handleStart}
                  className="inline-flex items-center gap-2 h-12 px-6 sm:px-8 bg-primary text-white rounded-xl font-semibold text-sm sm:text-base hover:bg-primary/90 active:scale-[0.98] transition-all"
                >
                  <Coffee className="w-5 h-5" strokeWidth={1.75} />
                  Начать подбор
                  <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <p className="mt-4 text-xs sm:text-sm text-muted-foreground">
                  Уже знаете что хотите?{" "}
                  <Link href="/catalog" className="text-primary hover:underline font-medium">
                    Перейти в каталог →
                  </Link>
                </p>
              </div>
            )}

            {phase === "questions" && currentQuestion && (
              <div>
                {/* Progress */}
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground shrink-0">
                    Шаг {step + 1} из {questions.length}
                  </span>
                  <div className="flex-1 h-1.5 bg-border/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${((step + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <QuizStep
                  title={currentQuestion.title}
                  subtitle={currentQuestion.subtitle}
                  options={currentQuestion.options}
                  selected={currentAnswer}
                  onSelect={handleSelect}
                />

                {error && (
                  <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>
                )}

                <div className="flex items-center justify-between gap-3 mt-6 sm:mt-8">
                  <button
                    onClick={handleBack}
                    className="inline-flex items-center gap-1.5 h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted text-sm font-medium transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
                    Назад
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!currentAnswer}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-10 sm:h-11 px-4 sm:px-6 bg-primary text-white rounded-xl text-sm font-semibold transition-all",
                      !currentAnswer ? "opacity-40 cursor-not-allowed" : "hover:bg-primary/90 active:scale-[0.98]"
                    )}
                  >
                    {isLastStep ? "Показать результат" : "Далее"}
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            )}

            {phase === "loading" && (
              <div className="py-10 sm:py-16 text-center">
                <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin mb-4" strokeWidth={1.75} />
                <p className="text-base sm:text-lg font-medium text-foreground">Подбираем ваш кофе...</p>
                <p className="text-sm text-muted-foreground mt-1">Секунду</p>
              </div>
            )}

            {phase === "result" && (
              <div className="text-center py-6">
                <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" strokeWidth={1.75} />
                <p className="text-base sm:text-lg font-medium text-foreground">Подборка готова!</p>
                <p className="text-sm text-muted-foreground mt-1">Результаты показаны во всплывающем окне.</p>
                <button
                  onClick={handleRestart}
                  className="mt-4 text-sm text-primary hover:underline font-medium"
                >
                  Пройти ещё раз
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result modal overlay */}
      {phase === "result" && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleRestart() }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl m-4 sm:m-6 lg:my-10 p-5 sm:p-8 lg:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleRestart}
              className="absolute top-4 right-4 z-10 h-11 w-11 rounded-full bg-secondary/80 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
            <QuizResult products={products} matches={matches} onRestart={handleRestart} />
          </div>
        </div>
      )}
    </section>
  )
}
