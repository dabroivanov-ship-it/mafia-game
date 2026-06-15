import { useEffect, useState } from 'react';
import { avatarUrl, fetchStaffList } from '../api';
import type { StaffMember } from '../types';

interface StaffProps {
  embedded?: boolean;
}

export default function Staff({ embedded = false }: StaffProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const { staff: list } = await fetchStaffList();
        setStaff(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const admins = staff.filter((m) => m.role === 'admin');
  const moderators = staff.filter((m) => m.role === 'moderator');

  return (
    <div className={embedded ? 'staff-embedded' : 'staff-page'}>
      <header className="page-header">
        <h1>{embedded ? '🛡️ Команда' : '🛡️ Команда проекта'}</h1>
        <p className="muted">
          {embedded
            ? 'Администраторы и модераторы проекта'
            : 'Администраторы и модераторы, следящие за порядком в игре'}
        </p>
      </header>

      {loading && <p className="muted">Загрузка...</p>}
      {error && <div className="auth-error">{error}</div>}

      {!loading && !error && (
        <>
          <section className="staff-section">
            <h2>Администраторы ({admins.length})</h2>
            {admins.length === 0 ? (
              <p className="muted">Пока не назначены</p>
            ) : (
              <div className="staff-grid">
                {admins.map((member) => (
                  <StaffCard key={member.id} member={member} />
                ))}
              </div>
            )}
          </section>

          <section className="staff-section">
            <h2>Модераторы ({moderators.length})</h2>
            {moderators.length === 0 ? (
              <p className="muted">Пока не назначены</p>
            ) : (
              <div className="staff-grid">
                {moderators.map((member) => (
                  <StaffCard key={member.id} member={member} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StaffCard({ member }: { member: StaffMember }) {
  return (
    <div className="staff-card">
      {member.avatar ? (
        <img src={avatarUrl(member.avatar) ?? undefined} alt="" className="staff-avatar" />
      ) : (
        <div className="staff-avatar placeholder">👤</div>
      )}
      <div className="staff-card-body">
        <strong>{member.displayName}</strong>
        <span className="muted">@{member.username}</span>
        {member.city && <span className="muted staff-city">📍 {member.city}</span>}
        {member.role === 'admin' ? (
          <span className="admin-badge">admin</span>
        ) : (
          <span className="mod-badge">mod</span>
        )}
      </div>
    </div>
  );
}
