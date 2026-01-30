import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: "Политика конфиденциальности | Millor Coffee",
  description: "Политика конфиденциальности и обработки персональных данных сайта Millor Coffee",
}

export default function PrivacyPage() {
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
              Политика конфиденциальности
            </h1>

            <div className="prose prose-coffee max-w-none">
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">1. Общие положения</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Настоящая Политика конфиденциальности действует в отношении всей информации, которую сайт может получить о Пользователе во время использования сайта. Использование Сайта означает безоговорочное согласие Пользователя с настоящей Политикой.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">2. Оператор персональных данных</h2>
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
                <h2 className="text-xl font-semibold text-foreground mb-4">3. Собираемые персональные данные</h2>
                <p className="text-muted-foreground leading-relaxed">
                  При заполнении форм на сайте собираются следующие данные: имя, номер телефона, адрес электронной почты, город проживания.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">4. Цели обработки персональных данных</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Связь с пользователем для обработки заявок</li>
                  <li>Предоставление коммерческих предложений</li>
                  <li>Заключение договоров поставки</li>
                  <li>Информирование о новых продуктах и акциях</li>
                  <li>Улучшение качества обслуживания</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">5. Правовые основания обработки</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Обработка персональных данных осуществляется на основании согласия пользователя, Федерального закона № 152-ФЗ «О персональных данных» и необходимости исполнения договора.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">6. Способы обработки</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Обработка персональных данных включает: сбор, запись, систематизацию, накопление, хранение, уточнение, использование для связи с пользователем и удаление по запросу.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">7. Передача данных третьим лицам</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Персональные данные Пользователя не передаются третьим лицам, за исключением случаев, когда такая передача является требованием законодательства Российской Федерации. Для анализа посещаемости сайта используется сервис Яндекс.Метрика.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">8. Файлы cookie</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Сайт использует технические и аналитические файлы cookie для обеспечения корректной работы и анализа посещаемости. Пользователь может управлять настройками cookie в своём браузере.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">9. Защита данных</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Для защиты персональных данных применяются следующие меры: использование SSL-сертификата (HTTPS), ограничение доступа к данным, регулярное резервное копирование и контроль обработки данных.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">10. Сроки обработки</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Персональные данные обрабатываются в течение срока, необходимого для достижения целей обработки. После достижения целей обработки или при отзыве согласия Пользователя персональные данные уничтожаются в течение 30 (тридцати) дней.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">11. Права субъектов персональных данных</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">Пользователь имеет право:</p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Получать информацию об обработке своих персональных данных</li>
                  <li>Требовать уточнения, блокирования или удаления данных</li>
                  <li>Отозвать согласие на обработку персональных данных</li>
                  <li>Обжаловать действия оператора в Роскомнадзор</li>
                  <li>Обратиться в суд для защиты своих прав</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">12. Изменения политики</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Оператор вправе вносить изменения в настоящую Политику конфиденциальности. Действующая версия всегда размещена на данной странице сайта.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">13. Обратная связь</h2>
                <div className="bg-secondary/50 rounded-xl p-6 text-sm">
                  <ul className="space-y-2 text-muted-foreground">
                    <li><strong>Email:</strong> newrefining@yandex.ru</li>
                    <li><strong>Телефон:</strong> +7 (909) 789-24-69</li>
                    <li><strong>Время работы:</strong> Пн-Пт 9:00-18:00 (МСК)</li>
                  </ul>
                </div>
              </section>

              <p className="text-sm text-muted-foreground mt-8 pt-6 border-t border-border">
                Дата последнего обновления: 26 декабря 2025 г.
              </p>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  )
}
