interface ToggleSwitchProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function ToggleSwitch({ id, label, checked, onChange }: ToggleSwitchProps) {
  return (
    <label className="toggle-switch" htmlFor={id}>
      <span className="toggle-switch-label">{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-switch-track" aria-hidden />
    </label>
  );
}
