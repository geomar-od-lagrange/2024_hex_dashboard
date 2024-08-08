/* global fetch */
import React, {useState, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {Map} from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import {GeoJsonLayer} from '@deck.gl/layers';
import {scaleThreshold} from 'd3-scale';

import type {Color, PickingInfo, MapViewState} from '@deck.gl/core';
import type {Feature, Polygon, MultiPolygon} from 'geojson';


// Source data GeoJSON
const DATA_URL ='./hex_features.geojson'; // eslint-disable-line
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json'

export const COLOR_SCALE_CONNECTED = scaleThreshold<number, Color>()
  .domain([0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45])
  .range([
    [255,255,217,200],
    [237,248,177,200],
    [199,233,180,200],
    [127,205,187,200],
    [65,182,196,200],
    [29,145,192,200],
    [34,94,168,200],
    [37,52,148,200],
    [8,29,88,200]
  ]);

  export const COLOR_SCALE_SELECTED = scaleThreshold<number, Color>()
  .domain([3, 6, 9, 12, 15, 18, 21, 24, 27])
  .range([
    [255,245,235,250],
    [254,230,206,250],
    [253,208,162,250],
    [253,174,107,250],
    [253,141,60,250],
    [241,105,19,250],
    [217,72,1,250],
    [166,54,3,250],
    [127,39,4,250],
  ]);

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 10,
  latitude: 50.7,
  zoom: 3,
  maxZoom: 15,
  pitch: 30,
  bearing: 30
};

interface Dictionary<T> {
  [Key: string]: T;
}

type FeatureProperties = {
  id: number;
  lat: number;
  lon: number;
  depth: number;
  rest: boolean;
  substrate: string;
  disease: boolean;
  connectivity: Dictionary<number>;
  // connectivity: Array<string>;
  number_affected?: number;
  dilution?: number;
};

type Shape = Feature<Polygon | MultiPolygon, FeatureProperties>;

function setSelectedShape(nextSelectShape?: Shape | undefined) {
  if (!nextSelectShape) {
    return null;
  }
  let selected: Shape[] = [nextSelectShape]
  selected.map(element => {
    // element.properties.number_affected = element.properties.connectivity["toID"].length
    element.properties.number_affected = Object.keys(element.properties.connectivity).length

  })
  return selected;
}

function setConnectedShape(selectedShape?: Shape, data?: Shape[]) {
  let connected_shapes: Shape[] = undefined
  if (!selectedShape) {
    return null
  }
  // let connected_ids = selectedShape.properties.connectivity["toID"]
  let connected_ids = Object.keys(selectedShape.properties.connectivity).map(Number)
  // let connected_weights = selectedShape.properties.connectivity["weight"]
  // console.log("This element: ", selectedShape.properties.id, " connected with ", connected_ids)
  connected_shapes = data.filter((element) => connected_ids.includes(element.properties.id))
  connected_shapes.map(element => {
    element.properties.dilution = selectedShape.properties.connectivity[element.properties.id]
  })
  return connected_shapes
}

function getTooltip({object, layer}: PickingInfo<Shape>) {
  if (!object) return null;

  const TOOLTIP_BASE = `\
    ID: ${object.properties.id}
    Position: ${object.properties.lat} N, ${object.properties.lon} E
    Depth: ${object.properties.depth} m
    Restoration: ${Boolean(object.properties.rest)}
    Substrate: ${object.properties.substrate}
    Disease: ${Boolean(object.properties.disease)}
  `;

  const TOOLTIP_SELECTED = TOOLTIP_BASE + `\
    Number affected: ${object.properties.number_affected}
  `;

  const TOOLTIP_CONNECTED = TOOLTIP_BASE + `\
    Dilution: ${object.properties.dilution}
  `;

  if (layer.id == 'base') {
    return object && TOOLTIP_BASE
  }
  else if (layer.id == "selected") {
      return object && TOOLTIP_SELECTED
  }
  else if (layer.id == "connected") {
      return object && TOOLTIP_CONNECTED
  }
}


/* eslint-disable react/no-deprecated */
export default function App({
  data,
  mapStyle = MAP_STYLE
}: {
  data?: Shape[];
  mapStyle?: string;
}) {
  const [nextSelectedShape, setNextSelectedShape] = useState<Shape>();
  const selectedShape = useMemo(() => setSelectedShape(nextSelectedShape), [nextSelectedShape]);
  const connectedShape = useMemo(() => setConnectedShape(nextSelectedShape, data), [nextSelectedShape, data]);

  const layers = [
    new GeoJsonLayer<FeatureProperties>({
      id: 'base',
      data,
      stroked: true,
      filled: true,
      getFillColor: [150, 150, 150, 150],
      getLineColor: [200, 200, 200, 250],
      // getLineColor: [50, 50, 50, 250],
      getLineWidth: 10000,
      onClick: ({object}) => setNextSelectedShape(object),
      pickable: true
    }),
    new GeoJsonLayer<FeatureProperties>({
      id: 'selected',
      data: selectedShape,
      stroked: true,
      filled: true,
      getFillColor: d => COLOR_SCALE_SELECTED(d.properties.number_affected),
      pickable: true,
      extruded: true,
      getElevation: d => d.properties.number_affected * 100000 // adjust scaling
    }),
    new GeoJsonLayer<FeatureProperties>({
      id: 'connected',
      data: connectedShape,
      stroked: true,
      filled: true,
      getFillColor: d => COLOR_SCALE_CONNECTED(d.properties.dilution),
      onClick: ({object}) => setNextSelectedShape(object),
      pickable: true,
      extruded: true,
      getElevation: d => d.properties.dilution * 1000000 // adjust scaling
    })
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
