import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const config = { api: { bodyParser: true } };

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      usuario TEXT NOT NULL,
      time TEXT NOT NULL
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
      const rows = await sql`SELECT usuario, time FROM logs ORDER BY id DESC LIMIT 100`;
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { usuario, time } = body;
      await sql`INSERT INTO logs (usuario, time) VALUES (${usuario}, ${time})`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM logs`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    console.error('Erro na API logs:', err);
    return res.status(500).json({ error: err.message });
  }
}
