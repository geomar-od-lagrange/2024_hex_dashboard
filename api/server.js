const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// environment variables
const pool = new Pool({
  host: 'db',
  port: 5432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: 'db',
});

const GEO_TABLE_NAME = 'geo_table';
const CONN_TABLE_NAME = 'connectivity_table';
const META_TABLE_NAME = 'metadata_table';

// Input validation helpers
function validateArray(arr, maxLength, itemValidator) {
  if (!Array.isArray(arr)) return false;
  if (arr.length === 0 || arr.length > maxLength) return false;
  if (itemValidator) {
    return arr.every(itemValidator);
  }
  return true;
}

function isValidId(id) {
  const num = Number(id);
  return Number.isInteger(num) && num >= 0;
}

function normalize(data) {
  const positive = data.filter(d => d.weight > 0);
  if (positive.length === 0) return [];

  const weights = positive.map(d => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);

  if (max === min) {
    return positive.map(d => ({ ...d, raw_weight: d.weight, weight: 1 }));
  }

  return positive.map(d => ({
    ...d,
    raw_weight: d.weight,
    weight: (Math.log(d.weight) - Math.log(min)) / (Math.log(max) - Math.log(min))
  }));
}


// Parse depth_weight param into a map { depth: normalised_weight }.
// Falls back to equal weights if absent or mismatched length.
function parseDepthWeights(depthArr, weightStr) {
  const rawWeights = (weightStr || '').split(',').map(Number).filter(w => !isNaN(w));
  if (rawWeights.length !== depthArr.length) {
    // equal weights fallback
    const eq = 1 / (depthArr.length || 1);
    return Object.fromEntries(depthArr.map(d => [d, eq]));
  }
  const total = rawWeights.reduce((s, w) => s + w, 0) || 1;
  return Object.fromEntries(depthArr.map((d, i) => [d, rawWeights[i] / total]));
}

// most used fetch
// takes a list of depths, time ranges, ids
// returns a table of connectivity data, averaged over all perumations of the input
app.get('/connectivity', async (req, res) => {

  const depths = (req.query.depth || "").split(",").filter(Boolean);
  const time_ranges = (req.query.time_range || "").split(",").filter(Boolean);
  const start_ids = (req.query.start_id || '').split(',').filter(Boolean);
  const depthWeights = parseDepthWeights(depths, req.query.depth_weight);
  const timeWeights  = parseDepthWeights(time_ranges, req.query.time_weight);

  // Validate inputs
  if (!validateArray(depths, 10)) {
    return res.status(400).json({
      error: 'Invalid depth parameter. Must be array with max 10 items'
    });
  }

  if (!validateArray(time_ranges, 10)) {
    return res.status(400).json({
      error: 'Invalid time_range parameter. Must be array with max 10 items'
    });
  }

  if (!validateArray(start_ids, 10000, isValidId)) {
    return res.status(400).json({
      error: 'Invalid start_id parameter. Must be array of positive integers, max 10000 items'
    });
  }

  const start_ids_numbers = start_ids.map(x => Number(x));

  // TODO: Implement aggregation operator (mean, max, min)
  // const op = req.query.op || "mean";

  try {
    const queryText = `
      SELECT end_id, depth, time_range, weight
      FROM ${CONN_TABLE_NAME}
      WHERE start_id = ANY($1)
        AND depth = ANY($2)
        AND time_range = ANY($3); 
    `;
    const result = await pool.query(queryText, [start_ids_numbers, depths, time_ranges]);

    console.log("Request for parameters: ", depths, time_ranges, start_ids_numbers);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `No entry for parameters: depths=${depths}&time_ranges=${time_ranges}&start_id=${start_ids}` });
    }
    const data = result.rows;
    
    // Weighted mean: each row weighted by user-supplied depth weight × time weight.
    const weightedMean = rows => {
      let totalW = 0, totalWeighted = 0;
      for (const r of rows) {
        const w = (depthWeights[r.depth] ?? 1) * (timeWeights[r.time_range] ?? 1);
        totalW += w;
        totalWeighted += +r.weight * w;
      }
      return totalWeighted / (totalW || 1);
    };

    const byEndId = data.reduce((acc, r) => {
      (acc[r.end_id] ??= []).push(r);
      return acc;
    }, {});

    const aggregates = Object.entries(byEndId).map(([end_id, rows]) => ({
      end_id: typeof rows[0].end_id === 'number' ? Number(end_id) : String(end_id),
      weight: weightedMean(rows),
    }));
        
    const responsePayload = normalize(aggregates);
    
    res.json(responsePayload);
  } catch (err) {
    console.error('Error in /connectivity:', err);
    res.status(500).json({ error: 'Database query error' });
  }
});

// upstream connectivity: for given target hex(es), return fractional contribution of each source
// share(s→t) = F(s→t) / Σ_{s ∈ active} F(s→t)
// When habitable=true, sum is restricted to habitable sources only (non-habitable excluded entirely)
app.get('/connectivity-sources', async (req, res) => {

  const depths     = (req.query.depth      || '').split(',').filter(Boolean);
  const time_ranges = (req.query.time_range || '').split(',').filter(Boolean);
  const end_ids    = (req.query.end_id     || '').split(',').filter(Boolean);
  const habitable  = req.query.habitable === 'true';
  const depthWeights = parseDepthWeights(depths, req.query.depth_weight);
  const timeWeights  = parseDepthWeights(time_ranges, req.query.time_weight);

  if (!validateArray(depths, 10)) {
    return res.status(400).json({ error: 'Invalid depth parameter. Must be array with max 10 items' });
  }
  if (!validateArray(time_ranges, 10)) {
    return res.status(400).json({ error: 'Invalid time_range parameter. Must be array with max 10 items' });
  }
  if (!validateArray(end_ids, 10000, isValidId)) {
    return res.status(400).json({ error: 'Invalid end_id parameter. Must be array of positive integers, max 10000 items' });
  }

  const end_ids_numbers = end_ids.map(x => Number(x));

  try {
    // Join with metadata when habitable filter is active so non-habitable sources
    // are excluded from both the result and the denominator.
    const queryText = habitable
      ? `
          SELECT c.start_id, c.depth, c.time_range, c.weight
          FROM ${CONN_TABLE_NAME} c
          JOIN ${META_TABLE_NAME} m ON c.start_id = m.id
          WHERE c.end_id = ANY($1)
            AND c.depth = ANY($2)
            AND c.time_range = ANY($3)
            AND m.habitable = 1;
        `
      : `
          SELECT start_id, depth, time_range, weight
          FROM ${CONN_TABLE_NAME}
          WHERE end_id = ANY($1)
            AND depth = ANY($2)
            AND time_range = ANY($3);
        `;

    const result = await pool.query(queryText, [end_ids_numbers, depths, time_ranges]);
    console.log('Request for /connectivity-sources:', { end_ids_numbers, depths, time_ranges, habitable });

    if (result.rows.length === 0) {
      return res.json([]);
    }

    const data = result.rows;

    // Weighted mean per source: depth weight × time weight
    const weightedMean = rows => {
      let totalW = 0, totalWeighted = 0;
      for (const r of rows) {
        const w = (depthWeights[r.depth] ?? 1) * (timeWeights[r.time_range] ?? 1);
        totalW += w;
        totalWeighted += +r.weight * w;
      }
      return totalWeighted / (totalW || 1);
    };

    const byStartId = data.reduce((acc, r) => {
      (acc[r.start_id] ??= []).push(r);
      return acc;
    }, {});

    const aggregates = Object.entries(byStartId).map(([start_id, rows]) => ({
      start_id: Number(start_id),
      weight: weightedMean(rows),
    }));

    // Fractional shares: divide each source weight by the sum over all active sources
    const total = aggregates.reduce((sum, a) => sum + a.weight, 0);
    const shares = total > 0
      ? aggregates.map(a => ({ ...a, raw_weight: a.weight / total }))
      : aggregates.map(a => ({ ...a, raw_weight: 0 }));

    // Log-normalise the fractional shares for visual encoding
    const responsePayload = normalize(shares.map(a => ({ ...a, weight: a.raw_weight })));

    res.json(responsePayload);
  } catch (err) {
    console.error('Error in /connectivity-sources:', err);
    res.status(500).json({ error: 'Database query error' });
  }
});

//metadata
app.get('/metadata', async (req, res) => {
  try {
    const queryText = `
      SELECT id, lon, lat, depth, disease, rest, aqc, pop, his, habitable
      FROM ${META_TABLE_NAME}
    `; 
    const result = await pool.query(queryText);
        
    console.log("Request for metadata") 
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: `No metadata` });
    }

    const responsePayload = result.rows;
    
    res.json(responsePayload);
  } catch (err) {
    console.error('Error in /metadata:', err);
    res.status(500).json({ error: 'Database query error' });
  }
});

// features
app.get('/feature', async (req, res) => {
  try {
    const queryText = `
      SELECT
        id,
        ST_AsGeoJSON(geometry) AS geometry
      FROM ${GEO_TABLE_NAME};
    `;
    const result = await pool.query(queryText);
    
    console.log("Request for features")

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No features found' });
    }
    
    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: JSON.parse(row.geometry),
      properties: {
        id: row.id,
      },
    }));

    res.json({ type: 'FeatureCollection', features });

  } catch (err) {
    console.error('Error in /feature:', err);
    res.status(500).json({ error: 'Database query error' });
  }
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server is running on port ${PORT}`);
});

