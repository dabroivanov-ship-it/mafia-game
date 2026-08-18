import {
  ABOUT_GAME_INTRO,
  ABOUT_GAME_QUOTE,
  ABOUT_GAME_SECTIONS,
} from '../content/aboutGameContent';

interface AboutGameProps {
  embedded?: boolean;
}

export default function AboutGame({ embedded = false }: AboutGameProps) {
  return (
    <div className={embedded ? 'rules-embedded' : 'rules-page'}>
      <div className="rules-card">
        {!embedded && (
          <>
            <h2>История Мафии</h2>
            <p className="muted">{ABOUT_GAME_INTRO}</p>
          </>
        )}

        {ABOUT_GAME_SECTIONS.map((section) => (
          <section key={section.title} className="rules-section">
            <h3>{section.title}</h3>
            {section.paragraphs.map((text) => (
              <p key={text.slice(0, 48)}>{text}</p>
            ))}
          </section>
        ))}

        <blockquote className="about-game-quote">{ABOUT_GAME_QUOTE}</blockquote>

        <section className="rules-section">
          <h3>Играть сейчас</h3>
          <p>
            На этом сайте можно собрать комнату, получить роль и сыграть партию в браузере — с
            людьми или с AI-агентами. Правила стола — в разделе{' '}
            <a href="/info/rules">«Правила игры»</a>, роли — в{' '}
            <a href="/info/roles">«Игровых ролях»</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
