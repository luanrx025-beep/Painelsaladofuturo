# CMSP Hacks — Deploy no Vercel + Neon

## Estrutura
```
cmsp-project/
├── api/
│   └── usuarios.js   ← backend (Neon)
├── public/
│   └── index.html    ← o site
├── package.json
├── vercel.json
└── .env.example
```

## Passo a passo para hospedar

### 1. Suba pro GitHub
- Crie um repositório novo no GitHub (pode ser privado)
- Suba todos esses arquivos para ele

### 2. Conecte ao Vercel
- Acesse vercel.com e faça login com GitHub
- Clique em "New Project"
- Selecione o repositório que você criou
- Clique em "Deploy"

### 3. Configure a variável de ambiente
- No Vercel, vá em Settings → Environment Variables
- Adicione:
  - **Name:** `DATABASE_URL`
  - **Value:** (cole sua connection string do Neon)
- Clique em Save e faça Redeploy

### 4. Pronto!
O site vai funcionar em qualquer dispositivo com os usuários sincronizados pelo Neon.
