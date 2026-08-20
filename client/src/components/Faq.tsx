import { FAQ_INTRO, FAQ_ITEMS } from '../content/faqContent';

interface FaqProps {
  embedded?: boolean;
}

export default function Faq({ embedded = false }: FaqProps) {
  return (
    <div className={embedded ? 'faq-embedded' : 'faq-page'}>
      {!embedded && (
        <header className="page-header">
          <h1>Частые вопросы</h1>
          <p className="muted">{FAQ_INTRO}</p>
        </header>
      )}

      <div className="faq-list">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="faq-item">
            <summary className="faq-question">{item.question}</summary>
            <p className="faq-answer">
              {item.question === 'Какие роли есть в игре?' ? (
                <>
                  В зависимости от числа игроков доступны мафия, дон, Катани (комиссар), доктор,
                  адвокат, путана, бомж, маньяк, клоун, горец, жена комиссара и мирные жители.
                  Полный список с описанием — на странице{' '}
                  <a href="/info/roles">«Роли»</a>.
                </>
              ) : item.question === 'Что такое AI-агенты в игре?' ? (
                <>
                  Это виртуальные игроки за столом: им раздают роли, они пишут в чат, голосуют и
                  ходят ночью по тем же правилам, что и люди. Комнаты с агентами в списке помечены
                  «AI». Нажмите на ник в чате — откроется карточка «AI игрок». Подробнее — в разделе{' '}
                  <a href="/info/ai">«Игры с AI-агентами»</a>.
                </>
              ) : (
                item.answer
              )}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
