import { AI_AGENTS_INTRO, AI_AGENTS_SECTIONS } from '../content/aiAgentsContent';

interface AiAgentsProps {
  embedded?: boolean;
}

export default function AiAgents({ embedded = false }: AiAgentsProps) {
  return (
    <div className={embedded ? 'rules-embedded' : 'rules-page'}>
      <div className="rules-card">
        {!embedded && (
          <>
            <h2>Игры с AI-агентами</h2>
            <p className="muted">{AI_AGENTS_INTRO}</p>
          </>
        )}

        {AI_AGENTS_SECTIONS.map((section) => (
          <section key={section.title} className="rules-section">
            <h3>{section.title}</h3>
            {section.paragraphs?.map((text) => (
              <p key={text.slice(0, 40)}>{text}</p>
            ))}
            {section.items && (
              <ul>
                {section.items.map((item) => (
                  <li key={item.slice(0, 40)}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="rules-section">
          <h3>Связанные разделы</h3>
          <p>
            Общие фазы, победа и очки — в <a href="/info/rules">правилах игры</a>. Описание ролей — в
            разделе <a href="/info/roles">«Игровые роли»</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
