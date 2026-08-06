import { LANGUAGES, getStoredLang, setStoredLang } from '../utils/i18n.js';

const ACCENT_COLORS = [
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Blue',   hex: '#3b82f6' },
  { name: 'Green',  hex: '#22c55e' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Pink',   hex: '#ec4899' },
  { name: 'Cyan',   hex: '#06b6d4' },
];

export default function SettingsPanel({ settings, onSettingsChange, onReset, lang, onLangChange, theme, onThemeChange, accent, onAccentChange }) {
  return (
    <div className="bg-mindflow-surface border-b border-mindflow-border px-6 py-4 animate-fade-in">
      <div className="max-w-2xl mx-auto space-y-4 text-sm">
        {/* Language */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-mindflow-muted text-xs w-20 shrink-0">Language</span>
          <select
            value={lang}
            onChange={e => { onLangChange(e.target.value); setStoredLang(e.target.value); }}
            className="bg-mindflow-bg border border-mindflow-border rounded-lg px-3 py-1.5 text-mindflow-text text-xs focus:border-mindflow-accent focus:outline-none"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.native} — {l.label}</option>
            ))}
          </select>
        </div>

        {/* Theme */}
        <div className="flex items-center gap-2">
          <span className="text-mindflow-muted text-xs w-20 shrink-0">Color Theme</span>
          {['dark', 'light'].map(t => (
            <button
              key={t}
              onClick={() => onThemeChange(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${theme === t ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-text hover:bg-mindflow-border'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Accent Color */}
        <div className="flex items-center gap-2">
          <span className="text-mindflow-muted text-xs w-20 shrink-0">Accent</span>
          <div className="flex gap-1.5">
            {ACCENT_COLORS.map(c => (
              <button
                key={c.hex}
                onClick={() => onAccentChange(c.hex)}
                className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                style={{
                  backgroundColor: c.hex,
                  borderColor: accent === c.hex ? '#fff' : 'transparent',
                  boxShadow: accent === c.hex ? '0 0 0 2px ' + c.hex + '40' : 'none',
                }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Chronotype */}
        <div className="flex items-center gap-2">
          <span className="text-mindflow-muted text-xs w-20 shrink-0">Chronotype</span>
          {['morning', 'neutral', 'night'].map(c => (
            <button
              key={c}
              onClick={() => onSettingsChange({ ...settings, chronotype: c })}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${settings.chronotype === c ? 'bg-mindflow-accent text-white' : 'bg-mindflow-bg text-mindflow-text hover:bg-mindflow-border'}`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Daily hours */}
        <div className="flex items-center gap-4">
          <span className="text-mindflow-muted text-xs w-20 shrink-0">Hours/day</span>
          <div className="flex items-center gap-2">
            <span className="text-mindflow-muted text-[10px]">Weekday</span>
            <input
              type="number" value={settings.maxHoursPerDay} min={1} max={16}
              onChange={e => onSettingsChange({ ...settings, maxHoursPerDay: Number(e.target.value) })}
              className="w-14 bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-1 text-mindflow-text text-xs focus:border-mindflow-accent focus:outline-none"
            />
            <span className="text-mindflow-muted text-[10px] ml-2">Weekend</span>
            <input
              type="number" value={settings.maxHoursWeekend} min={0} max={12}
              onChange={e => onSettingsChange({ ...settings, maxHoursWeekend: Number(e.target.value) })}
              className="w-14 bg-mindflow-bg border border-mindflow-border rounded-lg px-2 py-1 text-mindflow-text text-xs focus:border-mindflow-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Reset */}
        <div className="pt-2 border-t border-mindflow-border">
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-mindflow-danger/10 text-mindflow-danger hover:bg-mindflow-danger/20 transition-colors"
          >
            Reset All Data
          </button>
        </div>
      </div>
    </div>
  );
}
