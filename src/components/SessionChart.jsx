import { useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';

export default function SessionChart({
  timeline,
  burnoutTick = -1,
  showReferenceLine = true,
  height = 300,
  title,
  compact = false,
}) {
  const uid = useId();
  const fg = `flow-${uid}`, dg = `dist-${uid}`, ftg = `fat-${uid}`, rg = `rec-${uid}`;

  if (!timeline || timeline.length === 0) return null;

  const pct = v => (v * 100).toFixed(1) + '%';
  const yt = v => Math.round(v * 100) + '%';
  const bl = burnoutTick >= 0 && burnoutTick < timeline.length ? timeline[burnoutTick].timeLabel : null;

  return (
    <div className={`bg-mindflow-surface border border-mindflow-border rounded-xl ${compact ? 'p-3' : 'p-4'}`}>
      {title && (
        <h3 className={`font-medium text-mindflow-heading ${compact ? 'text-xs mb-2' : 'text-sm mb-3'}`}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={fg} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7eb8a0" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#7eb8a0" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id={dg} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e0b870" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#e0b870" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id={ftg} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4786e" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#d4786e" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id={rg} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7eb8a0" stopOpacity={0.60} />
              <stop offset="100%" stopColor="#7eb8a0" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timeLabel"
            stroke="#6b6b80"
            fontSize={compact ? 10 : 11}
            tickLine={false}
            axisLine={false}
            interval={compact ? 4 : 2}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={yt}
            stroke="#6b6b80"
            fontSize={compact ? 10 : 11}
            tickLine={false}
            axisLine={false}
            width={compact ? 32 : 40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a24', border: '1px solid #2a2a38',
              borderRadius: '8px', fontSize: '12px', color: '#f0f0f8',
            }}
            formatter={pct}
            labelStyle={{ color: '#c4c4d0', marginBottom: '4px' }}
          />
          {!compact && (
            <Legend
              wrapperStyle={{ color: '#c4c4d0', fontSize: '12px', paddingTop: '8px' }}
              iconType="circle"
            />
          )}
          {/* Recovery drawn first so it sits at the bottom of the stack */}
          <Area type="monotone" dataKey="recovery" name="Recovery" stackId="1" stroke="#7eb8a0" fill={`url(#${rg})`} strokeWidth={compact ? 1 : 1} />
          <Area type="monotone" dataKey="fatigue" name="Fatigue" stackId="1" stroke="#d4786e" fill={`url(#${ftg})`} strokeWidth={1} />
          <Area type="monotone" dataKey="distracted" name="Distracted" stackId="1" stroke="#e0b870" fill={`url(#${dg})`} strokeWidth={1} />
          <Area type="monotone" dataKey="flow" name="Flow" stackId="1" stroke="#7eb8a0" fill={`url(#${fg})`} strokeWidth={1} />
          {showReferenceLine && bl && (
            <ReferenceLine
              x={bl}
              stroke="#d4786e"
              strokeDasharray="6 6"
              strokeWidth={2}
              label={{
                value: 'Burnout',
                position: 'top',
                fill: '#d4786e',
                fontSize: compact ? 10 : 11,
                fontWeight: 600,
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
