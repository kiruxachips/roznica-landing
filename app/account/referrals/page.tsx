import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Share2, Users, Gift } from "lucide-react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  getOrCreateReferralCodeForUser,
  getReferralConfig,
} from "@/lib/dal/referral"
import { CopyReferralLink } from "@/components/account/CopyReferralLink"

export const metadata: Metadata = {
  title: "Пригласить друга | Millor Coffee",
}

export const dynamic = "force-dynamic"

export default async function ReferralsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login?next=/account/referrals")
  const userId = session.user.id

  const [code, config, stats] = await Promise.all([
    getOrCreateReferralCodeForUser(userId),
    getReferralConfig(),
    prisma.referralCode.findUnique({
      where: { userId },
      include: {
        redemptions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
  ])

  if (!config.enabled) {
    return (
      <div>
        <h1 className="text-xl sm:text-2xl font-sans font-bold mb-5">Пригласить друга</h1>
        <p className="text-muted-foreground">
          Реферальная программа временно отключена. Загляните позже.
        </p>
      </div>
    )
  }

  const siteUrl = process.env.NEXTAUTH_URL || "https://millor-coffee.ru"
  const link = `${siteUrl}/?ref=${code}`

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-sans font-bold mb-5">Пригласить друга</h1>

      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 sm:p-6 mb-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium">
              Друг получит {config.inviteeBonus}₽ на первый заказ, а вы — {config.inviterBonus}₽
              когда он его оформит.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Без ограничений — приглашайте сколько угодно. Бонусы можно тратить на любые заказы.
            </p>
          </div>
        </div>

        <CopyReferralLink link={link} code={code} />
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Stat
          icon={Users}
          label="Приглашено"
          value={(stats?.usageCount ?? 0).toString()}
        />
        <Stat
          icon={Gift}
          label="Заработано бонусов"
          value={`${stats?.totalRewardEarned ?? 0}₽`}
        />
        <Stat
          icon={Share2}
          label="Ваш код"
          value={code}
          mono
        />
      </div>

      {stats?.redemptions && stats.redemptions.length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold mb-3">Последние начисления</h2>
          <ul className="divide-y text-sm">
            {stats.redemptions.map((r) => (
              <li key={r.id} className="py-2.5 flex justify-between">
                <div>
                  <div className="font-medium">Друг оформил заказ</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("ru-RU")}
                  </div>
                </div>
                <div className="text-emerald-700 font-semibold">
                  +{r.referrerReward}₽
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        <Link href="/account/bonuses" className="text-primary hover:underline">
          История всех бонусов →
        </Link>
      </p>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Users
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3">
      <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`font-semibold ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  )
}
