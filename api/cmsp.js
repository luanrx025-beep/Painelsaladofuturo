export const config = { api: { bodyParser: true } };

const SED = 'https://sedintegracoes.educacao.sp.gov.br/saladofuturobffapi';
const PROXY = 'https://edusp.crimsonzerohub.xyz';

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
      if (!data || !r.ok) return res.status(401).json({ error: 'RA ou senha inválidos' });
      if (data.statusCode !== 200) return res.status(401).json({ error: 'RA ou senha inválidos' });

      const raRaw = data.statusRetorno || '';
      const raNumeros = raRaw.replace(/[^0-9]/g, '');
      const codigoAlunoExtracted = raNumeros.slice(0, -1);

      console.log('Login OK - statusRetorno:', raRaw, '-> codigoAluno:', codigoAlunoExtracted);
      console.log('DadosUsuario:', JSON.stringify(data.DadosUsuario));

      return res.status(200).json({
        token: data.token,
        tokenResumo: data.tokenResumo,
        nome: data.DadosUsuario?.NAME,
        nick: data.DadosUsuario?.NM_NICK,
        cdUsuario: data.DadosUsuario?.CD_USUARIO,
        codigoAluno: codigoAlunoExtracted,
        ra: raRaw,
        turma: data.DadosUsuario?.DS_TURMA || data.DadosUsuario?.TURMA || '',
        email: data.DadosUsuario?.EMAIL,
      });
    }

    const authHeadersSED   = { ...HEADERS_BASE, 'Authorization': `Bearer ${token}` };
    const authHeadersProxy = { 'x-api-key': token, 'accept': 'application/json' };

    // ── FALTAS ── usa o PROXY igual ao dashboard.js
    if (acao === 'faltas') {
      const cod = codigoAluno || cdUsuario;
      const ano = new Date().getFullYear();
      console.log('Buscando faltas via PROXY - codigoAluno:', cod);

      try {
        const r = await fetch(
          `${PROXY}/apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${cod}`,
          { headers: authHeadersProxy }
        );
        const text = await r.text();
        console.log('PROXY faltas status:', r.status, '-> ', text.slice(0, 300));
        let data; try { data = JSON.parse(text); } catch {}
        if (data) {
          const lista = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
          if (lista.length > 0) {
            console.log('PROXY retornou', lista.length, 'itens. Keys:', Object.keys(lista[0]));
            return res.status(200).json({ data: lista });
          }
        }
      } catch(e) { console.log('Erro PROXY faltas:', e.message); }

      // Fallback: tenta SED direto com tokenResumo
      try {
        const r = await fetch(
          `${SED}/apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${cod}`,
          { headers: authHeadersSED }
        );
        const text = await r.text();
        console.log('SED direto faltas status:', r.status, '->', text.slice(0, 300));
        let data; try { data = JSON.parse(text); } catch {}
        if (data) {
          const lista = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
          return res.status(200).json({ data: lista });
        }
      } catch(e) { console.log('Erro SED faltas:', e.message); }

      return res.status(200).json({ data: [] });
    }

    // ── PENDÊNCIAS ── usa PROXY igual ao dashboard.js
    if (acao === 'pendencias') {
      console.log('Buscando pendências via PROXY');
      try {
        // Primeiro pega as salas do usuário
        const roomsR = await fetch(`${PROXY}/room/user?list_all=true&with_cards=true`,
          { headers: authHeadersProxy });
        const roomsData = await safeJson(roomsR);
        const rooms = roomsData?.rooms || [];
        const nick = body.nick || '';

        const targets = new Set();
        rooms.forEach(r => {
          if (r.name) { targets.add(r.name); if (nick) targets.add(`${r.name}:${nick}`); }
          if (r.id) { const id = r.id.toString(); if (/^\d{3,4}$/.test(id)) targets.add(id); }
        });

        if (!targets.size) return res.status(200).json({ total: 0, lista: [] });

        const params = new URLSearchParams();
        targets.forEach(t => params.append('publication_target', t));
        params.append('filter_expired', 'true');
        params.append('with_answer', 'true');
        params.append('answer_statuses', 'draft');
        params.append('answer_statuses', 'pending');

        const r = await fetch(`${PROXY}/pendencias?${params}`, { headers: authHeadersProxy });
        const data = await safeJson(r);
        const lista = Array.isArray(data) ? data : (data?.items || data?.data || []);
        const total = lista.reduce((s, i) => s + (i.count || 1), 0);
        console.log('Pendências total:', total);
        return res.status(200).json({ total, lista });
      } catch(e) {
        console.log('Erro pendências:', e.message);
        return res.status(200).json({ total: 0, lista: [] });
      }
    }

    // ── NOTIFICAÇÕES ── usa PROXY
    if (acao === 'notificacoes') {
      console.log('Buscando notificações - cdUsuario:', cdUsuario);
      try {
        const r = await fetch(
          `${PROXY}/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao-cmsp?userId=${cdUsuario}`,
          { headers: authHeadersProxy }
        );
        const data = await safeJson(r);
        console.log('Notificações status:', r.status);
        return res.status(200).json(data || []);
      } catch(e) {
        console.log('Erro notificações:', e.message);
        return res.status(200).json([]);
      }
    }

    return res.status(400).json({ error: 'Ação inválida' });

  } catch (err) {
    console.error('Erro CMSP:', err);
    return res.status(500).json({ error: err.message });
  }
}
