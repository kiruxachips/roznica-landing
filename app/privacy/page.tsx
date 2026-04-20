import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: "Политика конфиденциальности | Millor Coffee",
  description: "Политика конфиденциальности и обработки персональных данных сайта Millor Coffee",
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="pt-20 sm:pt-24 pb-12 sm:pb-16 bg-secondary/20 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Link */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-5 sm:mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться на главную
          </Link>

          {/* Content */}
          <article className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-5 sm:p-8 lg:p-12">
            <h1 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-6 sm:mb-8 leading-tight">
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
                <p className="text-muted-foreground leading-relaxed mb-4">
                  В зависимости от действий Пользователя на сайте собираются следующие данные:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                  <li><strong>При регистрации:</strong> имя, адрес электронной почты, пароль (хранится в хешированном виде)</li>
                  <li><strong>При оформлении заказа:</strong> имя, номер телефона, адрес электронной почты, адрес доставки, способ доставки, комментарий к заказу</li>
                  <li><strong>При авторизации через сторонние сервисы (Google, Яндекс, VK, Telegram):</strong> идентификатор аккаунта, имя, адрес электронной почты (предоставляемые провайдером)</li>
                  <li><strong>Автоматически при использовании сайта:</strong> IP-адрес, данные браузера и устройства, действия на сайте (просмотренные страницы, клики, время на сайте)</li>
                  <li><strong>Данные заказов:</strong> состав заказа, стоимость, статус, номер заказа</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">4. Цели обработки персональных данных</h2>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Создание и ведение учётной записи пользователя</li>
                  <li>Оформление и исполнение заказов</li>
                  <li>Доставка товаров (передача данных курьерским службам)</li>
                  <li>Связь с пользователем для обработки заказов и заявок</li>
                  <li>Бухгалтерский и налоговый учёт</li>
                  <li>Предоставление коммерческих предложений</li>
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
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Персональные данные Пользователя не передаются третьим лицам, за исключением следующих случаев:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                  <li><strong>Курьерские службы (СДЭК, Почта России):</strong> для доставки заказов передаются имя, номер телефона и адрес доставки получателя</li>
                  <li><strong>OAuth-провайдеры (Google, Яндекс, VK, Telegram):</strong> при авторизации через сторонние сервисы происходит обмен данными для подтверждения личности пользователя</li>
                  <li><strong>Яндекс.Метрика (ООО «ЯНДЕКС», ИНН 7736207543):</strong> для анализа посещаемости и улучшения качества сайта. Данные обрабатываются на серверах Яндекса в соответствии с их политикой конфиденциальности</li>
                  <li><strong>Требование законодательства РФ:</strong> в случаях, предусмотренных законодательством Российской Федерации</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">8. Сервисы Яндекса</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  На сайте используются следующие сервисы компании Яндекс:
                </p>
                <div className="bg-secondary/50 rounded-xl p-6 mb-4">
                  <h3 className="font-semibold text-foreground mb-3">Яндекс.Метрика</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Сервис веб-аналитики, который собирает следующие данные:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>IP-адрес (в анонимизированном виде)</li>
                    <li>Информация о браузере и устройстве</li>
                    <li>Географическое местоположение (город, регион)</li>
                    <li>Источник перехода на сайт</li>
                    <li>Просмотренные страницы и время на сайте</li>
                    <li>Действия на сайте (клики, скроллинг, переходы)</li>
                  </ul>
                </div>
                <div className="bg-secondary/50 rounded-xl p-6 mb-4">
                  <h3 className="font-semibold text-foreground mb-3">Вебвизор</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Инструмент записи действий пользователей на сайте. Вебвизор записывает:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Движения курсора мыши</li>
                    <li>Клики и прокрутку страницы</li>
                    <li>Заполнение форм (без сохранения паролей и платёжных данных)</li>
                    <li>Навигацию по сайту</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-3">
                    Записи используются исключительно для улучшения удобства сайта и не содержат персональных данных.
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-xl p-6">
                  <h3 className="font-semibold text-foreground mb-3">Карта кликов и скроллинга</h3>
                  <p className="text-sm text-muted-foreground">
                    Анализ наиболее популярных областей страницы для оптимизации интерфейса сайта.
                  </p>
                </div>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">9. Файлы cookie</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Сайт использует файлы cookie для обеспечения корректной работы и анализа посещаемости.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  <strong>Типы используемых cookie:</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
                  <li><strong>Технические cookie</strong> — необходимы для работы сайта (хранение согласия на cookies)</li>
                  <li><strong>Аналитические cookie</strong> — используются Яндекс.Метрикой для сбора статистики посещаемости</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  Вы можете отключить cookies в настройках браузера. Обратите внимание, что это может повлиять на функциональность сайта.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">10. Защита данных</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Для защиты персональных данных применяются следующие меры: использование SSL-сертификата (HTTPS), ограничение доступа к данным, регулярное резервное копирование и контроль обработки данных.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">11. Сроки обработки</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Персональные данные обрабатываются в течение срока, необходимого для достижения целей обработки. После достижения целей обработки или при отзыве согласия Пользователя персональные данные уничтожаются в течение 30 (тридцати) дней.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">12. Права субъектов персональных данных</h2>
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
                <h2 className="text-xl font-semibold text-foreground mb-4">13. Изменения политики</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Оператор вправе вносить изменения в настоящую Политику конфиденциальности. Действующая версия всегда размещена на данной странице сайта.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-xl font-semibold text-foreground mb-4">14. Обратная связь</h2>
                <div className="bg-secondary/50 rounded-xl p-6 text-sm">
                  <ul className="space-y-2 text-muted-foreground">
                    <li><strong>Email:</strong> newrefining@yandex.ru</li>
                    <li><strong>Телефон:</strong> +7 (909) 789-24-69</li>
                    <li><strong>Время работы:</strong> Пн-Пт 9:00-18:00 (МСК)</li>
                  </ul>
                </div>
              </section>

              <p className="text-sm text-muted-foreground mt-8 pt-6 border-t border-border">
                Дата последнего обновления: 2 марта 2026 г.
              </p>
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  )
}
