import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const config = { api: { bodyParser: { sizeLimit: '3mb' }, } };

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS fotos (
      usuario TEXT PRIMARY KEY,
      foto TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
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

    // GET — retorna foto de um usuário ou todas
    if (req.method === 'GET') {
      const { usuario } = req.query;
      if (usuario) {
        const rows = await sql`SELECT foto FROM fotos WHERE usuario = ${usuario}`;
        return res.status(200).json({ foto: rows[0]?.foto || null });
      }
      const rows = await sql`SELECT usuario, foto FROM fotos`;
      return res.status(200).json(rows);
    }

    // POST — salva/atualiza foto
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { usuario, foto } = body;
      if (!usuario || !foto) return res.status(400).json({ error: 'Dados inválidos' });
      await sql`
        INSERT INTO fotos (usuario, foto) VALUES (${usuario}, ${foto})
        ON CONFLICT (usuario) DO UPDATE SET foto = ${foto}, updated_at = NOW()
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    console.error('Erro fotos:', err);
    return res.status(500).json({ error: err.message });
  }
}
