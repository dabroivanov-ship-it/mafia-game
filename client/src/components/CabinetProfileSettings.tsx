import { useState, useEffect, FormEvent } from 'react';
import { avatarUrl, updateProfile, fetchMe } from '../api';
import type { User } from '../types';
import { USER_GENDER_LABELS } from '../gender';
import { userPositionLabel, isStaffPosition } from '../userPosition';
import { defaultAvatarPathForGender } from '../defaultAvatars';

interface CabinetProfileSettingsProps {
  user: User;
  onUpdate: (user: User) => void;
  onBack: () => void;
}

export default function CabinetProfileSettings({
  user,
  onUpdate,
  onBack,
}: CabinetProfileSettingsProps) {
  const [form, setForm] = useState({
    displayName: user.displayName || '',
    gender: user.gender || ('' as '' | 'male' | 'female'),
    city: user.city || '',
    bio: user.bio || '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMe()
      .then(({ user: next }) => {
        if (!cancelled) onUpdate(next);
      })
      .catch(() => {
        /* keep current user */
      });
    return () => {
      cancelled = true;
    };
  }, [onUpdate]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { user: updated } = await updateProfile({
        ...form,
        chatLimit: user.chatLimit ?? 15,
      });
      onUpdate(updated);
      setSuccess('Профиль сохранён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  const previewGender = form.gender || user.gender;
  const previewAvatar = defaultAvatarPathForGender(previewGender);

  return (
    <div className="cabinet-page">
      <nav className="info-back">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Кабинет
        </button>
      </nav>

      <header className="page-header">
        <h1>Профиль</h1>
        <p className="muted">Имя, пол, город и о себе</p>
      </header>

      <div className="profile-card cabinet-card">
        <div className="profile-avatar-block profile-avatar-block--picker">
          <div className="profile-avatar-wrap">
            {previewAvatar ? (
              <img
                src={avatarUrl(previewAvatar) ?? undefined}
                alt="Аватар"
                className="profile-avatar"
              />
            ) : (
              <div className="profile-avatar placeholder" aria-hidden="true" />
            )}
          </div>
          <div className="profile-avatar-info">
            <p className="profile-avatar-picker-label">Аватар</p>
            <p className="muted small">
              {previewGender
                ? `Для ${USER_GENDER_LABELS[previewGender].toLowerCase()} пола`
                : 'Выберите пол — аватар подставится автоматически'}
            </p>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form className="auth-form" onSubmit={handleSave}>
          {isStaffPosition(user) && (
            <label>
              Должность
              <input value={userPositionLabel(user)} readOnly />
            </label>
          )}
          <label>
            Имя
            <input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              maxLength={30}
              required
            />
          </label>
          <label>
            Пол
            <select
              value={form.gender}
              onChange={(e) =>
                setForm({ ...form, gender: e.target.value as '' | 'male' | 'female' })
              }
              required
            >
              <option value="">Выберите пол</option>
              <option value="male">{USER_GENDER_LABELS.male}</option>
              <option value="female">{USER_GENDER_LABELS.female}</option>
            </select>
          </label>
          <label>
            Город
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Москва"
              maxLength={50}
            />
          </label>
          <label>
            О себе
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Расскажите о себе..."
              maxLength={500}
              rows={4}
            />
          </label>
          <div className="profile-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
