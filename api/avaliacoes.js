import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const config = { api: { bodyParser: true } };

async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS avaliacoes (
      id SERIAL PRIMARY KEY,
      usuario TEXT NOT NULL,
      nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
      comentario TEXT,
      time TEXT NOT NULL,
      data DATE DEFAULT CURRENT_DATE
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
      const avaliacoes = await sql`SELECT * FROM avaliacoes ORDER BY id DESC LIMIT 50`;
      const stats = await sql`SELECT AVG(nota)::numeric(3,1) as media, COUNT(*) as total FROM avaliacoes`;
      const distribuicao = await sql`SELECT nota, COUNT(*) as qtd FROM avaliacoes GROUP BY nota ORDER BY nota DESC`;
      return res.status(200).json({ avaliacoes, stats: stats[0], distribuicao });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { usuario, nota, comentario, time } = body;
      if (!usuario || !nota) return res.status(400).json({ error: 'Dados inválidos' });
      // Verifica se já avaliou hoje
      const existe = await sql`SELECT id FROM avaliacoes WHERE usuario = ${usuario} AND data = CURRENT_DATE`;
      if (existe.length > 0) {
        await sql`UPDATE avaliacoes SET nota=${nota}, comentario=${comentario}, time=${time} WHERE usuario=${usuario} AND data=CURRENT_DATE`;
      } else {
        await sql`INSERT INTO avaliacoes (usuario, nota, comentario, time) VALUES (${usuario}, ${nota}, ${comentario}, ${time})`;
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (id) await sql`DELETE FROM avaliacoes WHERE id = ${id}`;
      else await sql`DELETE FROM avaliacoes`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    console.error('Erro avaliacoes:', err);
    return res.status(500).json({ error: err.message });
  }
}
