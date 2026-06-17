import { THEMES, type ThemeId } from '../themes';

interface ThemePickerProps {
  value: ThemeId;
  onChange: (themeId: ThemeId) => void;
  disabled?: boolean;
}

export default function ThemePicker({ value, onChange, disabled = false }: ThemePickerProps) {
  return (
    <div className="theme-picker" role="radiogroup" aria-label="Выбор темы">
      {THEMES.map((theme) => {
        const active = value === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`theme-picker-card ${active ? 'active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(theme.id)}
          >
            <span className="theme-picker-swatches" aria-hidden>
              {theme.preview.map((color) => (
                <span key={color} style={{ background: color }} />
              ))}
            </span>
            <span className="theme-picker-name">{theme.name}</span>
            <span className="theme-picker-desc">{theme.description}</span>
          </button>
        );
      })}
    </div>
  );
}
