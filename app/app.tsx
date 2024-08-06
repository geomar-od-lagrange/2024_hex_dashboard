/* global fetch */
import React, {useState, useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {Map} from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import {GeoJsonLayer} from '@deck.gl/layers';

import type {Color, PickingInfo, MapViewState} from '@deck.gl/core';
import type {Feature, Polygon, MultiPolygon} from 'geojson';


// Source data GeoJSON
const DATA_URL ='./features.geojson'; // eslint-disable-line
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 10,
  latitude: 50.7,
  zoom: 3,
  maxZoom: 15,
  pitch: 30,
  bearing: 30
};


type FeatureProperties = {
  id: number;
  name: string;
  connectivity: Array<number>;
};

type Shape = Feature<Polygon | MultiPolygon, FeatureProperties>;

function selectShapes(selectShape?: Shape | undefined) {
  let selected: Shape[] = [selectShape]

  if (selectShape) {
    selectShape.properties.name = "S" + selectShape.properties.name
  }

  if (!selected) {
    return [];
  }

  return selected;
}

function selectConnectedShapes(selectedShape?: Shape | undefined, data?: Shape[]) {
  let connected_shapes: Shape[] = undefined

  if (!selectedShape) {
    return null
  }

  const connected_ids = selectedShape.properties.connectivity
  connected_shapes = connected_ids.map(element => {
    let d = data[Number(element)]
    d.properties.name = "C" + d.properties.name
    return d
  })

  return connected_shapes
}

function getTooltip({object, layer}: PickingInfo<Shape>) {
  if (!object) return null;
  // return object && typeof(layer.id)
  if (String(layer.id) == 'base')
    {
      return object && 
      `\
      ID: ${object.properties.id}
      Name: ${object.properties.name}
      Depth: "base"
      `;
    }
  else if (layer.id == "selected")
    {
      return object && 
      `\
      ID: ${object.properties.id}
      Name: ${object.properties.name}
      Depth: "selected"
      `;
    }
  else if (layer.id == "connected")
    {
      return object && 
      `\
      ID: ${object.properties.id}
      Name: ${object.properties.name}
      Depth: "connected"
      `;
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
  const [selectedShape, selectShape] = useState<Shape>();
  const selected = useMemo(() => selectShapes(selectedShape), undefined);
  const connected_shapes = useMemo(() => selectConnectedShapes(selectedShape, data), [selectedShape, data]);

  const layers = [
    new GeoJsonLayer<FeatureProperties>({
      id: 'base',
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
      pickable: true,
      extruded: true,
      getElevation: 100000.0
    }),
    new GeoJsonLayer<FeatureProperties>({
      id: 'connected',
      data: connected_shapes,
      stroked: true,
      filled: true,
      getFillColor: [95, 0, 0, 175],
      pickable: true
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
