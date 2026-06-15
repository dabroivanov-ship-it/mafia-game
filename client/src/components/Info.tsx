import Rules from './Rules';

export default function Info() {
  return (
    <div className="info-page">
      <header className="page-header">
        <h1>ℹ️ Информация</h1>
        <p className="muted">Правила игры и полезные сведения</p>
      </header>
      <Rules embedded />
    </div>
  );
}
