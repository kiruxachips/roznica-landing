"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Coffee, Loader2, Sparkles } from "lucide-react"
import { questions, type Answers } from "./quiz/questions"
import { QuizStep } from "./quiz/QuizStep"
import { QuizResult } from "./quiz/QuizResult"
import type { ProductCard as ProductCardType } from "@/lib/types"
import { cn } from "@/lib/utils"

type QuizPhase = "intro" | "questions" | "loading" | "result"

interface Match {
  productId: string
  score: number
}

export function TasteQuiz() {
  const [phase, setPhase] = useState<QuizPhase>("intro")
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [products, setProducts] = useState<ProductCardType[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [error, setError] = useState("")

  const currentQuestion = questions[step]
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined
  const isLastStep = step === questions.length - 1

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
    <section id="quiz" aria-label="Подбор кофе" className="py-12 sm:py-16 lg:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {phase === "intro" && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-5">
                <Sparkles className="w-4 h-4" strokeWidth={1.75} />
                Подбор за 60 секунд
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4 leading-tight">
                Не знаете какой кофе выбрать?
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
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
            </div>
          )}

          {phase === "questions" && currentQuestion && (
            <div className="bg-secondary/20 rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10">
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
            <div className="bg-secondary/20 rounded-2xl sm:rounded-3xl p-10 sm:p-16 text-center">
              <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin mb-4" strokeWidth={1.75} />
              <p className="text-base sm:text-lg font-medium text-foreground">Подбираем ваш кофе...</p>
              <p className="text-sm text-muted-foreground mt-1">Секунду</p>
            </div>
          )}

          {phase === "result" && (
            <QuizResult products={products} matches={matches} onRestart={handleRestart} />
          )}
        </div>
      </div>
    </section>
  )
}
