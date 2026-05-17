import { useState, useEffect, useCallback } from "react"
import { supabase } from "./supabase.js"
import { PROC_CFG, STATUS_CFG, STATUS_AV, MESES, PROCEDIMENTOS, SEED_PACIENTES, SEED_AVALIACOES } from "./dados.js"

const uid = () => Math.random().toString(36).slice(2, 9)
const iniciais = n => n.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()

export default function App() {
  const [pacientes,  setPacientes]  = useState([])
  const [avaliacoes, setAvaliacoes] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [salvando,   setSalvando]   = useState(false)
  const [erro,       setErro]       = useState(null)
  const [pagina,     setPagina]     = useState("agenda")
  const [mes,        setMes]        = useState("Maio")
  const [procFiltro, setProcFiltro] = useState(null)
  const [busca,      setBusca]      = useState("")
  const [modal,      setModal]      = useState(null)

  // ── CARREGAR DADOS ──────────────────────────────────────
  useEffect(() => { carregarDados() }, [])

  async function carregarDados() {
    setLoading(true)
    try {
      const [{ data: pacs, error: e1 }, { data: avs, error: e2 }] = await Promise.all([
        supabase.from("pacientes").select("*").order("created_at"),
        supabase.from("avaliacoes").select("*").order("created_at"),
      ])
      if (e1 || e2) throw e1 || e2

      // Se banco vazio, popular com dados iniciais
      if (!pacs?.length) {
        await supabase.from("pacientes").insert(SEED_PACIENTES)
        await supabase.from("avaliacoes").insert(SEED_AVALIACOES)
        setPacientes(SEED_PACIENTES)
        setAvaliacoes(SEED_AVALIACOES)
      } else {
        setPacientes(pacs)
        setAvaliacoes(avs || [])
      }
    } catch (e) {
      setErro("Erro ao conectar. Verifique sua conexão.")
      console.error(e)
    }
    setLoading(false)
  }

  // ── SALVAR PACIENTE ─────────────────────────────────────
  async function salvarPaciente(p, mesAlvo) {
    setSalvando(true)
    const registro = { ...p, mes: mesAlvo }
    const { error } = await supabase.from("pacientes").upsert(registro)
    if (!error) {
      setPacientes(prev => {
        const idx = prev.findIndex(x => x.id === p.id)
        if (idx >= 0) { const n=[...prev]; n[idx]=registro; return n }
        return [...prev, registro]
      })
    }
    setSalvando(false)
    setModal(null)
  }

  // ── EXCLUIR PACIENTE ────────────────────────────────────
  async function excluirPaciente(id) {
    if (!confirm("Excluir este paciente?")) return
    await supabase.from("pacientes").delete().eq("id", id)
    setPacientes(prev => prev.filter(p => p.id !== id))
    setModal(null)
  }

  // ── MARCAR PROCEDIMENTO ─────────────────────────────────
  async function marcarFeito(paciente, proc) {
    const feitos = { ...paciente.feitos, [proc]: !paciente.feitos?.[proc] }
    const { error } = await supabase.from("pacientes").update({ feitos }).eq("id", paciente.id)
    if (!error) setPacientes(prev => prev.map(p => p.id === paciente.id ? { ...p, feitos } : p))
  }

  // ── SALVAR AVALIAÇÃO ────────────────────────────────────
  async function salvarAvaliacao(av) {
    setSalvando(true)
    const registro = { ...av, mes }
    const { error } = await supabase.from("avaliacoes").upsert(registro)
    if (!error) {
      setAvaliacoes(prev => {
        const idx = prev.findIndex(x => x.id === av.id)
        if (idx >= 0) { const n=[...prev]; n[idx]=registro; return n }
        return [...prev, registro]
      })
    }
    setSalvando(false)
    setModal(null)
  }

  // ── EXCLUIR AVALIAÇÃO ───────────────────────────────────
  async function excluirAvaliacao(id) {
    if (!confirm("Excluir esta avaliação?")) return
    await supabase.from("avaliacoes").delete().eq("id", id)
    setAvaliacoes(prev => prev.filter(a => a.id !== id))
    setModal(null)
  }

  // ── FILTROS ─────────────────────────────────────────────
  const pacsMes    = pacientes.filter(p => p.mes === mes && (!busca || p.nome.toLowerCase().includes(busca.toLowerCase())))
  const avsMes     = avaliacoes.filter(a => a.mes === mes && (!busca || a.nome.toLowerCase().includes(busca.toLowerCase())))
  const pacsAgenda = pacientes.filter(p => {
    const temProc  = !procFiltro || p.procs?.[procFiltro]
    const pendente = !procFiltro || !p.feitos?.[procFiltro]
    const buscaOk  = !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
    return temProc && pendente && buscaOk
  })

  const contarPendentes = k => pacientes.filter(p => p.procs?.[k] && !p.feitos?.[k]).length

  const prog = p => {
    const total = Object.keys(p.procs || {}).length
    if (!total) return 0
    return Math.round(Object.keys(p.procs).filter(k => p.feitos?.[k]).length / total * 100)
  }

  function copiarLista() {
    const txt = (procFiltro ? `AGENDA — ${procFiltro.toUpperCase()}\n` : "LISTA DE PACIENTES\n")
      + "─".repeat(38) + "\n"
      + pacsAgenda.map((p,i) => {
          const det = procFiltro && p.procs?.[procFiltro] && p.procs[procFiltro] !== "1"
            ? ` (${p.procs[procFiltro]})` : ""
          return `${i+1}. ${p.nome}${det} — ${p.mes}/2026`
        }).join("\n")
    navigator.clipboard.writeText(txt).then(() => alert("Lista copiada! Cole no WhatsApp."))
  }

  // ── LOADING / ERRO ──────────────────────────────────────
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:40 }}>🦷</div>
      <div style={{ fontSize:14, color:"var(--text2)" }}>Carregando dados...</div>
    </div>
  )

  if (erro) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ fontSize:14, color:"var(--red)" }}>{erro}</div>
      <button onClick={carregarDados} style={{ ...S.priBtn }}>Tentar novamente</button>
    </div>
  )

  return (
    <div style={S.app}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <div style={S.logoIcon}>🦷</div>
            <div>
              <div style={S.logoTitle}>Ficha de Progresso 2026</div>
              <div style={S.logoSub}>Controle de Tratamentos • {pacientes.length} pacientes</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {salvando && <span style={S.savedTag}>✓ Salvo</span>}
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="🔍 Buscar paciente..."
              style={S.searchInput} />
          </div>
        </div>
        <div style={S.nav}>
          {[["agenda","📅 Agenda por Procedimento"],["progresso","✅ Progresso"],["avaliacoes","📋 Avaliações"]].map(([id,lbl]) => (
            <button key={id} onClick={() => { setPagina(id); setBusca("") }}
              style={{ ...S.navBtn, ...(pagina===id ? S.navAct : {}) }}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={S.container}>

        {/* ══ AGENDA ══════════════════════════════════════════ */}
        {pagina === "agenda" && (
          <div>
            <div style={S.topRow}>
              <div>
                <div style={S.secTitle}>Selecione o procedimento para montar a agenda</div>
                <div style={S.secSub}>Clique em um procedimento para ver todos os pacientes pendentes</div>
              </div>
              <button onClick={copiarLista} style={S.copyBtn}>📋 Copiar lista para WhatsApp</button>
            </div>

            <div style={S.procGrid}>
              {PROC_CFG.map(p => {
                const cnt = contarPendentes(p.key)
                const sel = procFiltro === p.key
                return (
                  <div key={p.key} onClick={() => setProcFiltro(sel ? null : p.key)}
                    style={{ ...S.procCard, ...(sel ? { border:`2px solid ${p.color}`, background:p.bg } : {}) }}>
                    <div style={{ fontSize:24, marginBottom:4 }}>{p.icon}</div>
                    <div style={{ fontSize:11, fontWeight:600, color:sel?p.color:"var(--text2)" }}>{p.label}</div>
                    <div style={{ fontSize:26, fontWeight:700, color:sel?p.color:"var(--text)", lineHeight:1.1 }}>{cnt}</div>
                    <div style={{ fontSize:10, color:"var(--text3)" }}>pendente{cnt!==1?"s":""}</div>
                  </div>
                )
              })}
            </div>

            <div style={S.card}>
              <div style={S.cardHeader}>
                <span style={{ fontWeight:600 }}>
                  {procFiltro ? `Pacientes com ${procFiltro} pendente` : "Todos os pacientes"}
                </span>
                <span style={S.badge}>{pacsAgenda.length} paciente{pacsAgenda.length!==1?"s":""}</span>
              </div>
              {pacsAgenda.length === 0
                ? <div style={S.empty}>Nenhum paciente encontrado</div>
                : pacsAgenda.map(p => (
                  <div key={p.id} style={S.pacRow}>
                    <div style={{ ...S.avatar, background:"#eff6ff", color:"#1d6fd8" }}>{iniciais(p.nome)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={S.pacName}>{p.nome}</div>
                      <div style={S.pacSub}>
                        📅 {p.mes} 2026
                        {procFiltro && p.procs?.[procFiltro] && p.procs[procFiltro]!=="1"
                          ? ` · ${procFiltro}: ${p.procs[procFiltro]}` : ""}
                      </div>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:4 }}>
                        {Object.keys(p.procs||{}).filter(k=>k!==procFiltro&&k!=="Limpezas"&&!p.feitos?.[k]).slice(0,3).map(k=>(
                          <span key={k} style={S.tagPend}>⏳ {k}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => setModal({ tipo:"paciente", item:p, mesAlvo:p.mes })} style={S.editBtn}>✏️</button>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ══ PROGRESSO ═══════════════════════════════════════ */}
        {pagina === "progresso" && (
          <div>
            <div style={S.mesRow}>
              {MESES.map(m => (
                <button key={m} onClick={() => setMes(m)}
                  style={{ ...S.mesBtn, ...(mes===m ? S.mesBtnAct : {}) }}>
                  {m.slice(0,3)}
                </button>
              ))}
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={S.secTitle}>{mes} 2026 — {pacsMes.length} pacientes</div>
              <button onClick={() => setModal({ tipo:"paciente", item:null, mesAlvo:mes })} style={S.addBtn}>
                + Novo Paciente
              </button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {pacsMes.length === 0
                ? <div style={{ ...S.card, ...S.empty }}>Nenhum paciente em {mes}. Clique em "+ Novo Paciente".</div>
                : pacsMes.map(p => {
                  const pct = prog(p)
                  const total = Object.keys(p.procs||{}).length
                  const feitos = Object.keys(p.procs||{}).filter(k=>p.feitos?.[k]).length
                  return (
                    <div key={p.id} style={S.card}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:total?12:0 }}>
                        <div style={{ ...S.avatar, background:pct===100?"#f0fdf4":"#eff6ff", color:pct===100?"#16a34a":"#1d6fd8" }}>
                          {pct===100 ? "✓" : iniciais(p.nome)}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                            <span style={{ fontWeight:600, fontSize:14 }}>{p.nome}</span>
                            {pct===100 && <span style={{ ...S.tagFeito, fontSize:11 }}>✅ Concluído</span>}
                          </div>
                          {total > 0 && (
                            <div style={{ marginTop:6 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text2)", marginBottom:3 }}>
                                <span>{feitos}/{total} procedimentos</span>
                                <span style={{ fontWeight:600, color:pct===100?"#16a34a":"var(--navy)" }}>{pct}%</span>
                              </div>
                              <div style={S.progBar}>
                                <div style={{ ...S.progFill, width:`${pct}%`, background:pct===100?"#16a34a":"#1d6fd8" }}/>
                              </div>
                            </div>
                          )}
                          {p.obs && <div style={{ fontSize:11, color:"var(--text3)", marginTop:4 }}>📝 {p.obs}</div>}
                        </div>
                        <button onClick={() => setModal({ tipo:"paciente", item:p, mesAlvo:mes })} style={S.editBtn}>✏️</button>
                      </div>

                      {total > 0 && (
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {Object.entries(p.procs||{}).map(([proc, det]) => {
                            const feito = p.feitos?.[proc]
                            return (
                              <div key={proc} onClick={() => marcarFeito(p, proc)}
                                style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px",
                                  borderRadius:8, cursor:"pointer",
                                  border:`1px solid ${feito?"#bbf7d0":"#e2e8f0"}`,
                                  background:feito?"#f0fdf4":"#f8fafc", fontSize:12, transition:"all 0.15s" }}>
                                <span style={{ fontSize:13 }}>{feito?"✅":"⏳"}</span>
                                <span style={{ fontWeight:500, color:feito?"#16a34a":"var(--text)" }}>{proc}</span>
                                {det && det!=="1" && <span style={{ color:"var(--text3)", fontSize:11 }}>{det.length>12?det.slice(0,12)+"…":det}</span>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              }
            </div>
          </div>
        )}

        {/* ══ AVALIAÇÕES ══════════════════════════════════════ */}
        {pagina === "avaliacoes" && (
          <div>
            <div style={S.mesRow}>
              {MESES.map(m => (
                <button key={m} onClick={() => setMes(m)}
                  style={{ ...S.mesBtn, ...(mes===m ? S.mesBtnAct : {}) }}>
                  {m.slice(0,3)}
                </button>
              ))}
            </div>

            <div style={S.statsRow}>
              {[
                { label:"Total",     val:avsMes.length,                                                          color:"#1d6fd8" },
                { label:"Aprovados", val:avsMes.filter(a=>a.status==="Aprovado").length,                         color:"#16a34a" },
                { label:"Faltaram",  val:avsMes.filter(a=>a.status==="Faltou").length,                           color:"#dc2626" },
                { label:"Pendentes", val:avsMes.filter(a=>["Pendente","Em Aberto","Follow Up"].includes(a.status)).length, color:"#ca8a04" },
              ].map(s => (
                <div key={s.label} style={S.statCard}>
                  <div style={{ fontSize:24, fontWeight:700, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:11, color:"var(--text3)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={S.secTitle}>{mes} 2026 — Avaliações</div>
              <button onClick={() => setModal({ tipo:"avaliacao", item:null })} style={S.addBtn}>
                + Nova Avaliação
              </button>
            </div>

            <div style={S.card}>
              {avsMes.length === 0
                ? <div style={S.empty}>Nenhuma avaliação em {mes}.</div>
                : avsMes.map(a => {
                  const cfg = STATUS_CFG[a.status] || { color:"#475569", bg:"#f1f5f9", border:"#e2e8f0" }
                  return (
                    <div key={a.id} style={{ ...S.pacRow, alignItems:"center" }}>
                      <div style={{ ...S.avatar, background:cfg.bg, color:cfg.color }}>{iniciais(a.nome)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={S.pacName}>{a.nome}</div>
                        <div style={S.pacSub}>📅 {a.data}</div>
                        {a.obs && <div style={{ fontSize:11, color:"var(--text3)" }}>📝 {a.obs}</div>}
                      </div>
                      <span style={{ padding:"4px 12px", borderRadius:8, fontSize:12, fontWeight:600,
                        background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, flexShrink:0 }}>
                        {a.status}
                      </span>
                      <button onClick={() => setModal({ tipo:"avaliacao", item:a })} style={S.editBtn}>✏️</button>
                    </div>
                  )
                })
              }
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {modal?.tipo === "paciente" && (
        <Overlay onClose={() => setModal(null)}>
          <ModalPaciente item={modal.item} mesAlvo={modal.mesAlvo}
            onSave={salvarPaciente} onDelete={excluirPaciente} onClose={() => setModal(null)} />
        </Overlay>
      )}
      {modal?.tipo === "avaliacao" && (
        <Overlay onClose={() => setModal(null)}>
          <ModalAvaliacao item={modal.item} mes={mes}
            onSave={salvarAvaliacao} onDelete={excluirAvaliacao} onClose={() => setModal(null)} />
        </Overlay>
      )}
    </div>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modalBox} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

function ModalPaciente({ item, mesAlvo, onSave, onDelete, onClose }) {
  const [local, setLocal]   = useState(() => item ? JSON.parse(JSON.stringify(item)) : { id:uid(), nome:"", procs:{}, feitos:{}, obs:"" })
  const [mesSel, setMesSel] = useState(mesAlvo || "Maio")

  return (
    <div>
      <div style={S.mHdr}>
        <div>
          <div style={S.mTitle}>{item ? "Editar Paciente" : "Novo Paciente"}</div>
          <div style={S.mSub}>{mesSel} 2026</div>
        </div>
        <button onClick={onClose} style={S.closeBtn}>✕</button>
      </div>
      <div style={S.mBody}>
        {!item && (
          <div style={{ marginBottom:16 }}>
            <label style={S.label}>Mês de fechamento</label>
            <select value={mesSel} onChange={e=>setMesSel(e.target.value)} style={S.select}>
              {MESES.map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
        )}
        <label style={S.label}>Nome do paciente *</label>
        <input style={S.input} value={local.nome} autoFocus
          onChange={e=>setLocal({...local,nome:e.target.value})} placeholder="Nome completo" />

        <div style={{ marginTop:18 }}>
          <label style={S.label}>Procedimentos planejados</label>
          <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:8 }}>
            {PROCEDIMENTOS.map(proc => {
              const ativo = !!local.procs[proc]
              return (
                <div key={proc} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                  borderRadius:8, background:ativo?"#f0fdf4":"#f8fafc", border:`1px solid ${ativo?"#bbf7d0":"#e2e8f0"}` }}>
                  <input type="checkbox" checked={ativo}
                    onChange={e => {
                      const p = {...local.procs}
                      if (e.target.checked) p[proc]="1"; else delete p[proc]
                      setLocal({...local, procs:p})
                    }} style={{ width:15, height:15, cursor:"pointer" }} />
                  <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{proc}</span>
                  {ativo && (
                    <input style={{ ...S.input, margin:0, width:185, fontSize:12, padding:"4px 8px" }}
                      value={local.procs[proc]==="1"?"":local.procs[proc]}
                      onChange={e => {
                        const p={...local.procs}; p[proc]=e.target.value||"1"
                        setLocal({...local,procs:p})
                      }}
                      placeholder="Dentes (ex: 11.12.14)" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop:14 }}>
          <label style={S.label}>Observações</label>
          <textarea value={local.obs} onChange={e=>setLocal({...local,obs:e.target.value})}
            placeholder="Anotações sobre o paciente..."
            style={{ ...S.input, minHeight:65, resize:"vertical" }} />
        </div>
      </div>
      <div style={S.mFtr}>
        {item && <button onClick={()=>onDelete(item.id)} style={S.delBtn}>🗑 Excluir</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={S.secBtn}>Cancelar</button>
          <button onClick={()=>local.nome.trim()&&onSave(local,mesSel)} style={S.priBtn}>💾 Salvar</button>
        </div>
      </div>
    </div>
  )
}

function ModalAvaliacao({ item, mes, onSave, onDelete, onClose }) {
  const hoje = new Date().toLocaleDateString("pt-BR")
  const [local, setLocal] = useState(item ? {...item} : { id:uid(), nome:"", data:hoje, status:"Pendente", obs:"" })
  return (
    <div>
      <div style={S.mHdr}>
        <div>
          <div style={S.mTitle}>{item?"Editar Avaliação":"Nova Avaliação"}</div>
          <div style={S.mSub}>{mes} 2026</div>
        </div>
        <button onClick={onClose} style={S.closeBtn}>✕</button>
      </div>
      <div style={S.mBody}>
        <label style={S.label}>Nome do paciente *</label>
        <input style={S.input} value={local.nome} autoFocus
          onChange={e=>setLocal({...local,nome:e.target.value})} placeholder="Nome completo" />
        <label style={{...S.label,marginTop:14}}>Data da avaliação</label>
        <input style={S.input} value={local.data}
          onChange={e=>setLocal({...local,data:e.target.value})} placeholder="dd/mm/aaaa" />
        <label style={{...S.label,marginTop:14}}>Status</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginTop:7 }}>
          {STATUS_AV.map(s => {
            const cfg = STATUS_CFG[s]||{}; const sel = local.status===s
            return (
              <button key={s} onClick={()=>setLocal({...local,status:s})}
                style={{ padding:"6px 14px", borderRadius:8, cursor:"pointer", fontSize:13,
                  fontWeight:sel?600:400, border:`2px solid ${sel?cfg.color:"#e2e8f0"}`,
                  background:sel?cfg.bg:"#f8fafc", color:sel?cfg.color:"#475569" }}>
                {s}
              </button>
            )
          })}
        </div>
        <label style={{...S.label,marginTop:14}}>Observações</label>
        <textarea value={local.obs} onChange={e=>setLocal({...local,obs:e.target.value})}
          placeholder="Anotações..." style={{...S.input,minHeight:55,resize:"vertical"}} />
      </div>
      <div style={S.mFtr}>
        {item && <button onClick={()=>onDelete(item.id)} style={S.delBtn}>🗑 Excluir</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={S.secBtn}>Cancelar</button>
          <button onClick={()=>local.nome.trim()&&onSave(local)} style={S.priBtn}>💾 Salvar</button>
        </div>
      </div>
    </div>
  )
}

const S = {
  app:         { minHeight:"100vh", background:"var(--bg)" },
  header:      { background:"var(--surface)", borderBottom:"1px solid var(--border)", position:"sticky", top:0, zIndex:50 },
  headerInner: { maxWidth:1200, margin:"0 auto", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 },
  logo:        { display:"flex", alignItems:"center", gap:12 },
  logoIcon:    { width:42, height:42, background:"linear-gradient(135deg,#1d6fd8,#0f2744)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 },
  logoTitle:   { fontWeight:700, fontSize:16, color:"var(--text)", letterSpacing:-0.3 },
  logoSub:     { fontSize:11, color:"var(--text3)" },
  savedTag:    { fontSize:12, color:"var(--green)", fontWeight:600, background:"var(--green-light)", padding:"4px 10px", borderRadius:20 },
  searchInput: { padding:"8px 14px", border:"1px solid var(--border)", borderRadius:8, fontSize:13, width:220, outline:"none", background:"var(--surface2)" },
  nav:         { maxWidth:1200, margin:"0 auto", padding:"0 20px", display:"flex", gap:2 },
  navBtn:      { padding:"10px 18px", border:"none", background:"none", cursor:"pointer", fontSize:13, fontWeight:500, color:"var(--text2)", borderBottom:"2px solid transparent", marginBottom:-1 },
  navAct:      { color:"var(--blue)", borderBottom:"2px solid var(--blue)" },
  container:   { maxWidth:1200, margin:"0 auto", padding:20 },
  topRow:      { display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 },
  secTitle:    { fontSize:15, fontWeight:600, color:"var(--text)" },
  secSub:      { fontSize:12, color:"var(--text3)", marginTop:2 },
  copyBtn:     { padding:"8px 16px", background:"var(--navy)", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500, flexShrink:0 },
  addBtn:      { padding:"8px 16px", background:"var(--blue)", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500 },
  procGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(105px,1fr))", gap:10, marginBottom:20 },
  procCard:    { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 10px", cursor:"pointer", textAlign:"center", transition:"all 0.15s", boxShadow:"var(--shadow)" },
  card:        { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden", boxShadow:"var(--shadow)" },
  cardHeader:  { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid var(--border)" },
  badge:       { fontSize:11, padding:"3px 10px", borderRadius:20, background:"#eff6ff", color:"#1d6fd8" },
  pacRow:      { display:"flex", alignItems:"flex-start", gap:12, padding:"12px 16px", borderBottom:"1px solid var(--border2)" },
  avatar:      { width:38, height:38, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:600, fontSize:13, flexShrink:0 },
  pacName:     { fontWeight:600, fontSize:13, color:"var(--text)" },
  pacSub:      { fontSize:11, color:"var(--text3)", marginTop:2 },
  tagPend:     { fontSize:10, padding:"2px 7px", borderRadius:4, background:"#fefce8", color:"#ca8a04", fontWeight:500 },
  tagFeito:    { fontSize:10, padding:"2px 7px", borderRadius:4, background:"#f0fdf4", color:"#16a34a", fontWeight:500 },
  editBtn:     { background:"#eff6ff", border:"none", borderRadius:8, cursor:"pointer", padding:"6px 10px", fontSize:14, flexShrink:0 },
  mesRow:      { display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" },
  mesBtn:      { padding:"6px 16px", borderRadius:20, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text2)", cursor:"pointer", fontSize:12, fontWeight:500 },
  mesBtnAct:   { background:"var(--navy)", color:"#fff", border:"1px solid var(--navy)" },
  statsRow:    { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 },
  statCard:    { background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, padding:12, textAlign:"center", boxShadow:"var(--shadow)" },
  progBar:     { height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" },
  progFill:    { height:"100%", borderRadius:3, transition:"width 0.3s" },
  empty:       { padding:32, textAlign:"center", color:"var(--text3)", fontSize:13 },
  overlay:     { position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 },
  modalBox:    { background:"var(--surface)", borderRadius:16, width:"100%", maxWidth:580, maxHeight:"90vh", overflow:"auto", boxShadow:"var(--shadow-md)" },
  mHdr:        { padding:"18px 22px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"flex-start", background:"var(--surface2)" },
  mTitle:      { fontWeight:700, fontSize:16, color:"var(--text)" },
  mSub:        { fontSize:12, color:"var(--text3)", marginTop:2 },
  closeBtn:    { background:"none", border:"none", fontSize:18, cursor:"pointer", color:"var(--text3)", padding:4 },
  mBody:       { padding:"18px 22px" },
  mFtr:        { padding:"14px 22px", borderTop:"1px solid var(--border)", display:"flex", alignItems:"center", background:"var(--surface2)" },
  label:       { fontSize:11, fontWeight:600, color:"var(--text2)", textTransform:"uppercase", letterSpacing:0.5, display:"block", marginBottom:5 },
  input:       { width:"100%", padding:"9px 12px", border:"1px solid var(--border)", borderRadius:8, fontSize:14, outline:"none", background:"var(--surface)", color:"var(--text)", fontFamily:"inherit", boxSizing:"border-box" },
  select:      { width:"100%", padding:"9px 12px", border:"1px solid var(--border)", borderRadius:8, fontSize:14, outline:"none", background:"var(--surface)", color:"var(--text)", fontFamily:"inherit" },
  priBtn:      { padding:"8px 20px", background:"var(--blue)", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 },
  secBtn:      { padding:"8px 16px", background:"var(--surface2)", color:"var(--text2)", border:"1px solid var(--border)", borderRadius:8, cursor:"pointer", fontSize:13 },
  delBtn:      { padding:"8px 14px", background:"var(--red-light)", color:"var(--red)", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500 },
}
