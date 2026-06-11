import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Verify connection string presence
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not defined in environment variables!");
  process.exit(1);
}

// Initialize Neon SQL driver
const sql = neon(process.env.DATABASE_URL);

// GET /api/graffiti - Fetch all reports sorted by newest first
app.get('/api/graffiti', async (req, res) => {
  try {
    const reports = await sql`
      SELECT * FROM graffiti_reports 
      ORDER BY created_at DESC;
    `;
    res.json(reports);
  } catch (error: any) {
    console.error("Error fetching graffiti reports:", error);
    res.status(500).json({ error: error.message || "Failed to fetch reports" });
  }
});

// POST /api/graffiti - Create a new report
app.post('/api/graffiti', async (req, res) => {
  const { title, description, latitude, longitude, style, image_url, spotted_by } = req.body;
  
  if (!title || latitude === undefined || longitude === undefined || !style) {
    return res.status(400).json({ error: "Missing required fields (title, latitude, longitude, style)" });
  }

  try {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Latitude and longitude must be valid numbers" });
    }

    const result = await sql`
      INSERT INTO graffiti_reports (title, description, latitude, longitude, style, image_url, spotted_by)
      VALUES (${title}, ${description || null}, ${lat}, ${lng}, ${style}, ${image_url || null}, ${spotted_by || 'Anonymous'})
      RETURNING *;
    `;
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error("Error creating graffiti report:", error);
    res.status(500).json({ error: error.message || "Failed to create report" });
  }
});

// GET /api/stats - Summarize counts and style distribution
app.get('/api/stats', async (req, res) => {
  try {
    const styleCounts = await sql`
      SELECT style, count(*) as count 
      FROM graffiti_reports 
      GROUP BY style;
    `;
    
    const totalCountRes = await sql`
      SELECT count(*) as total FROM graffiti_reports;
    `;
    const totalCount = parseInt(totalCountRes[0].total, 10);

    const latestSpotted = await sql`
      SELECT * FROM graffiti_reports 
      ORDER BY created_at DESC 
      LIMIT 1;
    `;

    res.json({
      total: totalCount,
      styleCounts: styleCounts.map((s: any) => ({ style: s.style, count: parseInt(s.count, 10) })),
      latest: latestSpotted[0] || null
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: error.message || "Failed to fetch stats" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
