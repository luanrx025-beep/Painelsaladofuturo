export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { usuario, senha } = req.body;
  if (!usuario || !senha) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });

  try {
    const r = await fetch('https://cmsp.ip.tv/mobile/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://cmsp.ip.tv',
        'Referer': 'https://cmsp.ip.tv/'
      },
      body: JSON.stringify({
        nick: usuario,
        password: senha,
        realm: 'edusp',
        platform: 'webclient'
      })
    });

    const data = await r.json();

    if (!r.ok || data.error) {
      return res.status(401).json({ ok: false, error: 'Usuário ou senha incorretos' });
    }

    return res.status(200).json({
      ok: true,
      nome: data.name || usuario,
      nick: data.nick,
      turma: data.descricao_turma || '',
      avatar: data.avatar_url || '',
      auth_token: data.auth_token || '',
      external_id: data.external_id || '',
      user_id: data.user_id || ''
    });

  } catch(e) {
    return res.status(500).json({ ok: false, error: 'Erro ao conectar com a CMSP' });
  }
}
