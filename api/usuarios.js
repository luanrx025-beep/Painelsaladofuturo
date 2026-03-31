import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const config = {
  api: {
    bodyParser: true,
  },
};

// Garante que a tabela existe
async function init() {
  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      usuario TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'aluno'
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

    // GET — retorna todos os usuários
    if (req.method === 'GET') {
      const rows = await sql`SELECT usuario, senha, role FROM usuarios ORDER BY id`;
      return res.status(200).json(rows);
    }

    // POST — substitui lista completa de usuários
    if (req.method === 'POST') {
      let lista = req.body;

      // Se vier como string, faz o parse manualmente
      if (typeof lista === 'string') {
        try { lista = JSON.parse(lista); } catch { return res.status(400).json({ error: 'JSON inválido' }); }
      }

      if (!Array.isArray(lista)) return res.status(400).json({ error: 'Lista inválida' });

      await sql`DELETE FROM usuarios`;
      for (const u of lista) {
        await sql`
          INSERT INTO usuarios (usuario, senha, role)
          VALUES (${u.usuario}, ${u.senha}, ${u.role})
          ON CONFLICT (usuario) DO UPDATE SET senha = ${u.senha}, role = ${u.role}
        `;
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (err) {
    console.error('Erro na API:', err);
    return res.status(500).json({ error: err.message });
  }
}