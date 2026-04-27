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
        set({ step })
      },
      markCompleted: (step) =>
        set((s) => ({ completed: { ...s.completed, [step]: true } })),
      goBack: () => {
        const { step } = get()
        if (step === "payment") set({ step: "delivery" })
        else if (step === "delivery") set({ step: "contact" })
      },
      setContact: (data) => set((s) => ({ contact: { ...s.contact, ...data } })),
      setNotes: (notes) => set({ notes }),
      setAgreed: (agreed) => set({ agreed }),
      setCreateAccount: (createAccount) => set({ createAccount }),
      setAccountPassword: (accountPassword) => set({ accountPassword }),
      reset: () => set(initial),
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
