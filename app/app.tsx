/* global fetch */
import React, {useState, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {Map} from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import {GeoJsonLayer, ArcLayer} from '@deck.gl/layers';
import {scaleQuantile} from 'd3-scale';

import type {Color, PickingInfo, MapViewState} from '@deck.gl/core';
import type {Feature, Polygon, MultiPolygon} from 'geojson';

// Source data GeoJSON
const DATA_URL =
  './features.geojson'; // eslint-disable-line

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 10,
  latitude: 50.7,
  zoom: 3,
  maxZoom: 15,
  pitch: 30,
  bearing: 30
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';

type FeatureProperties = {
  name: string;
  connectivity: Record<string, number>;
};

type Shape = Feature<Polygon | MultiPolygon, FeatureProperties>;

type Connectivity = {
  source: Shape;
  target: Shape;
  value: number;
};

function selectShapes(data: Shape[] | undefined, selectShape?: Shape) {
  if (!data || !data.length) {
    return null;
  }
  if (!selectShape) {
    selectShape = data.find(f => f.properties.name === 'A')!;
  }
  const {connectivity} = selectShape.properties;

  const selected: Shape[] = Object.keys(connectivity).map(toId => {
    const f = data[Number(toId)];
    return data[Number(toId)]
  });

  return selected;
}

function getTooltip({object}: PickingInfo<Shape>) {
  return object && object.properties.name;
}

/* eslint-disable react/no-deprecated */
export default function App({
  data,
  mapStyle = MAP_STYLE
}: {
  data?: Shape[];
  mapStyle?: string;
}) {
  const [selectedShape, selectShape] = useState<Shape>();

  const selected = useMemo(() => selectShapes(data, selectedShape), [data, selectedShape]);

  const layers = [
    new GeoJsonLayer<FeatureProperties>({
      id: 'geojson',
      data,
      stroked: true,
      filled: true,
      getFillColor: [75, 5, 75, 75],
      onClick: ({object}) => selectShape(object),
      pickable: true
    }),
    new GeoJsonLayer<FeatureProperties>({
      id: 'selected',
      data: selected,
      stroked: true,
      filled: true,
      getFillColor: [15, 95, 15, 175],
      // onClick: ({object}) => selectShape(object),
      pickable: false
    })
    // new ArcLayer<Connectivity>({
    //   id: 'arc',
    //   data: arcs,
    //   getSourcePosition: d => d.source.properties.centroid,
    //   getTargetPosition: d => d.target.properties.centroid,
    //   getSourceColor: d => (d.value > 0 ? inFlowColors : outFlowColors)[d.quantile],
    //   getTargetColor: d => (d.value > 0 ? outFlowColors : inFlowColors)[d.quantile],
    //   getWidth: strokeWidth
    // })
  ];

  return (
    <DeckGL
      layers={layers}
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      getTooltip={getTooltip}
    >
      <Map reuseMaps mapStyle={mapStyle} />
    </DeckGL>
  );
}

export async function renderToDOM(container: HTMLDivElement) {
  const root = createRoot(container);
  root.render(<App />);

  const resp = await fetch(DATA_URL);
  const {features} = await resp.json();
  root.render(<App data={features} />);
}
