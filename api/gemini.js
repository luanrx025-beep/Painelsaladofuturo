export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);

    const { mensagem } = body;
    const key = process.env.GROQ_KEY;

    if (!key) return res.status(500).json({ error: 'GROQ_KEY não configurada' });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente educacional do Painel Sala do Futuro. Ajude os alunos com dúvidas escolares, estudos e tarefas. Seja simpático, claro e objetivo. Responda sempre em português.'
          },
          {
            role: 'user',
            content: mensagem
          }
        ],
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (data.error) return res.status(500).json({ error: data.error.message });

    const texto = data.choices?.[0]?.message?.content;
    if (!texto) return res.status(500).json({ error: 'Resposta vazia', raw: data });

    return res.status(200).json({ resposta: texto });

  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
