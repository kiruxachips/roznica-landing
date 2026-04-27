import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

/**
 * I5 (B-1): snapshot заказа, который ушёл на YooKassa, но юзер ещё не
 * вернулся с подтверждением. Раньше после createOrder мы сразу делали
 * clearCart() — если юзер закрыл вкладку или нажал «Назад» на платёжке,
 * корзина пустая, заказ висит как pending в БД, доплатить нельзя.
 *
 * Теперь сохраняем minimum: orderId + orderNumber + paymentUrl + TTL.
 * На /cart, /thank-you, главной — банер «Завершите оплату → [Доплатить]».
 *
 * localStorage (а не sessionStorage), чтобы пережить закрытие вкладки.
 * BroadcastChannel ниже синхронизирует очистку между табами при оплате.
 */

export interface PendingPayment {
  orderId: string
  orderNumber: string
  amount: number
  paymentUrl: string
  /** Создан в момент redirect на YooKassa. */
  createdAt: number
  /** ms-timestamp, после которого paymentUrl считается невалидным
   *  (~10 минут от createdAt по умолчанию ЮKассы). После этого UI должен
   *  показать кнопку «Создать новую ссылку оплаты» вместо прямого редиректа. */
  expiresAt: number
  /** Доказательство владения для repay-endpoint без логина.
   *  Совпадает с Order.trackingToken (cuid из generateToken). */
  trackingToken: string
}

interface PendingPaymentState {
  current: PendingPayment | null
  setPending: (data: PendingPayment) => void
  clear: () => void
  /** True если paymentUrl точно протух — клиент должен звать /repay перед использованием. */
  isUrlExpired: () => boolean
}

const STORAGE_KEY = "millor-pending-payment"
const BROADCAST_CHANNEL = "millor-orders"

/**
 * Помечаем pending как «оплачено» во ВСЕХ открытых вкладках (включая ту,
 * где юзер сейчас на /cart смотрит банер). Без этого webhook завершит
 * заказ, а банер на других табах останется висеть до F5.
 */
export function broadcastOrderResolved(orderId: string) {
  if (typeof window === "undefined") return
  try {
    const ch = new BroadcastChannel(BROADCAST_CHANNEL)
    ch.postMessage({ type: "order-resolved", orderId })
    ch.close()
  } catch {
    // Браузер не поддерживает BroadcastChannel — fallback на storage event
    // (Zustand persist уже синхронизирует через storage event автоматически
    // когда мы вызываем clear() в одной из вкладок).
  }
}

export const usePendingPaymentStore = create<PendingPaymentState>()(
  persist(
    (set, get) => ({
      current: null,
      setPending: (data) => set({ current: data }),
      clear: () => {
        const cur = get().current
        if (cur) broadcastOrderResolved(cur.orderId)
        set({ current: null })
      },
      isUrlExpired: () => {
        const cur = get().current
        if (!cur) return true
        return Date.now() > cur.expiresAt
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
)

/**
 * Хук-listener: автоматически очищает store, если другая вкладка
 * получила webhook с подтверждением оплаты. Подключать в banner-компоненте.
 */
export function subscribeOrderResolved(
  onResolved: (orderId: string) => void
): () => void {
  if (typeof window === "undefined") return () => {}
  let ch: BroadcastChannel | null = null
  try {
    ch = new BroadcastChannel(BROADCAST_CHANNEL)
    ch.onmessage = (e) => {
      if (e.data?.type === "order-resolved" && e.data.orderId) {
        onResolved(e.data.orderId)
      }
    }
  } catch {
    // нет BroadcastChannel — подписка no-op, синхронизация через
    // window.storage event (Zustand persist делает сам).
  }
  return () => {
    try {
      ch?.close()
    } catch {
      // ignore
    }
  }
}
