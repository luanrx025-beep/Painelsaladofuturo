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
      if (!data || !r.ok) return res.status(401).json({ error: 'RA ou senha inválidos' });
      if (data.statusCode !== 200) return res.status(401).json({ error: 'RA ou senha inválidos' });

      const cdUsu = data.DadosUsuario?.CD_USUARIO;
      const codigoAlunoFinal = String(cdUsu || '').slice(0, -1);
      console.log('Login OK - CD_USUARIO:', cdUsu, '-> codigoAluno:', codigoAlunoFinal);
      console.log('DadosUsuario COMPLETO:', JSON.stringify(data.DadosUsuario));

      // Busca turma e escola
      let turma = '', escola = '', professor = '';
      try {
        const authHdr = { ...HEADERS_BASE, 'Authorization': `Bearer ${data.token}` };
        const endpoints2 = [
          `${SED}/apiboletim/api/Turma/GetTurmaAluno?codigoAluno=${codigoAlunoFinal}`,
          `${SED}/apiboletim/api/Aluno/GetDadosAluno?codigoAluno=${codigoAlunoFinal}`,
          `${SED}/credenciais/api/DadosAluno?codigoAluno=${codigoAlunoFinal}`,
          `${SED}/apiboletim/api/Aluno/GetAluno?codigoAluno=${codigoAlunoFinal}`,
        ];
        for (const url2 of endpoints2) {
          const r2 = await fetch(url2, { headers: authHdr });
          const t2 = await r2.text();
          console.log('endpoint:', url2.split('/api/')[1], '-> status:', r2.status, '->', t2.slice(0,150));
          if (!r2.ok) continue;
          try {
            const d2 = JSON.parse(t2);
            const td = Array.isArray(d2?.data) ? d2.data[0] : (d2?.data || d2 || {});
            for (const [k,v] of Object.entries(td || {})) {
              if (typeof v !== 'string' || !v) continue;
              const kl = k.toLowerCase();
              if (!turma && (kl.includes('turma') || kl.includes('serie') || kl.includes('classe'))) turma = v;
              if (!escola && (kl.includes('escola') || kl.includes('unidade') || kl.includes('estabelecimento'))) escola = v;
              if (!professor && kl.includes('professor')) professor = v;
            }
            if (turma || escola) { console.log('Achou! turma:', turma, 'escola:', escola); break; }
          } catch(e2) {}
        }
      } catch(e) { console.log('Err turma/escola:', e.message); }

      return res.status(200).json({
        token: data.token,
        tokenResumo: data.tokenResumo,
        nome: data.DadosUsuario?.NAME,
        nick: data.DadosUsuario?.NM_NICK,
        cdUsuario: cdUsu,
        codigoAluno: codigoAlunoFinal,
        ra: data.statusRetorno || '',
        turma,
        escola,
        professor,
        email: data.DadosUsuario?.EMAIL,
      });
    }

    const authHeadersSED = { ...HEADERS_BASE, 'Authorization': `Bearer ${token}` };

    // ── FALTAS ──
    if (acao === 'faltas') {
      const cod = codigoAluno || cdUsuario;
      console.log('Buscando faltas - codigoAluno:', cod);
      try {
        const r = await fetch(
          `${SED}/apiboletim/api/Frequencia/GetFaltasBimestreAtual?codigoAluno=${cod}`,
          { headers: authHeadersSED }
        );
        const text = await r.text();
        console.log('SED faltas:', r.status, '->', text.slice(0, 200));
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
        const r = await fetch(`${SED}/atividades/api/todo?filter_expired=true&expired_only=false&limit=50`,
          { headers: authHeadersSED });
        const data = await safeJson(r);
        const lista = Array.isArray(data) ? data : (data?.items || data?.data || []);
        return res.status(200).json({ total: lista.length, lista });
      } catch(e) {
        return res.status(200).json({ total: 0, lista: [] });
      }
    }

    // ── NOTIFICAÇÕES ──
    if (acao === 'notificacoes') {
      try {
        const r = await fetch(
          `${SED}/notificacoes/api/consulta-notificacao-cmsp?userId=${cdUsuario}`,
          { headers: authHeadersSED }
        );
        const data = await safeJson(r);
        return res.status(200).json(data || []);
      } catch(e) {
        return res.status(200).json([]);
      }
    }

    return res.status(400).json({ error: 'Ação inválida' });

  } catch (err) {
    console.error('Erro CMSP:', err);
    return res.status(500).json({ error: err.message });
  }
}
