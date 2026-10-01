import { CLAN_CREATE_MIN_GAMES, CLAN_CREATE_MIN_POSTS } from '../content/clanRulesContent';

interface ClanRulesProps {
  embedded?: boolean;
}

export default function ClanRules({ embedded = false }: ClanRulesProps) {
  return (
    <div className={embedded ? 'rules-embedded' : 'rules-page'}>
      <div className="rules-card">
        {!embedded && <h2>Правила кланов</h2>}

        <section className="rules-section">
          <h3>Состав</h3>
          <ul>
            <li>
              Игрок может состоять только в <strong>одном</strong> клане.
            </li>
            <li>
              Создать клан можно после <strong>{CLAN_CREATE_MIN_POSTS}</strong> сообщений в чате и{' '}
              <strong>{CLAN_CREATE_MIN_GAMES}</strong> игр. Создатель становится главой.
            </li>
          </ul>
        </section>

        <section className="rules-section">
          <h3>Вступление</h3>
          <ul>
            <li>
              <strong>Открытое</strong> — вход сразу.
            </li>
            <li>
              <strong>По заявке</strong> — решает глава.
            </li>
            <li>
              Исключение с чёрным списком — повторная заявка в этот клан невозможна.
            </li>
          </ul>
        </section>

        <section className="rules-section">
          <h3>Комната и новости</h3>
          <p>
            Чат и новости клана видны только членам. Глава публикует новости, принимает и
            отклоняет заявки, исключает участников, ведёт чёрный список, передаёт главенство,
            очищает чат, задаёт логотип и описание и может распустить клан.
          </p>
        </section>

        <section className="rules-section">
          <h3>Выход</h3>
          <p>
            Выйти из клана можно самостоятельно. Глава может выйти только один: иначе сначала
            передайте главенство или распустите клан.
          </p>
        </section>

        <section className="rules-section">
          <h3>Поведение</h3>
          <p>В клане действуют общие правила сайта и чата: без оскорблений, спама и читерства.</p>
        </section>
      </div>
    </div>
  );
}
