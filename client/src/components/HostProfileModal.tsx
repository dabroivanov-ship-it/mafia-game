import { HOST_PROFILE_DUTIES, HOST_PROFILE_INTRO, HOST_SENDER_NAME } from '../content/hostContent';

interface HostProfileModalProps {
  onClose: () => void;
}

export default function HostProfileModal({ onClose }: HostProfileModalProps) {
  return (
    <div className="modal-overlay player-page-overlay" onClick={onClose}>
      <div className="modal player-page-modal host-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="player-page-top">
          <button type="button" className="btn btn-ghost btn-sm player-page-close" onClick={onClose}>
            ✕ Закрыть
          </button>
          <h2 className="player-page-name">{HOST_SENDER_NAME}</h2>
        </div>

        <div className="player-page-body">
          <div className="host-profile-badge-row">
            <span className="host-profile-badge">Бот</span>
            <span className="muted">Системный персонаж</span>
          </div>

          <p className="host-profile-intro">{HOST_PROFILE_INTRO}</p>

          <h3 className="host-profile-section-title">Что делает ведущий</h3>
          <ul className="host-profile-list">
            {HOST_PROFILE_DUTIES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <p className="muted host-profile-note">
            Написать ведущему нельзя — это автоматические сообщения игры. Вопросы по правилам — в разделе{' '}
            <a href="/info/faq">«Частые вопросы»</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
