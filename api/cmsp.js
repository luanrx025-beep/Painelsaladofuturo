export const config = { api: { bodyParser: true } };

const CMSP = 'https://cmsp.ip.tv/mobile/auth/login';

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

    // ── LOGIN via CMSP ip.tv ──
    if (acao === 'login') {
      const r = await fetch(CMSP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
          'Origin': 'https://cmsp.ip.tv',
          'Referer': 'https://cmsp.ip.tv/',
        },
        body: JSON.stringify({
          nick: ra.toUpperCase(),
          password: senha,
          realm: 'edusp',
          platform: 'webclient'
        })
      });

      const data = await safeJson(r);
      console.log('CMSP login status:', r.status);

      if (!r.ok || !data || data.error) {
        return res.status(401).json({ error: 'RA ou senha inválidos' });
      }

      console.log('CMSP data keys:', Object.keys(data));
      console.log('descricao_turma:', data.descricao_turma);
      console.log('name:', data.name);
      console.log('external_id:', data.external_id);

      // Extrai escola da descricao_turma se não vier separado
      const turma = data.descricao_turma || '';
      const escola = data.school || data.escola || data.nm_escola || '';
      const codigoAlunoFinal = data.external_id ? String(data.external_id).slice(0, -1) : '';

      return res.status(200).json({
        token: data.auth_token,
        tokenResumo: data.auth_token,
        nome: data.name,
        nick: data.nick,
        cdUsuario: data.user_id || data.mas_id,
        codigoAluno: codigoAlunoFinal,
        externalId: data.external_id,
        ra: ra,
        turma,
        escola,
        avatar: data.avatar_url || '',
      });
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': token,
      'accept': 'application/json',
    };

    // ── FALTAS ──
    if (acao === 'faltas') {
      const cod = codigoAluno || cdUsuario;
      console.log('Buscando faltas - codigoAluno:', cod);
      try {
        const SED = 'https://sedintegracoes.educacao.sp.gov.br/saladofuturobffapi';
        const HEADERS_SED = {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://saladofuturo.educacao.sp.gov.br',
          'Referer': 'https://saladofuturo.educacao.sp.gov.br/',
          'Ocp-Apim-Subscription-Key': 'd701a2043aa24d7ebb37e9adf60d043b',
          'Authorization': `Bearer ${token}`,
        };
        const r = await fetch(
          `${SED}/apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${cod}`,
          { headers: HEADERS_SED }
        );
        const text = await r.text();
        console.log('Faltas:', r.status, text.slice(0, 200));
        let data; try { data = JSON.parse(text); } catch {}
        if (data) {
          const lista = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
          return res.status(200).json({ data: lista });
        }
      } catch(e) { console.log('Erro faltas:', e.message); }
      return res.status(200).json({ data: [] });
    }

    // ── PENDÊNCIAS ──
    if (acao === 'pendencias') {
      try {
        const PROXY = 'https://edusp.crimsonzerohub.xyz';
        const roomsR = await fetch(`${PROXY}/room/user?list_all=true&with_cards=true`, { headers: authHeaders });
        const roomsData = await safeJson(roomsR);
        const rooms = roomsData?.rooms || [];
        const targets = new Set();
        rooms.forEach(r => { if(r.name) targets.add(r.name); if(r.id) targets.add(r.id.toString()); });
        if (!targets.size) return res.status(200).json({ total: 0, lista: [] });
        const params = new URLSearchParams();
        targets.forEach(t => params.append('publication_target', t));
        params.append('filter_expired','true'); params.append('with_answer','true');
        params.append('answer_statuses','draft'); params.append('answer_statuses','pending');
        const r = await fetch(`${PROXY}/pendencias?${params}`, { headers: authHeaders });
        const data = await safeJson(r);
        const lista = Array.isArray(data) ? data : (data?.items || data?.data || []);
        return res.status(200).json({ total: lista.length, lista });
      } catch(e) { return res.status(200).json({ total: 0, lista: [] }); }
    }

    // ── NOTIFICAÇÕES ──
    if (acao === 'notificacoes') {
      try {
        const PROXY = 'https://edusp.crimsonzerohub.xyz';
        const r = await fetch(
          `${PROXY}/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao-cmsp?userId=${cdUsuario}`,
          { headers: authHeaders }
        );
        const data = await safeJson(r);
        return res.status(200).json(data || []);
      } catch(e) { return res.status(200).json([]); }
    }

    return res.status(400).json({ error: 'Ação inválida' });

  } catch (err) {
    console.error('Erro CMSP:', err);
    return res.status(500).json({ error: err.message });
  }
}
