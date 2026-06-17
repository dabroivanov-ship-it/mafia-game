interface ChatRulesProps {
  embedded?: boolean;
}

export default function ChatRules({ embedded = false }: ChatRulesProps) {
  return (
    <div className={embedded ? 'rules-embedded' : 'rules-page'}>
      <div className="rules-card">
        {!embedded && <h2>Правила чата</h2>}

        <section className="rules-section">
          <ul>
            <li>В чате отображается <strong>логин</strong> игрока.</li>
            <li>Нажмите на имя в чате, чтобы открыть профиль.</li>
            <li>Не оскорбляйте игроков — за нарушения возможен бан.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
