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
    const key = process.env.GEMINI_KEY;

    if (!key) return res.status(500).json({ error: 'GEMINI_KEY não configurada' });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: mensagem }] }]
      })
    });

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data));

    if (data.error) return res.status(500).json({ error: data.error.message, details: data.error });

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) return res.status(500).json({ error: 'Resposta vazia', raw: data });

    return res.status(200).json({ resposta: texto });

  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({ error: err.message });
  }
}
