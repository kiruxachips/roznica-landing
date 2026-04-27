import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type CheckoutStep = "contact" | "delivery" | "payment"

interface ContactData {
  firstName: string
  lastName: string
  phone: string
  email: string
}

interface CheckoutWizardState {
  step: CheckoutStep
  // Какие шаги уже пройдены (=данные валидны). Разрешаем «откат» к любому
  // завершённому шагу, но не прыжок вперёд без прохождения промежуточных.
  completed: Record<CheckoutStep, boolean>
  contact: ContactData
  notes: string
  agreed: boolean
  createAccount: boolean
  accountPassword: string

  setStep: (step: CheckoutStep) => void
  markCompleted: (step: CheckoutStep) => void
  goBack: () => void
  setContact: (data: Partial<ContactData>) => void
  setNotes: (notes: string) => void
  setAgreed: (agreed: boolean) => void
  setCreateAccount: (value: boolean) => void
  setAccountPassword: (value: string) => void
  reset: () => void
}

const initial = {
  step: "contact" as CheckoutStep,
  completed: { contact: false, delivery: false, payment: false },
  contact: { firstName: "", lastName: "", phone: "", email: "" },
  notes: "",
  agreed: false,
  createAccount: false,
  accountPassword: "",
}

export const useCheckoutWizard = create<CheckoutWizardState>()(
  persist(
    (set, get) => ({
      ...initial,
      setStep: (step) => {
        const { completed } = get()
        // Нельзя прыгнуть вперёд, пока предыдущий шаг не завершён.
        if (step === "delivery" && !completed.contact) return
        if (step === "payment" && (!completed.contact || !completed.delivery)) return
        // I1: возврат назад инвалидирует всё последующее. Иначе юзер видит
        // «Доставка ✓» с устаревшей суммой / адресом, и может попасть в
        // mismatch на оплате (особенно после смены контактного телефона
        // или пересчёта тарифа из-за изменения корзины).
        let nextCompleted = completed
        if (step === "contact") {
          nextCompleted = { ...completed, delivery: false, payment: false }
        } else if (step === "delivery") {
          nextCompleted = { ...completed, payment: false }
        }
        set({ step, completed: nextCompleted })
      },
      markCompleted: (step) =>
        set((s) => ({ completed: { ...s.completed, [step]: true } })),
      goBack: () => {
        const { step, completed } = get()
        if (step === "payment") {
          set({ step: "delivery", completed: { ...completed, payment: false } })
        } else if (step === "delivery") {
          set({
            step: "contact",
            completed: { ...completed, delivery: false, payment: false },
          })
        }
      },
      setContact: (data) => set((s) => ({ contact: { ...s.contact, ...data } })),
      setNotes: (notes) => set({ notes }),
      setAgreed: (agreed) => set({ agreed }),
      setCreateAccount: (createAccount) => set({ createAccount }),
      setAccountPassword: (accountPassword) => set({ accountPassword }),
      // I2: явно стираем persist-snapshot. Без этого после reset() при
      // следующем визите wizard восстановится со старыми completed/step из
      // sessionStorage — и пустит юзера сразу на «Оплату» с пустыми данными.
      reset: () => {
        set(initial)
        try {
          useCheckoutWizard.persist.clearStorage()
        } catch {
          // Доступа к storage нет (SSR / privacy mode) — non-blocking.
        }
      },
    }),
    {
      name: "checkout-wizard",
      storage: createJSONStorage(() => sessionStorage),
      // Персистим contact/notes (ввод юзера) и completed/step (прогресс по
      // wizard'у), чтобы F5 на шаге payment вернул юзера туда же, где он был,
      // а не откидывал на первый шаг. agreed — не персистим (требование
      // оферты: юзер должен свежо ставить галочку перед оплатой).
      // accountPassword — не персистим (плейнтекст-пароль не должен жить
      // в sessionStorage дольше, чем нужно).
      partialize: (s) => ({
        contact: s.contact,
        notes: s.notes,
        step: s.step,
        completed: s.completed,
        createAccount: s.createAccount,
      }),
    }
  )
)
