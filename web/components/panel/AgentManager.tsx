'use client';

import { useState } from 'react';
import { createAgent, deleteAgent, agentOnline, MAX_AGENTS, type Agent } from '@/lib/data';
import { useToast } from '@/lib/toast';

const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL ||
  'https://iqdskgjmxfirtsncazms.supabase.co/storage/v1/object/public/downloads/GOCAS-Agente.zip';

export default function AgentManager({ agents, onChange }: { agents: Agent[]; onChange: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const atLimit = agents.length >= MAX_AGENTS;

  async function create() {
    setBusy(true);
    try {
      const { token, agent } = await createAgent(name);
      setNewToken({ token, name: agent.name });
      setName('');
      setCreating(false);
      toast.success(`Agente "${agent.name}" creado.`);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el agente.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Agent) {
    setBusy(true);
    try {
      await deleteAgent(a.id);
      toast.success('Agente eliminado.');
      setConfirmDel(null);
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  }

  function copyToken() {
    if (!newToken) return;
    navigator.clipboard?.writeText(newToken.token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div>
      {/* Token recién creado (se muestra una sola vez) */}
      {newToken ? (
        <div className="card" style={{ borderColor: 'var(--amber)', marginBottom: 18 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 17 }}>Código de “{newToken.name}”</h3>
            <button className="btn btn-quiet btn-sm" onClick={() => setNewToken(null)}>
              Ya lo guardé
            </button>
          </div>
          <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
            Cópialo ahora: <strong>no se vuelve a mostrar</strong>. Lo pegas en el agente cuando lo
            abras por primera vez en el PC de la cámara.
          </p>
          <div
            className="mono"
            style={{
              background: 'var(--olive-deep)',
              color: '#e9e2cf',
              padding: '12px 14px',
              borderRadius: 10,
              fontSize: 14,
              wordBreak: 'break-all',
              marginBottom: 12,
            }}
          >
            {newToken.token}
          </div>
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={copyToken}>
              {copied ? 'Copiado' : 'Copiar código'}
            </button>
            {DOWNLOAD_URL ? (
              <a className="btn btn-olive btn-sm" href={DOWNLOAD_URL}>
                Descargar agente
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Lista de agentes */}
      {agents.length > 0 ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', marginBottom: 16 }}>
          {agents.map((a) => {
            const online = agentOnline(a);
            return (
              <div key={a.id} className="card-flat">
                <div className="row between" style={{ marginBottom: 8 }}>
                  <span className="badge" style={{ background: online ? 'var(--olive)' : undefined, color: online ? '#fff' : undefined, borderColor: online ? 'transparent' : undefined }}>
                    <span className={`dot${online ? ' dot-pulse' : ''}`} style={{ background: online ? '#fff' : '#b8ac93' }} />
                    {online ? 'En línea' : 'Desconectado'}
                  </span>
                  {confirmDel === a.id ? (
                    <span className="row" style={{ gap: 5 }}>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(a)} disabled={busy}>
                        Eliminar
                      </button>
                      <button className="btn btn-quiet btn-sm" onClick={() => setConfirmDel(null)}>
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      className="btn btn-quiet btn-sm"
                      onClick={() => setConfirmDel(a.id)}
                      style={{ color: 'var(--danger)' }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <p style={{ fontWeight: 600, fontSize: 15 }}>{a.name}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Crear */}
      {creating ? (
        <div className="card-flat" style={{ maxWidth: 460 }}>
          <label className="field" style={{ marginBottom: 12 }}>
            <span>Nombre del dispositivo</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="PC del club, Mini-PC cancha 1…"
              maxLength={60}
              autoFocus
            />
          </label>
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={create} disabled={busy}>
              {busy ? 'Creando…' : 'Crear y ver código'}
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => setCreating(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => setCreating(true)} disabled={atLimit}>
            + Vincular un dispositivo
          </button>
          <a className="btn btn-quiet btn-sm" href={DOWNLOAD_URL}>
            Descargar agente (Windows)
          </a>
        </div>
      )}
      {atLimit ? (
        <p className="hint" style={{ marginTop: 10 }}>
          Alcanzaste el máximo de {MAX_AGENTS} dispositivos.
        </p>
      ) : null}
      <p className="hint" style={{ marginTop: 10 }}>
        El agente se instala una vez en la PC que está en la red de la cámara: descomprime el ZIP,
        doble clic en gocas-agent.exe y pega el código. Todo lo demás se controla desde aquí.
      </p>
    </div>
  );
}
