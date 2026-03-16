# Chatbot com Puter.js

Chatbot com memória persistente usando React + Puter.js.
**Sem backend. Sem chaves de API. Sem banco de dados local.**

## Como rodar

```bash
npm install
npm run dev
```

Acessa em http://localhost:5173

Na primeira vez, abre um popup pedindo login com conta Puter (gratuito em puter.com).
Depois disso fica autenticado automaticamente.

## O que o Puter fornece

- **AI** — acesso a vários modelos (LLaMA, Mistral, GPT-4o Mini, Claude...)
- **KV Store** — armazenamento chave-valor na nuvem para conversas e memórias

## Modelos disponíveis

- LLaMA 3.3 70B (Meta)
- LLaMA 3.1 8B (Meta) — mais rápido
- Mistral 7B
- Gemma 2 9B (Google)
- GPT-4o Mini (OpenAI)
- Claude 3.5 Haiku (Anthropic)

## Memória entre sessões

Conversas e memórias ficam salvas na nuvem do Puter.
Para salvar um resumo de uma conversa, diga:
"salva um resumo dessa conversa"

Os resumos ficam ativos em todas as conversas futuras.
