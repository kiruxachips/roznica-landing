import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: "Пользовательское соглашение | Millor Coffee",
  description: "Пользовательское соглашение сайта Millor Coffee",
}

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16 bg-secondary/20 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться на главную
          </Link>

          {/* Content */}
          <article className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-8 sm:p-12">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-8">
              Пользовательское соглашение
            </h1>

            <div className="prose prose-coffee max-w-none">
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">1. Общие положения</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Настоящее Пользовательское соглашение регулирует отношения между Администрацией сайта и Пользователями. Использование Сайта означает безоговорочное принятие Пользователем настоящего Соглашения.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">2. Информация об Администрации</h2>
                <div className="bg-secondary/50 rounded-xl p-6 text-sm">
                  <ul className="space-y-2 text-muted-foreground">
                    <li><strong>ИП:</strong> Новиков Данил Владимирович</li>
                    <li><strong>ИНН:</strong> 390520808777</li>
                    <li><strong>ОГРНИП:</strong> 323390000053101</li>
                    <li><strong>Адрес:</strong> 193231, Санкт-Петербург, ул. Кржижановского, д. 5, к. 4, литера А, кв. 152</li>
                    <li><strong>Email:</strong> newrefining@yandex.ru</li>
                    <li><strong>Телефон:</strong> +7 (909) 789-24-69</li>
                  </ul>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">3. Предмет Соглашения</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Администрация предоставляет Пользователю доступ к информации о продукции, условиям поставок кофейного зерна, формам заявок и контактной информации.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">4. Права и обязанности Пользователя</h2>
                <p className="text-muted-foreground leading-relaxed mb-4"><strong>Пользователь имеет право:</strong></p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                  <li>Просматривать информацию, размещённую на сайте</li>
                  <li>Отправлять заявки через формы обратной связи</li>
                  <li>Получать коммерческие предложения</li>
                  <li>Обращаться с вопросами к Администрации</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mb-4"><strong>Пользователь обязуется:</strong></p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Предоставлять достоверные данные при заполнении форм</li>
                  <li>Соблюдать законодательство Российской Федерации</li>
                  <li>Не использовать автоматизированные средства сбора информации</li>
                  <li>Не нарушать нормальную работу сайта</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">5. Права и обязанности Администрации</h2>
                <p className="text-muted-foreground leading-relaxed mb-4"><strong>Администрация имеет право:</strong></p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                  <li>Изменять содержание и функционал сайта</li>
                  <li>Ограничивать доступ к сайту</li>
                  <li>Удалять контент, нарушающий условия Соглашения</li>
                  <li>Изменять условия Соглашения в одностороннем порядке</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mb-4"><strong>Администрация обязуется:</strong></p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Обеспечивать работоспособность сайта</li>
                  <li>Обрабатывать персональные данные согласно Политике конфиденциальности</li>
                  <li>Рассматривать обращения пользователей в разумные сроки</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">6. Оформление заказа</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Заявка на сайте не является офертой и носит информационный характер. Администрация обрабатывает заявки в течение 1-3 рабочих дней. После обработки заявки менеджер свяжется с вами для уточнения деталей заказа.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">7. Интеллектуальная собственность</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Весь контент сайта, включая тексты, изображения, логотипы и дизайн, защищён авторским правом и принадлежит Администрации. Использование контента допускается только в рамках функционала, предлагаемого Сайтом.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">8. Ограничение ответственности</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Администрация не несёт ответственности за временную недоступность сайта, возможные ошибки в работе, содержание информации пользователей и любые убытки, связанные с использованием сайта. Вся информация на Сайте предоставляется «как есть».
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">9. Персональные данные</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Обработка персональных данных пользователей осуществляется в соответствии с{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Политикой конфиденциальности
                  </Link>.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">10. Файлы cookie и сервисы аналитики</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Сайт использует файлы cookie и сервисы веб-аналитики компании ООО «ЯНДЕКС» для анализа посещаемости и улучшения качества обслуживания.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  <strong>На сайте используются:</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                  <li><strong>Яндекс.Метрика</strong> — сервис веб-аналитики для сбора статистики посещаемости</li>
                  <li><strong>Вебвизор</strong> — инструмент записи сессий пользователей для анализа удобства интерфейса</li>
                  <li><strong>Карта кликов</strong> — визуализация областей с наибольшим количеством кликов</li>
                  <li><strong>Карта скроллинга</strong> — анализ глубины просмотра страниц</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Продолжая использовать сайт, Пользователь даёт согласие на обработку данных указанными сервисами в соответствии с{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Политикой конфиденциальности
                  </Link>.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Пользователь может отключить сбор данных, отклонив использование cookies при первом посещении сайта или изменив настройки браузера.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">11. Внешние ссылки</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Администрация не несёт ответственности за содержание сторонних сайтов, на которые могут вести ссылки с данного сайта.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">12. Изменение условий Соглашения</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Администрация вправе в любое время изменять условия настоящего Соглашения в одностороннем порядке без предварительного уведомления. Актуальная версия всегда доступна на данной странице.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">13. Разрешение споров</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Все споры и разногласия разрешаются путём переговоров. При невозможности достижения согласия споры подлежат рассмотрению в судебном порядке в соответствии с законодательством РФ. Обязательный претензионный порядок: срок ответа на претензию — 30 дней.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">14. Прочие условия</h2>
                <p className="text-muted-foreground leading-relaxed">
                  К отношениям между Пользователем и Администрацией применяется законодательство Российской Федерации. Признание недействительным какого-либо положения настоящего Соглашения не влечёт недействительности остальных положений.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">15. Контактная информация</h2>
                <div className="bg-secondary/50 rounded-xl p-6 text-sm">
                  <ul className="space-y-2 text-muted-foreground">
                    <li><strong>Email:</strong> newrefining@yandex.ru</li>
                    <li><strong>Телефон:</strong> +7 (909) 789-24-69</li>
                    <li><strong>Время работы:</strong> Пн-Пт 9:00-18:00 (МСК)</li>
                  </ul>
                </div>
              </section>

              <p className="text-sm text-muted-foreground mt-8 pt-6 border-t border-border">
                Дата последнего обновления: 2 февраля 2026 г.
              </p>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  )
}
