import { useState, useEffect, useRef } from 'react';
import { puter } from '@heyputer/puter.js';

const MODELS = [
  { group: 'OpenAI',    value: 'gpt-4o',                       label: 'GPT-4o' },
  { group: 'OpenAI',    value: 'gpt-4.1',                      label: 'GPT-4.1' },
  { group: 'Anthropic', value: 'claude-sonnet-4-5',            label: 'Claude Sonnet 4.5' },
  { group: 'Anthropic', value: 'claude-sonnet-4',              label: 'Claude Sonnet 4' },
  { group: 'Google',    value: 'google/gemini-2.5-flash',      label: 'Gemini 2.5 Flash' },
  { group: 'Google',    value: 'google/gemini-2.0-flash',      label: 'Gemini 2.0 Flash' },
  { group: 'Meta',      value: 'meta-llama/llama-4-maverick',  label: 'Llama 4 Maverick' },
  { group: 'Meta',      value: 'meta-llama/llama-4-scout',     label: 'Llama 4 Scout' },
];

const GROUPS = ['OpenAI', 'Anthropic', 'Google', 'Meta'];
const KV_CONVERSATIONS  = 'chatbot:conversations';
const KV_TAVILY         = 'chatbot:tavily_key';
const KV_MEMORIES       = 'chatbot:memories';
const KV_INSTRUCTIONS   = 'chatbot:instructions';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function fmt(d) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

async function searchWeb(query, key) {
  const r = await puter.net.fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, max_results: 5, search_depth: 'basic' }),
  });
  const d = await r.json();
  return d.results || [];
}

/* ── simple markdown renderer ── */
function MsgContent({ content, role }) {
  if (role === 'user') return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</span>;
  const html = content
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre style="background:#1e1e2e;color:#cdd6f4;padding:12px 14px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.6;margin:8px 0"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.12);padding:2px 6px;border-radius:4px;font-size:13px">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
  return <span dangerouslySetInnerHTML={{ __html: html }} style={{ wordBreak: 'break-word', lineHeight: 1.75 }} />;
}

/* ── Tavily setup modal ── */
function TavilyModal({ onSave }) {
  const [key, setKey] = useState('');
  return (
    <div style={overlay}>
      <div style={modal}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#ececec', marginBottom: 6 }}>Busca na web</p>
        <p style={{ fontSize: 13, color: '#8e8ea0', marginBottom: 16, lineHeight: 1.5 }}>
          Cole sua chave Tavily. Ela fica salva de forma privada na sua conta Puter.
        </p>
        <input
          autoFocus type="password" placeholder="tvly-..."
          value={key} onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && key.trim() && onSave(key.trim())}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => onSave(key.trim())} disabled={!key.trim()} style={{ ...primaryBtn, flex: 1, opacity: key.trim() ? 1 : 0.4 }}>Salvar</button>
          <button onClick={() => onSave(null)} style={{ ...ghostBtn, flex: 1 }}>Pular</button>
        </div>
        <p style={{ fontSize: 11, color: '#555', marginTop: 10, textAlign: 'center' }}>
          Chave gratuita em app.tavily.com
        </p>
      </div>
    </div>
  );
}

/* ── Instructions modal ── */
function InstructionsModal({ value, onSave, onClose }) {
  const [text, setText] = useState(value || '');
  return (
    <div style={overlay}>
      <div style={{ ...modal, width: 480 }}>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#ececec', marginBottom: 6 }}>Instruções personalizadas</p>
        <p style={{ fontSize: 13, color: '#8e8ea0', marginBottom: 14, lineHeight: 1.5 }}>
          O que você quer que o assistente sempre saiba ou como ele deve se comportar?
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ex: Você é um assistente jurídico especializado em direito brasileiro. Sempre cite artigos de lei quando relevante. Seja direto e técnico."
          rows={6}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => onSave(text)} style={{ ...primaryBtn, flex: 1 }}>Salvar</button>
          <button onClick={onClose} style={{ ...ghostBtn, flex: 1 }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Loading spinner ── */
function Spinner() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#212121' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #333', borderTopColor: '#19c37d', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#8e8ea0', fontSize: 14 }}>Conectando ao Puter...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ── Shared styles ── */
const overlay   = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 };
const modal     = { background: '#2f2f2f', borderRadius: 12, padding: 24, width: 400, maxWidth: '100%', border: '1px solid #3d3d3d' };
const inputStyle = { width: '100%', padding: '10px 12px', background: '#1a1a1a', border: '1px solid #3d3d3d', borderRadius: 8, fontSize: 14, color: '#ececec', outline: 'none', boxSizing: 'border-box' };
const primaryBtn = { padding: '9px 0', background: '#19c37d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const ghostBtn   = { padding: '9px 0', background: 'none', color: '#8e8ea0', border: '1px solid #3d3d3d', borderRadius: 8, cursor: 'pointer', fontSize: 13 };

/* ── Main App ── */
export default function App() {
  const [ready,         setReady]         = useState(false);
  const [showTavily,    setShowTavily]    = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [tavilyKey,     setTavilyKey]     = useState(null);
  const [instructions,  setInstructions]  = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeId,      setActiveId]      = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [memories,      setMemories]      = useState([]);
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [webOn,         setWebOn]         = useState(false);
  const [model,         setModel]         = useState(MODELS[0].value);
  const [sidebar,       setSidebar]       = useState(true);
  const [tab,           setTab]           = useState('chats');
  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    (async () => {
      if (!puter.auth.isSignedIn()) await puter.auth.signIn();
      const k = await puter.kv.get(KV_TAVILY).catch(() => null);
      if (k === null) setShowTavily(true);
      else setTavilyKey(k || null);
      const c = await puter.kv.get(KV_CONVERSATIONS).catch(() => null);
      setConversations(c ? JSON.parse(c) : []);
      const m = await puter.kv.get(KV_MEMORIES).catch(() => null);
      setMemories(m ? JSON.parse(m) : []);
      const ins = await puter.kv.get(KV_INSTRUCTIONS).catch(() => null);
      setInstructions(ins || '');
      setReady(true);
    })();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
  }, [input]);

  async function saveTavily(k) {
    await puter.kv.set(KV_TAVILY, k || '');
    setTavilyKey(k || null);
    setShowTavily(false);
  }

  async function saveInstructions(text) {
    await puter.kv.set(KV_INSTRUCTIONS, text);
    setInstructions(text);
    setShowInstructions(false);
  }

  async function saveConvs(list)    { await puter.kv.set(KV_CONVERSATIONS, JSON.stringify(list)); }
  async function saveMsgs(id, msgs) { await puter.kv.set(`chatbot:messages:${id}`, JSON.stringify(msgs)); }
  async function loadMsgs(id) {
    const r = await puter.kv.get(`chatbot:messages:${id}`).catch(() => null);
    return r ? JSON.parse(r) : [];
  }

  async function selectConv(conv) {
    setActiveId(conv.id);
    setModel(conv.model || MODELS[0].value);
    setMessages(await loadMsgs(conv.id));
  }

  async function newConv() {
    const c = { id: genId(), title: 'Nova conversa', model, updatedAt: new Date().toISOString() };
    const updated = [c, ...conversations];
    setConversations(updated);
    await saveConvs(updated);
    setActiveId(c.id);
    setMessages([]);
    setTab('chats');
  }

  async function delConv(id, e) {
    e.stopPropagation();
    const updated = conversations.filter(c => c.id !== id);
    setConversations(updated);
    await saveConvs(updated);
    await puter.kv.del(`chatbot:messages:${id}`).catch(() => {});
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }

  async function delMem(id, e) {
    e.stopPropagation();
    const updated = memories.filter(m => m.id !== id);
    setMemories(updated);
    await puter.kv.set(KV_MEMORIES, JSON.stringify(updated));
  }

  async function send() {
    if (!input.trim() || loading || !activeId) return;
    const text = input.trim();
    setInput('');
    setLoading(true);

    const saveCommands = ['salva um resumo', 'salvar resumo', 'salva resumo'];
    const isSave = saveCommands.some(cmd => text.toLowerCase().includes(cmd));

    const userMsg = { id: genId(), role: 'user', content: text };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);

    // salvar resumo
    if (isSave) {
      if (messages.length === 0) {
        const err = { id: genId(), role: 'assistant', content: 'Não há mensagens para resumir.' };
        const final = [...newMsgs, err];
        setMessages(final); await saveMsgs(activeId, final);
        setLoading(false); return;
      }
      try {
        const hist = messages.map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n');
        const res = await puter.ai.chat(
          `Analise a conversa e gere um resumo conciso com os pontos mais importantes. Máximo 5 bullet points.\n\nConversa:\n${hist}`,
          { model }
        );
        const summary = res?.message?.content?.[0]?.text || res?.toString() || '';
        const conv = conversations.find(c => c.id === activeId);
        const newMem = { id: genId(), conversationTitle: conv?.title || 'Conversa', summary, createdAt: new Date().toISOString() };
        const updMems = [newMem, ...memories];
        setMemories(updMems);
        await puter.kv.set(KV_MEMORIES, JSON.stringify(updMems));
        const aMsg = { id: genId(), role: 'assistant', content: `✓ Resumo salvo:\n\n${summary}` };
        const final = [...newMsgs, aMsg];
        setMessages(final); await saveMsgs(activeId, final);
      } catch (err) {
        const e = { id: genId(), role: 'assistant', content: 'Erro: ' + err.message };
        const final = [...newMsgs, e];
        setMessages(final); await saveMsgs(activeId, final);
      }
      setLoading(false); return;
    }

    // busca web
    let webCtx = '';
    if (webOn && tavilyKey) {
      try {
        const results = await searchWeb(text, tavilyKey);
        if (results.length > 0)
          webCtx = '\n\nResultados da web:\n' + results.map((r, i) => `[${i+1}] ${r.title}\n${r.url}\n${r.content}`).join('\n\n');
      } catch (e) { webCtx = '\n\n(Erro na busca: ' + e.message + ')'; }
    }

    // monta system prompt
    let system = 'Você é um assistente útil e direto. Responda sempre em português.';
    if (instructions.trim()) system = instructions.trim();
    if (webCtx) system += webCtx;
    if (memories.length > 0) {
      const mem = memories.map((m, i) => `[Memória ${i+1} - ${m.conversationTitle}]\n${m.summary}`).join('\n\n');
      system += `\n\nInformações de conversas anteriores:\n${mem}`;
    }

    const history = newMsgs.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await puter.ai.chat(
        [{ role: 'system', content: system }, ...history],
        { model }
      );
      const reply = res?.message?.content?.[0]?.text || res?.message?.content || res?.toString() || 'Sem resposta.';
      const aMsg = { id: genId(), role: 'assistant', content: reply };
      const final = [...newMsgs, aMsg];
      setMessages(final);
      await saveMsgs(activeId, final);

      const updConvs = conversations.map(c => c.id === activeId
        ? { ...c, model, title: c.title === 'Nova conversa' ? text.slice(0, 40) + (text.length > 40 ? '...' : '') : c.title, updatedAt: new Date().toISOString() }
        : c
      );
      setConversations(updConvs);
      await saveConvs(updConvs);
    } catch (err) {
      const e = { id: genId(), role: 'assistant', content: 'Erro: ' + err.message };
      const final = [...newMsgs, e];
      setMessages(final); await saveMsgs(activeId, final);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const activeConv = conversations.find(c => c.id === activeId);
  const modelLabel = MODELS.find(m => m.value === model)?.label || model;

  if (!ready) return <Spinner />;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#212121', color: '#ececec', fontFamily: "'Söhne', ui-sans-serif, system-ui, -apple-system, sans-serif" }}>

      {/* Modals */}
      {showTavily && <TavilyModal onSave={saveTavily} />}
      {showInstructions && <InstructionsModal value={instructions} onSave={saveInstructions} onClose={() => setShowInstructions(false)} />}

      {/* Sidebar */}
      <div style={{ width: sidebar ? 260 : 0, minWidth: sidebar ? 260 : 0, overflow: 'hidden', transition: 'all 0.2s ease', background: '#171717', display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2a2a' }}>

        {/* new chat */}
        <div style={{ padding: '12px 10px 8px', display: 'flex', gap: 6 }}>
          <button onClick={newConv} style={{ flex: 1, padding: '9px 12px', background: 'none', color: '#ececec', border: '1px solid #3d3d3d', borderRadius: 8, cursor: 'pointer', fontSize: 13, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova conversa
          </button>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', padding: '0 10px', gap: 4, marginBottom: 6 }}>
          {['chats', 'memories'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '5px 0', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? '#19c37d' : 'transparent'}`, cursor: 'pointer', fontSize: 12, color: tab === t ? '#ececec' : '#8e8ea0', fontWeight: tab === t ? 600 : 400 }}>
              {t === 'chats' ? 'Conversas' : `Memórias${memories.length > 0 ? ` (${memories.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
          {tab === 'chats' && (
            conversations.length === 0
              ? <p style={{ fontSize: 12, color: '#555', textAlign: 'center', marginTop: 24 }}>Nenhuma conversa</p>
              : conversations.map(conv => (
                <div key={conv.id} onClick={() => selectConv(conv)} style={{ padding: '9px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 1, background: activeId === conv.id ? '#2a2a2a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: '#ececec', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: activeId === conv.id ? 500 : 400 }}>{conv.title}</p>
                    <p style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{fmt(conv.updatedAt)}</p>
                  </div>
                  <button onClick={e => delConv(conv.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 16, padding: '2px 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
              ))
          )}
          {tab === 'memories' && (
            memories.length === 0
              ? <div style={{ textAlign: 'center', marginTop: 24, padding: '0 8px' }}>
                  <p style={{ fontSize: 12, color: '#555' }}>Nenhuma memória</p>
                  <p style={{ fontSize: 11, color: '#444', marginTop: 8, lineHeight: 1.5 }}>Diga <em style={{ color: '#666' }}>"salva um resumo"</em> em qualquer conversa</p>
                </div>
              : memories.map(mem => (
                <div key={mem.id} style={{ padding: 10, borderRadius: 8, marginBottom: 6, background: '#1e1e1e', border: '1px solid #2a2a2a' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#ececec', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{mem.conversationTitle}</p>
                      <p style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{fmt(mem.createdAt)}</p>
                    </div>
                    <button onClick={e => delMem(mem.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 16, padding: '0 2px', lineHeight: 1 }}>×</button>
                  </div>
                  <p style={{ fontSize: 12, color: '#8e8ea0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{mem.summary}</p>
                </div>
              ))
          )}
        </div>

        {/* bottom actions */}
        <div style={{ padding: '8px 10px', borderTop: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={() => setShowInstructions(true)} style={{ width: '100%', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', color: instructions ? '#19c37d' : '#8e8ea0', fontSize: 13, textAlign: 'left', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            {instructions ? 'Instruções ativas' : 'Instruções personalizadas'}
          </button>
          {tavilyKey && (
            <button onClick={() => setWebOn(p => !p)} style={{ width: '100%', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', color: webOn ? '#19c37d' : '#8e8ea0', fontSize: 13, textAlign: 'left', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Busca web {webOn ? 'ativada' : 'desativada'}
            </button>
          )}
          <button onClick={() => setShowTavily(true)} style={{ width: '100%', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: 12, textAlign: 'left', borderRadius: 8 }}>
            {tavilyKey ? '✓ Tavily configurado' : 'Configurar Tavily'}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* header */}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #2a2a2a' }}>
          <button onClick={() => setSidebar(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8e8ea0', padding: 4, lineHeight: 1, borderRadius: 6 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          {/* model selector */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
            <select value={model} onChange={e => setModel(e.target.value)} style={{ background: 'none', border: 'none', color: '#ececec', fontSize: 15, fontWeight: 600, cursor: 'pointer', outline: 'none', appearance: 'none', paddingRight: 20 }}>
              {GROUPS.map(g => (
                <optgroup key={g} label={g}>
                  {MODELS.filter(m => m.group === g).map(m => (
                    <option key={m.value} value={m.value} style={{ background: '#2f2f2f', color: '#ececec' }}>{m.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8e8ea0" strokeWidth="2" style={{ position: 'absolute', right: 0, pointerEvents: 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>

          <div style={{ flex: 1 }} />
          {webOn && tavilyKey && <span style={{ fontSize: 11, color: '#19c37d', background: 'rgba(25,195,125,0.1)', padding: '3px 10px', borderRadius: 99, border: '1px solid rgba(25,195,125,0.2)' }}>🌐 Web</span>}
          {instructions && <span style={{ fontSize: 11, color: '#8e8ea0', background: '#2a2a2a', padding: '3px 10px', borderRadius: 99 }}>Instruções ativas</span>}
        </div>

        {/* messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
          {!activeId ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#19c37d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <p style={{ fontSize: 24, fontWeight: 600, color: '#ececec' }}>Como posso ajudar?</p>
              <button onClick={newConv} style={{ padding: '10px 24px', background: '#19c37d', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Nova conversa
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <p style={{ fontSize: 18, color: '#8e8ea0' }}>Como posso ajudar?</p>
              {memories.length > 0 && <p style={{ fontSize: 12, color: '#555' }}>✓ {memories.length} memória(s) ativa(s)</p>}
            </div>
          ) : (
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ marginBottom: 24, display: 'flex', gap: 16, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                  {/* avatar */}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: msg.role === 'user' ? '#5436da' : '#19c37d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    {msg.role === 'user' ? 'V' : 'AI'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: '#555', marginBottom: 6, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                      {msg.role === 'user' ? 'Você' : modelLabel}
                    </p>
                    <div style={{ background: msg.role === 'user' ? '#2f2f2f' : 'none', borderRadius: 12, padding: msg.role === 'user' ? '10px 14px' : '0', color: '#ececec', fontSize: 15, display: 'inline-block', maxWidth: msg.role === 'user' ? '85%' : '100%', float: msg.role === 'user' ? 'right' : 'none' }}>
                      <MsgContent content={msg.content} role={msg.role} />
                    </div>
                    <div style={{ clear: 'both' }} />
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#19c37d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>AI</div>
                  <div style={{ paddingTop: 6 }}>
                    <p style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>{webOn && tavilyKey ? 'Buscando na web...' : modelLabel}</p>
                    <div style={{ display: 'flex', gap: 5, paddingTop: 4 }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#555', animation: `bounce 1.2s ${i*0.2}s infinite` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* input */}
        <div style={{ padding: '12px 24px 20px', maxWidth: 760, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ background: '#2f2f2f', borderRadius: 16, border: '1px solid #3d3d3d', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={el => { textareaRef.current = el; inputRef.current = el; }}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading || !activeId}
              placeholder={activeId ? 'Mensagem... (Enter para enviar, Shift+Enter para nova linha)' : 'Crie uma conversa primeiro'}
              rows={1}
              style={{ flex: 1, resize: 'none', background: 'none', border: 'none', outline: 'none', color: '#ececec', fontSize: 15, fontFamily: 'inherit', lineHeight: 1.6, maxHeight: 180, overflowY: 'auto' }}
            />
            <button
              onClick={send}
              disabled={loading || !activeId || !input.trim()}
              style={{ width: 36, height: 36, borderRadius: 8, background: input.trim() && !loading ? '#19c37d' : '#3d3d3d', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#444', marginTop: 8 }}>
            {modelLabel} via Puter · <span style={{ cursor: 'pointer', color: '#555', textDecoration: 'underline' }} onClick={() => setShowInstructions(true)}>Instruções</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        textarea::placeholder { color: #555; }
        select option { background: #2f2f2f; }
      `}</style>
    </div>
  );
}
