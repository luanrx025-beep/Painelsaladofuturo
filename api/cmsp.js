export const config = { api: { bodyParser: true } };

const SED = 'https://sedintegracoes.educacao.sp.gov.br/saladofuturobffapi';

const HEADERS_BASE = {
  'Content-Type': 'application/json',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://saladofuturo.educacao.sp.gov.br',
  'Referer': 'https://saladofuturo.educacao.sp.gov.br/',
  'Ocp-Apim-Subscription-Key': 'd701a2043aa24d7ebb37e9adf60d043b',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  async function safeJson(r) {
    const text = await r.text();
    try { return JSON.parse(text); } catch { return null; }
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { acao, ra, senha, token, cdUsuario, codigoAluno } = body;

    // ── LOGIN ──
    if (acao === 'login') {
      const r = await fetch(`${SED}/credenciais/api/LoginCompletoToken`, {
        method: 'POST',
        headers: HEADERS_BASE,
        body: JSON.stringify({ user: ra.toUpperCase(), senha })
      });
      const data = await safeJson(r);
      console.log('SED status:', r.status, 'data:', JSON.stringify(data)?.slice(0, 300));
      if (!data || !r.ok) return res.status(401).json({ error: 'RA ou senha inválidos' });
      if (data.statusCode !== 200) return res.status(401).json({ error: 'RA ou senha inválidos' });

      return res.status(200).json({
        token: data.token,
        tokenResumo: data.tokenResumo,
        nome: data.DadosUsuario?.NAME,
        nick: data.DadosUsuario?.NM_NICK,
        cdUsuario: data.DadosUsuario?.CD_USUARIO,
        ra: data.statusRetorno,
        email: data.DadosUsuario?.EMAIL,
      });
    }

    const authHeaders = { ...HEADERS_BASE, 'Authorization': `Bearer ${token}` };

    // ── FALTAS ──
    if (acao === 'faltas') {
      const r = await fetch(`${SED}/apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${codigoAluno}`, {
        headers: authHeaders
      });
      const data = await safeJson(r);
      if (!data) return res.status(502).json({ error: 'Serviço de faltas indisponível.' });
      return res.status(200).json(data);
    }

    // ── PENDÊNCIAS ──
    if (acao === 'pendencias') {
      const r = await fetch(`${SED}/atividades/api/todo?filter_expired=true&expired_only=false&limit=50`, {
        headers: authHeaders
      });
      const data = await safeJson(r);
      if (!data) return res.status(502).json({ error: 'Serviço de pendências indisponível.' });
      const lista = Array.isArray(data) ? data : (data.items || data.data || []);
      return res.status(200).json({ total: lista.length, lista });
    }

    // ── NOTIFICAÇÕES ──
    if (acao === 'notificacoes') {
      const r = await fetch(`${SED}/notificacoes/api/consulta-notificacao-cmsp?userId=${cdUsuario}`, {
        headers: authHeaders
      });
      const data = await safeJson(r);
      if (!data) return res.status(502).json({ error: 'Serviço de notificações indisponível.' });
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Ação inválida' });

  } catch (err) {
    console.error('Erro CMSP:', err);
    return res.status(500).json({ error: err.message });
  }
}
