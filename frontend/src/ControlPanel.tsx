import * as React from "react";
import { theme } from "./theme";
import type { ConnDirection } from "./App";

// relative weight per key (0 = excluded)
export type DepthWeights = Record<string, number>;
export type TimeWeights  = Record<string, number>;

interface ControlPanelProps {
  depthWeights: DepthWeights;
  onDepthWeightsChange: (w: DepthWeights) => void;
  timeWeights: TimeWeights;
  onTimeWeightsChange: (w: TimeWeights) => void;
  clearHex?: (payload: { depths: string[]; times: string[] }) => void;
  isAQCHighlighted: boolean;
  onAQCChange: (newAQC: boolean) => void;
  isRestHighlighted: boolean;
  onRestChange: (newRest: boolean) => void;
  isDiseaseHighlighted: boolean;
  onDiseaseChange: (newDisease: boolean) => void;
  isHabitableShown: boolean;
  onHabitableChange: (v: boolean) => void;
  isHistoricHighlighted: boolean;
  onHistoricChange: (v: boolean) => void;
  direction: ConnDirection;
  onDirectionChange: (d: ConnDirection) => void;
}

const depths = [
  { value: "05m",     label: "5 meters" },
  { value: "10m",     label: "10 meters" },
  { value: "15m",     label: "15 meters" },
];
const times = [
  { value: "00d-07d", label: "0–7 days" },
  { value: "07d-14d", label: "7–14 days" },
  { value: "14d-28d", label: "14–28 days" },
];

export default function ControlPanel({
  depthWeights,
  onDepthWeightsChange,
  timeWeights,
  onTimeWeightsChange,
  clearHex,
  isAQCHighlighted,
  onAQCChange,
  isRestHighlighted,
  onRestChange,
  isDiseaseHighlighted,
  onDiseaseChange,
  isHabitableShown,
  onHabitableChange,
  isHistoricHighlighted,
  onHistoricChange,
  direction,
  onDirectionChange,
}: ControlPanelProps) {
  const [collapsed, setCollapsed] = React.useState(() => window.innerWidth <= 480);

  const depthTotal = Object.values(depthWeights).reduce((s, v) => s + v, 0);
  const depthPct = (value: string) =>
    depthTotal > 0 ? Math.round((depthWeights[value] ?? 0) / depthTotal * 100) : 0;

  const handleDepthSlider = (value: string, raw: number) => {
    onDepthWeightsChange({ ...depthWeights, [value]: raw });
  };

  const timeTotal = Object.values(timeWeights).reduce((s, v) => s + v, 0);
  const timePct = (value: string) =>
    timeTotal > 0 ? Math.round((timeWeights[value] ?? 0) / timeTotal * 100) : 0;

  const handleTimeSlider = (value: string, raw: number) => {
    onTimeWeightsChange({ ...timeWeights, [value]: raw });
  };

  const stopScroll = (e: React.WheelEvent | React.TouchEvent) => {
    e.preventDefault();
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          background: "transparent",
          border: "none",
          color: theme.ui.controlPanel.text,
          fontSize: 12,
          lineHeight: 1,
          cursor: "pointer",
          padding: 0,
        }}
        title="Show controls"
      >
        Controls
      </button>
    );
  }

  return (
    <div
      onWheel={stopScroll}
      onTouchMove={stopScroll}
      style={{
        overscrollBehavior: "none",
        maxHeight: "100%",
      }}
    >
    <fieldset className="control-panel-fieldset">
      <div className="control-panel-section control-panel-actions">
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: "transparent",
            border: "none",
            color: theme.ui.controlPanel.text,
            fontSize: 14,
            cursor: "pointer",
            padding: "2px 4px",
            lineHeight: 1,
          }}
          title="Collapse"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => clearHex?.({ depths: Object.keys(depthWeights).filter(d => depthWeights[d] > 0), times: Object.keys(timeWeights).filter(t => timeWeights[t] > 0) })}
          style={{
            background: "transparent",
            border: "none",
            color: theme.ui.controlPanel.text,
            fontSize: 12,
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}
        >
          clear
        </button>
      </div>

      <div className="control-panel-section">
        <div className="control-panel-section-label">Drifting Depth</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {depths.map(({ value, label }) => (
            <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 54, flexShrink: 0 }}>{label.replace(' meters', ' m')}</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={depthWeights[value] ?? 0}
                onChange={e => handleDepthSlider(value, Number(e.target.value))}
                style={{ flex: 1, minWidth: 0 }}
              />
              <span style={{ width: 32, textAlign: 'right', opacity: depthWeights[value] ? 1 : 0.35 }}>
                {depthPct(value)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="control-panel-section">
        <div className="control-panel-section-label">Time range</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {times.map(({ value, label }) => (
            <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 54, flexShrink: 0 }}>{label}</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={timeWeights[value] ?? 0}
                onChange={e => handleTimeSlider(value, Number(e.target.value))}
                style={{ flex: 1, minWidth: 0 }}
              />
              <span style={{ width: 32, textAlign: 'right', opacity: timeWeights[value] ? 1 : 0.35 }}>
                {timePct(value)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="control-panel-section">
        <div className="control-panel-section-label">Highlights</div>
        <div className="control-panel-section-options">
          <label className="control-panel-option">
            <input
              type="checkbox"
              name="disease"
              checked={isDiseaseHighlighted}
              onChange={(e) => onDiseaseChange(e.target.checked)}
              style={{ accentColor: theme.colors.disease }}
            />
            <span>Outbreak</span>
          </label>

          <label className="control-panel-option">
            <input
              type="checkbox"
              name="aqc"
              checked={isAQCHighlighted}
              onChange={(e) => onAQCChange(e.target.checked)}
              style={{ accentColor: theme.colors.aquaculture }}
            />
            <span>Aquaculture</span>
          </label>

          <label className="control-panel-option">
            <input
              type="checkbox"
              name="rest"
              checked={isRestHighlighted}
              onChange={(e) => onRestChange(e.target.checked)}
              style={{ accentColor: theme.colors.restoration }}
            />
            <span>Restoration</span>
          </label>

          <label className="control-panel-option">
            <input
              type="checkbox"
              name="historic"
              checked={isHistoricHighlighted}
              onChange={(e) => onHistoricChange(e.target.checked)}
              style={{ accentColor: theme.colors.historic }}
            />
            <span>Historic</span>
          </label>
        </div>
      </div>

    </fieldset>

      {/* Direction radio buttons */}
      <div className="control-panel-section" style={{ marginTop: 4 }}>
        <div className="control-panel-section-label">Direction</div>
        <div className="control-panel-section-options">
          {([
            { value: 'downstream', label: 'Downstream', sub: 'select source · see targets' },
            { value: 'upstream',   label: 'Upstream',   sub: 'select target · see sources' },
          ] as const).map(({ value, label, sub }) => (
            <label key={value} className="control-panel-option" style={{ alignItems: 'flex-start' }}>
              <input
                type="radio"
                name="direction"
                value={value}
                checked={direction === value}
                onChange={() => onDirectionChange(value)}
                style={{ marginTop: 2 }}
              />
              <span style={{ lineHeight: 1.3 }}>
                <span>{label}</span>
                <br />
                <span style={{ opacity: 0.65 }}>{sub}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Habitable toggle — separate from highlights */}
      <div className="control-panel-section" style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="habitable-toggle"
            type="checkbox"
            checked={isHabitableShown}
            onChange={(e) => onHabitableChange(e.target.checked)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          />
          <label htmlFor="habitable-toggle" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ position: 'relative', flexShrink: 0, width: 34, height: 18 }}>
              <div style={{
                position: 'absolute', inset: 0,
                backgroundColor: isHabitableShown ? '#4a9eff' : '#555',
                borderRadius: 9, transition: 'background-color .2s',
              }}>
                <div style={{
                  position: 'absolute', top: 2, width: 14, height: 14,
                  left: isHabitableShown ? 18 : 2,
                  backgroundColor: 'white', borderRadius: '50%', transition: 'left .2s',
                }} />
              </div>
            </div>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ whiteSpace: 'nowrap' }}>habitable only</div>
              <div style={{ opacity: 0.65, whiteSpace: 'nowrap' }}>(&lt; 85 m or coastal)</div>
            </div>
          </label>
        </div>
      </div>

      <div className="control-panel-section control-panel-scale-section" style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ opacity: 0.7 }}>low</span>
          <div style={{
            flex: 1,
            height: 8,
            borderRadius: 2,
            background: `linear-gradient(to right, ${theme.colorScale.join(', ')})`,
          }} />
          <span style={{ opacity: 0.7 }}>high</span>
        </div>
        <div style={{ marginTop: 3, opacity: 0.75, fontWeight: 'normal' }}>
          {direction === 'upstream' ? 'Source contribution (logarithmic scale)' : 'Relative concentration (logarithmic scale)'}
        </div>
      </div>
    </div>
  );
}

