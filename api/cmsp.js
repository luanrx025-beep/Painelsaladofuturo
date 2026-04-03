export const config = { api: { bodyParser: true } };

const BASE = 'https://edusp.crimsonzerohub.xyz';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { acao, ra, senha, token, codigoAluno, userId } = body;

    // ── LOGIN ──
    if (acao === 'login') {
      const r = await fetch(`${BASE}/registration/edusp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': 'https://crimsonzerohub.xyz' },
        body: JSON.stringify({ realm: 'edusp', platform: 'webclient', id: ra, password: senha })
      });
      const data = await r.json();
      if (!r.ok || data.error) return res.status(401).json({ error: 'RA ou senha inválidos' });
      return res.status(200).json({
        token: data.auth_token,
        nome: data.name,
        nick: data.nick,
        userId: data.user_id,
        externalId: data.external_id,
        turma: data.descricao_turma,
        avatar: data.avatar_url
      });
    }

    // ── FALTAS ──
    if (acao === 'faltas') {
      const r = await fetch(`${BASE}/apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${codigoAluno}`, {
        headers: { 'Accept': 'application/json', 'Origin': 'https://crimsonzerohub.xyz' }
      });
      const data = await r.json();
      return res.status(200).json(data);
    }

    // ── PENDÊNCIAS ──
    if (acao === 'pendencias') {
      // Busca salas do aluno
      const roomsR = await fetch(`${BASE}/room/user?list_all=true&with_cards=true`, {
        headers: { 'x-api-key': token, 'Accept': 'application/json', 'Origin': 'https://crimsonzerohub.xyz' }
      });
      const roomsData = await roomsR.json();
      const rooms = roomsData?.rooms || [];

      const targets = new Set();
      rooms.forEach(room => {
        if (room.name) targets.add(room.name);
        if (room.id) { const id = room.id.toString(); if (/^\d{3,4}$/.test(id)) targets.add(id); }
      });

      if (!targets.size) return res.status(200).json({ tarefas: 0, total: 0, lista: [] });

      const params = new URLSearchParams();
      targets.forEach(t => params.append('publication_target', t));
      params.append('filter_expired', 'true');
      params.append('with_answer', 'true');
      params.append('answer_statuses', 'draft');
      params.append('answer_statuses', 'pending');

      const pendR = await fetch(`${BASE}/pendencias?${params.toString()}`, {
        headers: { 'x-api-key': token, 'Accept': 'application/json', 'Origin': 'https://crimsonzerohub.xyz' }
      });
      const pendData = await pendR.json();
      const total = Array.isArray(pendData) ? pendData.reduce((s, i) => s + (i.count || 0), 0) : 0;
      return res.status(200).json({ total, lista: pendData });
    }

    // ── NOTIFICAÇÕES ──
    if (acao === 'notificacoes') {
      const r = await fetch(`${BASE}/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao-cmsp?userId=${userId}`, {
        headers: { 'Accept': 'application/json', 'Origin': 'https://crimsonzerohub.xyz' }
      });
      const data = await r.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Ação inválida' });

  } catch (err) {
    console.error('Erro CMSP:', err);
    return res.status(500).json({ error: err.message });
  }
}
