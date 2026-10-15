import { PRESET_COLORS } from "../../lib/constants.js";

export function IconPicker({ icons, order = Object.keys(icons), value, onChange }) {
  return (
    <div className="icon-pick">
      {order.map((key) => {
        const Ico = icons[key];
        return (
          <button key={key} type="button" className={value === key ? "active" : ""} onClick={() => onChange(key)} aria-label={key}>
            <Ico size={16} />
          </button>
        );
      })}
    </div>
  );
}

export function ColorPicker({ value, onChange }) {
  return (
    <div className="color-grid">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`color-swatch ${value === c ? "active" : ""}`}
          style={{ background: c }}
          aria-label={c}
        />
      ))}
    </div>
  );
}
