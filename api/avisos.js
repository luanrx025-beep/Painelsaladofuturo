import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const config = { api: { bodyParser: true } };

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS avisos (
      id SERIAL PRIMARY KEY,
      texto TEXT NOT NULL
    )
  `;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await init();

    if (req.method === 'GET') {
      const rows = await sql`SELECT texto FROM avisos ORDER BY id DESC LIMIT 1`;
      return res.status(200).json({ texto: rows[0]?.texto || '' });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { texto } = body;
      await sql`DELETE FROM avisos`;
      if (texto) await sql`INSERT INTO avisos (texto) VALUES (${texto})`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM avisos`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    console.error('Erro na API avisos:', err);
    return res.status(500).json({ error: err.message });
  }
}
