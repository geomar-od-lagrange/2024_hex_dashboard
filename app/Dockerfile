FROM node:slim

RUN mkdir -p /app/

WORKDIR /app/

COPY index.html app.tsx control_panel.tsx hex_features_real.geojson.zip package.json style.css tsconfig.json /app/

RUN npm install

ENTRYPOINT [ "npx", "vite", "--port=8080", "--host=0.0.0.0" ]