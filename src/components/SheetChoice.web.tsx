/** Website: a real dropdown sitting exactly on the sheet's box. */
export function SheetChoice({
  value,
  options,
  fontSize,
  onChange,
  label,
}: {
  value: string;
  options: string[];
  fontSize: number;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={options.includes(value) ? value : ' '}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        height: '100%',
        fontSize,
        fontWeight: 700,
        textAlign: 'center',
        textAlignLast: 'center',
        color: '#0B3D91',
        background: value.trim() ? 'rgba(66,133,244,0.10)' : 'rgba(66,133,244,0.05)',
        border: 'none',
        padding: 0,
        margin: 0,
        appearance: 'none',
        WebkitAppearance: 'none',
        cursor: 'pointer',
      }}
    >
      {options.map((o, i) => (
        <option key={i} value={o}>
          {o.trim() ? o : ' '}
        </option>
      ))}
    </select>
  );
}
