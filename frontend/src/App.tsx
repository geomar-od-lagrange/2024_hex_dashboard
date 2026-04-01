import { useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import StaticMap from 'react-map-gl';
import maplibregl from 'maplibre-gl';
import ControlPanel, { type DepthWeights, type TimeWeights } from './ControlPanel';
import InfoBox from './InfoBox';
import { theme, type RGBA } from './theme';

// Free map styles (no API key required):
// - https://tiles.openfreemap.org/styles/positron (minimal light gray)
// - https://tiles.openfreemap.org/styles/liberty (balanced, clean)
// - https://tiles.openfreemap.org/styles/bright (similar to liberty)
// - https://tiles.openfreemap.org/styles/dark (dark theme)
// - https://demotiles.maplibre.org/style.json (original colorful demo)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export type ConnDirection = 'downstream' | 'upstream';

type Connection = {
  end_id: number;
  weight: number;
  raw_weight?: number;
};

type SourceConnection = {
  start_id: number;
  weight: number;
  raw_weight?: number;
};

interface Metadata {
  id: number;
  lon: number;
  lat: number;
  depth: number;
  disease: number;
  rest: number;
  aqc: number;
  pop: number;
  his: number;
  habitable: number;
}

interface FeatureProperties {
  id: number;
}

interface Feature {
  type: 'Feature';
  properties: FeatureProperties;
  geometry: any; // GeoJSON geometry
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

function App() {
  const [depthWeights, setDepthWeights] = useState<DepthWeights>({ '05m': 1, '10m': 1, '15m': 1 });
  const [timeWeights, setTimeWeights] = useState<TimeWeights>({ '00d-07d': 1, '07d-14d': 1, '14d-28d': 1 });
  const [feature, setFeature] = useState<FeatureCollection | null>(null);
  const [metadata, setMetadata] = useState<Record<number, Metadata> | null>(null);

  // TODO: Consolidate state management into single reducer or state object
  // Current fragmented state should be refactored for better maintainability
  
  const [isAQCHighlighted, setAQC] = useState<boolean>(true);
  const [isRestHighlighted, setRest] = useState<boolean>(true);
  const [isDiseaseHighlighted, setDisease] = useState<boolean>(true);
  const [isHabitableShown, setHabitable] = useState<boolean>(true);
  const [isHistoricHighlighted, setHistoric] = useState<boolean>(true);
  
  const [direction, setDirection] = useState<ConnDirection>('downstream');
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [clickIds, setClickIds] = useState<number[]>([]);
  const [tooltip, setTooltip] = useState<{x: number; y: number; content: string} | null>(null);

  // Derive depth params for API
  const activeDepths = Object.entries(depthWeights).filter(([, w]) => w > 0);
  const depthTotal   = activeDepths.reduce((s, [, w]) => s + w, 0);
  const depthParam   = activeDepths.map(([d]) => d).join(',');
  const depthWeightParam = activeDepths.map(([, w]) => (w / depthTotal).toFixed(4)).join(',');

  // Derive time params for API
  const activeTimes  = Object.entries(timeWeights).filter(([, w]) => w > 0);
  const timeTotal    = activeTimes.reduce((s, [, w]) => s + w, 0);
  const timeParam    = activeTimes.map(([t]) => t).join(',');
  const timeWeightParam = activeTimes.map(([, w]) => (w / timeTotal).toFixed(4)).join(',');

  //fetch geojson features for display
  useEffect(() => {
    fetch(`api/feature`)
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(data => {
        const geojson = data.type === 'FeatureCollection'
          ? data
          : { type: 'FeatureCollection', features: [data] };
        setFeature(geojson);
      })
      .catch(console.error);
    
    fetch(`api/metadata`)
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then(data => {
        setMetadata(Object.fromEntries(data.map((m: Metadata) => [m.id, m])));
      })
      .catch(console.error);  
  }, []);
  
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const initialViewState = {
    longitude: 1,
    latitude: 55.0,
    zoom: 5,
    pitch: 45,
    bearing: 0
  };

  const [connections, setConnections] = useState<Connection[]>([]);
  const [sourceConnections, setSourceConnections] = useState<SourceConnection[]>([]);

  // Downstream fetch
  useEffect(() => {
    if (direction !== 'downstream' || !clickIds?.length || !depthParam || !timeParam) {
      setConnections([]);
      return;
    }
    const ctrl = new AbortController();
    const fetchURL = `api/connectivity?depth=${depthParam}&depth_weight=${depthWeightParam}&time_range=${timeParam}&time_weight=${timeWeightParam}&start_id=${clickIds.join(',')}`;
    console.log('Trying to fetch:', fetchURL);
    (async () => {
      try {
        const res = await fetch(fetchURL, { signal: ctrl.signal });
        if (!res.ok) throw new Error(res.statusText);
        const data: Connection[] = await res.json();
        setConnections(data);
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error('Fetch error:', e);
      }
    })();
    return () => ctrl.abort();
  }, [clickIds, timeParam, timeWeightParam, depthParam, depthWeightParam, direction]);

  // Upstream fetch
  useEffect(() => {
    if (direction !== 'upstream' || !clickIds?.length || !depthParam || !timeParam) {
      setSourceConnections([]);
      return;
    }
    const ctrl = new AbortController();
    const fetchURL = `api/connectivity-sources?depth=${depthParam}&depth_weight=${depthWeightParam}&time_range=${timeParam}&time_weight=${timeWeightParam}&end_id=${clickIds.join(',')}&habitable=${isHabitableShown}`;
    console.log('Trying to fetch:', fetchURL);
    (async () => {
      try {
        const res = await fetch(fetchURL, { signal: ctrl.signal });
        if (!res.ok) throw new Error(res.statusText);
        const data: SourceConnection[] = await res.json();
        setSourceConnections(data);
      } catch (e: any) {
        if (e.name !== 'AbortError') console.error('Fetch error:', e);
      }
    })();
    return () => ctrl.abort();
  }, [clickIds, timeParam, timeWeightParam, depthParam, depthWeightParam, direction, isHabitableShown]);

  const clearHex = () => {
    setClickIds([]);
    setConnections([]);
    setSourceConnections([]);
  }

  // Derive weights from the active direction's connections
  const weightMap = useMemo(() => {
    if (direction === 'downstream')
      return new Map<number, number>(connections.map(c => [c.end_id, c.weight]));
    return new Map<number, number>(sourceConnections.map(c => [c.start_id, c.weight]));
  }, [direction, connections, sourceConnections]);

  const rawWeightMap = useMemo(() => {
    if (direction === 'downstream')
      return new Map<number, number>(connections.filter(c => c.raw_weight != null).map(c => [c.end_id, c.raw_weight!]));
    return new Map<number, number>(sourceConnections.filter(c => c.raw_weight != null).map(c => [c.start_id, c.raw_weight!]));
  }, [direction, connections, sourceConnections]);

  // Visual state for each hex — single source of truth for elevation and color.
  // Separates rendering concerns from raw data (rawWeightMap is used only for tooltips).
  //
  //  connected        – in weightMap, shown with weight-based elevation + color
  //  connected-dimmed – in weightMap but non-habitable in downstream+habitable mode
  //                     shown flat with a de-saturated color (de-emphasised target)
  //  excluded         – NOT in weightMap, non-habitable, upstream+habitable ON
  //                     shown flat in light gray (excluded from the calculation)
  //  dimmed           – NOT in weightMap, non-habitable, downstream+habitable ON
  //                     shown flat in dark gray (deep/uninhabitable area)
  type HexDisplayState =
    | { kind: 'connected';        weight: number }
    | { kind: 'connected-dimmed'; weight: number }
    | { kind: 'excluded' }
    | { kind: 'dimmed' };

  const hexDisplayMap = useMemo(() => {
    const map = new Map<number, HexDisplayState>();
    if (!metadata) return map;

    const isNonHabitable = (id: number) => {
      const m = metadata[id];
      return m != null && m.habitable == 0;
    };

    // Pass 1: all hexes in weightMap
    for (const [id, w] of weightMap) {
      if (isNonHabitable(id) && isHabitableShown && direction === 'downstream') {
        map.set(id, { kind: 'connected-dimmed', weight: w });
      } else {
        map.set(id, { kind: 'connected', weight: w });
      }
    }

    // Pass 2: non-habitable unconnected hexes when habitable filter is on
    if (isHabitableShown) {
      for (const idKey of Object.keys(metadata)) {
        const id = Number(idKey);
        if (map.has(id)) continue;
        if (isNonHabitable(id)) {
          map.set(id, direction === 'upstream' ? { kind: 'excluded' } : { kind: 'dimmed' });
        }
      }
    }

    return map;
  }, [weightMap, metadata, isHabitableShown, direction]);

  // Helper: add z-coordinate to all positions in a geometry
  const addZToGeometry = (geometry: any, z: number): any => {
    const addZ = (coords: any): any => {
      if (typeof coords[0] === 'number') {
        // It's a position [lon, lat] or [lon, lat, z]
        return [coords[0], coords[1], z];
      }
      return coords.map(addZ);
    };
    return { ...geometry, coordinates: addZ(geometry.coordinates) };
  };

  // Helper: create feature with z-coordinate
  const featureWithZ = (f: Feature, z: number): Feature => ({
    ...f,
    geometry: addZToGeometry(f.geometry, z),
  });

  // Calculate connectivity height for a hex (used to stack category layers)
  const getConnHeight = (id: number) => {
    const state = hexDisplayMap.get(id);
    if (!state || state.kind !== 'connected') return 0;
    return theme.elevation.getElevation(state.weight);
  };

  // Common layer properties
  const commonLayerProps = {
    filled: true,
    stroked: true,
    extruded: true,
    wireframe: false,
    getLineColor: theme.stroke.default,
    getLineWidth: 1,
    lineWidthMinPixels: 3,
    // High ambient reduces side-face darkening and limits hue shift from directional light
    material: { ambient: 0.7, diffuse: 0.3, shininess: 0, specularColor: [0, 0, 0] as [number, number, number] },
  };

  // Shared hover handler for all layers (base + category)
  const handleHover = (info: any) => {
    setHoveredId(info.object ? info.object.properties.id : null);
    if (info.object) {
      if (!metadata) return;
      const escapeHtml = (str: string | number) =>
        String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const data = metadata[info.object.properties.id];
      if (!data) return;
      const rawWeight = rawWeightMap.get(info.object.properties.id);
      const concLine = (() => {
        if (rawWeight == null || rawWeight <= 0) return direction === 'upstream' ? 'source contrib 0%' : 'rel conc 0';
        if (direction === 'upstream') {
          return `source contrib ${(rawWeight * 100).toFixed(2)}%`;
        }
        const exp = Math.floor(Math.log10(rawWeight));
        const mantissa = rawWeight / Math.pow(10, exp);
        return `rel conc ${mantissa.toFixed(2)} \u00b7 10<sup>${exp}</sup>`;
      })();
      const categories = [
        data.disease > 0 && 'outbreak',
        data.aqc     > 0 && 'aquaculture',
        data.rest    > 0 && 'restoration',
        data.his     > 0 && 'historic',
      ].filter(Boolean) as string[];
      const split = Math.ceil(categories.length / 2);
      const catLine1 = categories.slice(0, split).join(' · ') || '\u00a0';
      const catLine2 = categories.slice(split).join(' · ') || '\u00a0';
      const lines = [
        concLine,
        catLine1,
        catLine2,
        `${Math.abs(data.lat).toFixed(1)}\u00b0${data.lat < 0 ? 'S' : 'N'} ${Math.abs(data.lon).toFixed(1)}\u00b0${data.lon < 0 ? 'W' : 'E'} \u00b7 ${data.depth} m`,
        `hex ${escapeHtml(data.id)}`,
      ];
      setTooltip({
        x: info.x,
        y: info.y,
        content: lines.join('\n'),
      });
    } else {
      setHoveredId(null);
      setTooltip(null);
    }
  };

  // Shared click handler for all layers
  const handleClick = (info: any) => {
    if (!info.object) return;
    if (clickIds.indexOf(info.object.properties.id) === -1) {
      setClickIds([...clickIds, info.object.properties.id]);
    } else {
      setClickIds(prev => prev.filter(x => x !== info.object.properties.id));
    }
  };

  // Interaction handlers for all layers
  const interactionHandlers = {
    pickable: true,
    onHover: handleHover,
    onClick: handleClick,
  };

  const catHeight = theme.elevation.categoryHeight;

  // Build layers: Connectivity at base, then HISTORIC, REST, AQC, OUTBREAK stacked on top
  const layers = feature
    ? [
        // Layer 1: Base/Connectivity - z=0, height=weight-based or default
        new GeoJsonLayer({
          id: 'connectivity-layer',
          data: feature,
          ...commonLayerProps,
          ...interactionHandlers,
          updateTriggers: {
            getFillColor: [hexDisplayMap, hoveredId],
            getElevation: [hexDisplayMap],
          },
          getElevation: (d: any) => {
            const state = hexDisplayMap.get(d.properties.id);
            if (!state || state.kind !== 'connected') return 0;
            return theme.elevation.getElevation(state.weight);
          },
          getFillColor: (d: any) => {
            const id = d.properties.id;
            if (id === hoveredId) return theme.hex.hovered;
            const state = hexDisplayMap.get(id);
            if (!state) return theme.hex.default;
            switch (state.kind) {
              case 'connected':
                return theme.hex.getWeightColor(state.weight);
              case 'connected-dimmed': {
                // connected but non-habitable target (downstream+habitable): flat, de-saturated
                const c = theme.hex.getWeightColor(state.weight);
                return [Math.round(c[0]*0.4+150*0.6), Math.round(c[1]*0.4+150*0.6), Math.round(c[2]*0.4+150*0.6), 180] as RGBA;
              }
              case 'excluded':
                // upstream+habitable: non-habitable source excluded from calc, shown flat in light gray
                return [180, 180, 180, 220] as RGBA;
              case 'dimmed':
                // downstream+habitable: non-habitable area, shown flat in dark gray
                return [90, 90, 90, 200] as RGBA;
            }
          },
        }),

        // Layer 2: HISTORIC - stacked on top of connectivity
        ...(isHistoricHighlighted && metadata ? [new GeoJsonLayer({
          id: 'historic-layer',
          data: {
            type: 'FeatureCollection',
            features: feature.features
              .filter((f: Feature) => metadata[f.properties.id]?.his > 0)
              .map((f: Feature) => featureWithZ(f, getConnHeight(f.properties.id))),
          },
          ...commonLayerProps,
          ...interactionHandlers,
          updateTriggers: { data: [hexDisplayMap], getFillColor: [hoveredId] },
          getElevation: catHeight,
          getFillColor: (d: any) => d.properties.id === hoveredId ? theme.hex.hovered : theme.highlight.historic,
        })] : []),

        // Layer 3: REST - stacked on top of historic
        ...(isRestHighlighted && metadata ? [new GeoJsonLayer({
          id: 'rest-layer',
          data: {
            type: 'FeatureCollection',
            features: feature.features
              .filter((f: Feature) => metadata[f.properties.id]?.rest > 0)
              .map((f: Feature) => {
                const id = f.properties.id;
                const baseZ = getConnHeight(id) + (isHistoricHighlighted && metadata[id]?.his > 0 ? catHeight : 0);
                return featureWithZ(f, baseZ);
              }),
          },
          ...commonLayerProps,
          ...interactionHandlers,
          updateTriggers: { data: [hexDisplayMap, isHistoricHighlighted], getFillColor: [hoveredId] },
          getElevation: catHeight,
          getFillColor: (d: any) => d.properties.id === hoveredId ? theme.hex.hovered : theme.highlight.restoration,
        })] : []),

        // Layer 4: AQC - stacked on top of REST
        ...(isAQCHighlighted && metadata ? [new GeoJsonLayer({
          id: 'aqc-layer',
          data: {
            type: 'FeatureCollection',
            features: feature.features
              .filter((f: Feature) => metadata[f.properties.id]?.aqc > 0)
              .map((f: Feature) => {
                const id = f.properties.id;
                const data = metadata[id];
                const baseZ = getConnHeight(id)
                  + (isHistoricHighlighted && data?.his > 0 ? catHeight : 0)
                  + (isRestHighlighted && data?.rest > 0 ? catHeight : 0);
                return featureWithZ(f, baseZ);
              }),
          },
          ...commonLayerProps,
          ...interactionHandlers,
          updateTriggers: { data: [hexDisplayMap, isHistoricHighlighted, isRestHighlighted], getFillColor: [hoveredId] },
          getElevation: catHeight,
          getFillColor: (d: any) => d.properties.id === hoveredId ? theme.hex.hovered : theme.highlight.aquaculture,
        })] : []),

        // Layer 5: OUTBREAK/Disease - stacked on top of AQC
        ...(isDiseaseHighlighted && metadata ? [new GeoJsonLayer({
          id: 'disease-layer',
          data: {
            type: 'FeatureCollection',
            features: feature.features
              .filter((f: Feature) => metadata[f.properties.id]?.disease > 0)
              .map((f: Feature) => {
                const id = f.properties.id;
                const data = metadata[id];
                const baseZ = getConnHeight(id)
                  + (isHistoricHighlighted && data?.his > 0 ? catHeight : 0)
                  + (isRestHighlighted && data?.rest > 0 ? catHeight : 0)
                  + (isAQCHighlighted && data?.aqc > 0 ? catHeight : 0);
                return featureWithZ(f, baseZ);
              }),
          },
          ...commonLayerProps,
          ...interactionHandlers,
          updateTriggers: { data: [hexDisplayMap, isHistoricHighlighted, isRestHighlighted, isAQCHighlighted], getFillColor: [hoveredId] },
          getElevation: catHeight,
          getFillColor: (d: any) => d.properties.id === hoveredId ? theme.hex.hovered : theme.highlight.disease,
        })] : []),

        // Layer 6: SELECTED - one catHeight above all category layers
        ...(clickIds.length > 0 && metadata ? [new GeoJsonLayer({
          id: 'selected-layer',
          data: {
            type: 'FeatureCollection',
            features: feature.features
              .filter((f: Feature) => clickIds.includes(f.properties.id))
              .map((f: Feature) => {
                const id = f.properties.id;
                const data = metadata[id];
                const baseZ = getConnHeight(id)
                  + (isHistoricHighlighted && (data?.his ?? 0) > 0 ? catHeight : 0)
                  + (isRestHighlighted     && (data?.rest ?? 0) > 0 ? catHeight : 0)
                  + (isAQCHighlighted      && (data?.aqc ?? 0) > 0 ? catHeight : 0)
                  + (isDiseaseHighlighted  && (data?.disease ?? 0) > 0 ? catHeight : 0);
                return featureWithZ(f, baseZ);
              }),
          },
          ...commonLayerProps,
          ...interactionHandlers,
          updateTriggers: { data: [hexDisplayMap, clickIds, isHistoricHighlighted, isRestHighlighted, isAQCHighlighted, isDiseaseHighlighted], getFillColor: [hoveredId] },
          getElevation: catHeight,
          getFillColor: (d: any) => d.properties.id === hoveredId ? theme.hex.hovered : theme.highlight.selected,
        })] : []),
      ]
    : [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <DeckGL
        initialViewState={initialViewState}
        controller
        layers={layers}
        style={{ position: 'absolute', top: '0px', left: '0px', width: '100vw', height: '100vh', overscrollBehavior: 'none', }}
      >
        <StaticMap reuseMaps mapLib={maplibregl as any} mapStyle={MAP_STYLE} />
      </DeckGL>

      <div
        className="control-panel-container"
        style={{
          '--panel-font-size': theme.panel.fontSize,
          '--panel-border-radius': theme.panel.borderRadius,
          '--panel-box-shadow': theme.panel.boxShadow,
          '--panel-padding': theme.panel.padding,
          background: theme.ui.controlPanel.background,
          color: theme.ui.controlPanel.text,
        } as React.CSSProperties}
      >
        <ControlPanel
          depthWeights={depthWeights}
          onDepthWeightsChange={setDepthWeights}
          timeWeights={timeWeights}
          onTimeWeightsChange={setTimeWeights}
          clearHex={clearHex}
          isAQCHighlighted={isAQCHighlighted}
          onAQCChange={setAQC}
          isRestHighlighted={isRestHighlighted}
          onRestChange={setRest}
          isDiseaseHighlighted={isDiseaseHighlighted}
          onDiseaseChange={setDisease}
          isHabitableShown={isHabitableShown}
          onHabitableChange={setHabitable}
          isHistoricHighlighted={isHistoricHighlighted}
          onHistoricChange={setHistoric}
          direction={direction}
          onDirectionChange={setDirection}
        />
      </div>

      <div
        className="info-box-container"
        style={{
          '--panel-font-size': theme.panel.fontSize,
          '--panel-border-radius': theme.panel.borderRadius,
          '--panel-box-shadow': theme.panel.boxShadow,
          '--panel-padding': theme.panel.padding,
          background: theme.ui.infoBox.background,
          color: theme.ui.infoBox.text,
        } as React.CSSProperties}
      >
        <InfoBox />
      </div>

    {tooltip && (
      <div
        style={{
          position: "absolute",
          left: tooltip.x + 10,
          top: tooltip.y + 10,
          zIndex: 2,
          pointerEvents: "none",
          background: theme.ui.tooltip.background,
          color: theme.ui.tooltip.text,
          padding: theme.ui.tooltip.padding,
          borderRadius: theme.ui.tooltip.borderRadius,
          fontSize: theme.ui.tooltip.fontSize,
          maxWidth: theme.ui.tooltip.maxWidth,
          boxShadow: theme.ui.tooltip.boxShadow,
          whiteSpace: "pre",
          overscrollBehavior: 'none',
        }}
        dangerouslySetInnerHTML={{ __html: tooltip.content }}
      />
    )}
    </div>
  );
}

export default App;

