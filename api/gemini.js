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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: mensagem }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Gemini error:', JSON.stringify(data.error));
      return res.status(500).json({ error: data.error.message });
    }

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';
    return res.status(200).json({ resposta: texto });

  } catch (err) {
    console.error('Erro Gemini:', err);
    return res.status(500).json({ error: err.message });
  }
}
