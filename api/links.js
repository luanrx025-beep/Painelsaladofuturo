import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const config = { api: { bodyParser: true } };

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS links (
      chave TEXT PRIMARY KEY,
      url TEXT NOT NULL
    )
  `;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await init();

    if (req.method === 'GET') {
      const rows = await sql`SELECT chave, url FROM links`;
      const obj = {};
      rows.forEach(r => obj[r.chave] = r.url);
      return res.status(200).json(obj);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      for (const [chave, url] of Object.entries(body)) {
        await sql`
          INSERT INTO links (chave, url) VALUES (${chave}, ${url})
          ON CONFLICT (chave) DO UPDATE SET url = ${url}
        `;
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    console.error('Erro na API links:', err);
    return res.status(500).json({ error: err.message });
  }
}
