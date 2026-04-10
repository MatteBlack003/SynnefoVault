import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { encryptWithKeyring } from '../lib/crypto';
import { uploadToGitHub, deleteFromGitHub, fetchFullCatalogFromAPI, updateCatalogInRepo } from '../lib/github';
import { RefreshCw, Timer, Trash2, Plus } from 'lucide-react';

const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack',
  'flutter', 'cyber-security', 'digital-marketing', 'data-science',
];
const REPO_OWNER  = 'MatteBlack003';
const REPO_NAME   = 'SynnefoVault';
const CATALOG_KEY = 'synnefo_live_catalog';

interface Catalog { [dept: string]: string[]; }

function saveCatalog(c: Catalog) { localStorage.setItem(CATALOG_KEY, JSON.stringify(c)); }
function loadCatalog(): Catalog | null {
  const raw = localStorage.getItem(CATALOG_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// function declaration — hoists before the useEffect that calls it
function mergeCatalogs(a: Catalog, b: Catalog): Catalog {
  const out: Catalog = {};
  for (const d of DEPARTMENTS) {
    out[d] = Array.from(new Set([...(a[d] || []), ...(b[d] || [])]));
  }
  const dA = (a as Record<string, unknown>)['_durations'] as Record<string, number> || {};
  const dB = (b as Record<string, unknown>)['_durations'] as Record<string, number> || {};
  (out as Record<string, unknown>)['_durations'] = { ...dA, ...dB };
  return out;
}

export function Admin() {
  const navigate = useNavigate();

  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo,  setRepo]  = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [dept,         setDept]         = useState('networking');
  const [filename,     setFilename]     = useState('');
  const [studentCount, setStudentCount] = useState<number | ''>('');
  const [duration,     setDuration]     = useState<number | ''>('');
  const [content,      setContent]      = useState('');
  const [contentType,  setContentType]  = useState<'markdown' | 'pdf'>('markdown');
  const [pdfFile,      setPdfFile]      = useState<File | null>(null);
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [catalog, setCatalog] = useState<Catalog>({});
  const [status,  setStatus]  = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ dept: string; file: string } | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('sys_gh_token');
    const o = localStorage.getItem('sys_gh_owner');
    const r = localStorage.getItem('sys_gh_repo');
    if (t && o && r) {
      setToken(t); setOwner(o); setRepo(r); setIsLoggedIn(true);
      const local = loadCatalog();
      if (local) setCatalog(local);
      fetchFullCatalogFromAPI(o, r, DEPARTMENTS, t)
        .then(api => { const m = mergeCatalogs(local || {}, api); setCatalog(m); saveCatalog(m); })
        .catch(e => console.warn('Catalog fetch failed:', e));
    }
  }, []);

  const refreshCatalog = async (tok?: string) => {
    try {
      const api = await fetchFullCatalogFromAPI(owner || REPO_OWNER, repo || REPO_NAME, DEPARTMENTS, tok || token);
      const m = mergeCatalogs(loadCatalog() || {}, api);
      setCatalog(m); saveCatalog(m);
    } catch (e) { console.warn('Refresh failed:', e); }
  };

  const handleLogin = () => {
    if (!token || !owner || !repo) return alert('Enter all credentials first.');
    localStorage.setItem('sys_gh_token', token);
    localStorage.setItem('sys_gh_owner', owner);
    localStorage.setItem('sys_gh_repo',  repo);
    setIsLoggedIn(true);
    refreshCatalog(token);
  };

  const handleLogout = () => {
    localStorage.clear(); setIsLoggedIn(false);
    setToken(''); setOwner(''); setRepo('');
  };

  const genIDs = (n: number, prefix: string): string[] => {
    const s = new Set<string>();
    while (s.size < n) {
      const b = Array.from(crypto.getRandomValues(new Uint8Array(2))).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
      s.add(`${prefix.toUpperCase()}-${b}`);
    }
    return [...s];
  };

  const readBase64 = (f: File): Promise<string> =>
    new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });

  const handleCreate = async () => {
    const hasContent = contentType === 'pdf' ? !!pdfFile : !!content.trim();
    if (!filename || !hasContent)      return setStatus({ type: 'error', msg: 'Filename and content are required.' });
    if (typeof studentCount !== 'number' || studentCount < 1 || studentCount > 200)
                                       return setStatus({ type: 'error', msg: 'Class size must be 1–200.' });
    if (duration !== '' && (typeof duration !== 'number' || duration < 1 || duration > 600))
                                       return setStatus({ type: 'error', msg: 'Duration must be 1–600 minutes.' });

    setLoading(true); setStatus({ type: '', msg: '' }); setGeneratedIds([]);
    try {
      const ids     = genIDs(studentCount, dept.split('-')[0].substring(0, 3));
      const payload = contentType === 'pdf' && pdfFile ? `PDF:${await readBase64(pdfFile)}` : `MD:${content}`;
      const enc     = await encryptWithKeyring(ids, payload);
      const safe    = filename.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const path    = `${dept}/${safe}.enc`;

      await uploadToGitHub({ repoOwner: owner, repoName: repo, path, content: enc, message: `Init: ${path}`, token });

      setStatus({ type: 'success', msg: `✓ ${path} deployed. Distribute the IDs below to your students:` });
      setGeneratedIds(ids);
      setContent(''); setPdfFile(null); setFilename(''); setDuration('');
      if (fileRef.current) fileRef.current.value = '';

      const fresh = loadCatalog() || {};
      const updated = mergeCatalogs(fresh, catalog);
      if (!(updated[dept] || []).includes(`${safe}.enc`)) updated[dept] = [...(updated[dept] || []), `${safe}.enc`];
      if (typeof duration === 'number' && duration > 0) {
        const d = (updated as Record<string, unknown>)['_durations'] as Record<string, number> || {};
        (updated as Record<string, unknown>)['_durations'] = { ...d, [path]: duration };
      }
      setCatalog(updated); saveCatalog(updated);
      try { await updateCatalogInRepo({ repoOwner: owner, repoName: repo, catalog: updated, token }); } catch { /**/ }
    } catch (err: unknown) {
      setStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Deploy failed.' });
    } finally { setLoading(false); }
  };

  const handleEnd = async (d: string, f: string) => {
    setLoading(true); setStatus({ type: '', msg: '' });
    const path = `${d}/${f}`;
    try {
      await deleteFromGitHub({ repoOwner: owner, repoName: repo, path, token });
      setStatus({ type: 'success', msg: `✓ ${f} purged — global access revoked.` });
      const updated = { ...catalog, [d]: (catalog[d] || []).filter(x => x !== f) };
      const durs = (updated as Record<string, unknown>)['_durations'] as Record<string, number> || {};
      delete durs[path]; (updated as Record<string, unknown>)['_durations'] = durs;
      setCatalog(updated); saveCatalog(updated);
      try { await updateCatalogInRepo({ repoOwner: owner, repoName: repo, catalog: updated, token }); } catch { /**/ }
    } catch (err: unknown) {
      setStatus({ type: 'error', msg: err instanceof Error ? err.message : 'Delete failed.' });
    } finally { setLoading(false); }
  };

  // ─── Login Gate ────────────────────────────────────────────────────────────
  if (!isLoggedIn) return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-sm"
      >
        <div className="panel p-8">
          {/* Brand header */}
          <div className="mb-7 pb-6 border-b border-border/60">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-accent2 shadow-[0_0_8px_rgba(111,163,224,0.9)]" />
              <span className="text-[10px] font-bold text-muted tracking-[0.2em] uppercase">// Faculty Console</span>
            </div>
            <h2 className="text-xl font-bold text-ink mb-1 tracking-tight">Authentication Gateway</h2>
            <p className="text-xs text-muted leading-relaxed">Enter your GitHub credentials to access the exam control panel.</p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="label" style={{ fontSize: '0.6rem' }}>GitHub PAT</label>
              <input type="password" value={token} onChange={e => setToken(e.target.value)}
                className="input-base" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" style={{ borderRadius: '10px' }} />
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.6rem' }}>Repository Owner</label>
              <input type="text" value={owner} onChange={e => setOwner(e.target.value)}
                className="input-base" placeholder="MatteBlack003" style={{ borderRadius: '10px' }} />
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.6rem' }}>Repository Name</label>
              <input type="text" value={repo} onChange={e => setRepo(e.target.value)}
                className="input-base" placeholder="SynnefoVault" style={{ borderRadius: '10px' }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <button onClick={handleLogin} className="btn-primary w-full py-3 mt-1" style={{ borderRadius: '10px', fontSize: '0.78rem' }}>
              Authenticate
            </button>
            <button onClick={() => navigate('/')} className="btn-secondary w-full py-2.5" style={{ borderRadius: '10px', fontSize: '0.72rem' }}>
              ← Student Portal
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  const allExams = Object.entries(catalog)
    .filter(([k]) => k !== '_durations')
    .flatMap(([d, files]) => Array.isArray(files) ? files.map(f => ({ dept: d, file: f })) : []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 gap-5 overflow-hidden min-h-0 w-full">

      {/* ── Left: Key Generator ── */}
      <div className="flex-[2] panel flex flex-col overflow-hidden min-h-0">
        {/* Panel header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="label mb-1" style={{ fontSize: '0.6rem' }}>Encryption Engine</div>
            <h2 className="text-base font-bold text-ink tracking-tight">Key Generator</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refreshCatalog()} className="btn-secondary py-1.5 px-4 text-[10px] flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
            <button onClick={handleLogout} className="btn-danger py-1.5 px-4">
              Disconnect
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Form grid */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label" style={{ fontSize: '0.58rem' }}>Department</label>
              <select value={dept} onChange={e => setDept(e.target.value)} className="input-select" style={{ borderRadius: '10px', padding: '9px 32px 9px 12px' }}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.58rem' }}>Exam Filename</label>
              <input type="text" value={filename} onChange={e => setFilename(e.target.value)}
                className="input-base" placeholder="mock-04" style={{ borderRadius: '10px' }} />
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.58rem' }}>Class Size</label>
              <input type="number" min="1" max="200" value={studentCount}
                onChange={e => setStudentCount(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="input-base" placeholder="e.g. 30" style={{ borderRadius: '10px' }} />
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.58rem' }}>
                Duration (min) <span className="normal-case text-dim font-normal tracking-normal text-[0.58rem]">opt.</span>
              </label>
              <input type="number" min="1" max="600" value={duration}
                onChange={e => setDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="input-base" placeholder="e.g. 90" style={{ borderRadius: '10px' }} />
            </div>
          </div>

          {/* Content type */}
          <div>
            <label className="label" style={{ fontSize: '0.58rem' }}>Content Format</label>
            <div className="flex gap-2 mt-1">
              {(['markdown', 'pdf'] as const).map(type => (
                <button key={type}
                  onClick={() => { setContentType(type); if (type === 'markdown') { setPdfFile(null); if (fileRef.current) fileRef.current.value = ''; } else setContent(''); }}
                  className={contentType === type ? 'btn-primary flex-1 py-2.5 text-[11px]' : 'btn-secondary flex-1 py-2.5 text-[11px]'}
                  style={{ borderRadius: '10px' }}
                >
                  {type === 'markdown' ? '⬜ Markdown' : '▤ PDF Upload'}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {contentType === 'markdown' ? (
            <div className="flex flex-col gap-1">
              <label className="label" style={{ fontSize: '0.58rem' }}>Question Paper (Markdown)</label>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                className="input-area text-xs leading-relaxed" rows={8}
                placeholder={'# Question 1\n\nWrite your questions here...'} />
            </div>
          ) : (
            <div>
              <label className="label" style={{ fontSize: '0.58rem' }}>Upload PDF</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border border-dashed border-border2 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-surface2 transition-all p-8"
              >
                <input ref={fileRef} type="file" accept="application/pdf" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f?.type === 'application/pdf') setPdfFile(f);
                  else setStatus({ type: 'error', msg: 'Only PDF files accepted.' });
                }} className="hidden" />
                {pdfFile ? (
                  <div className="text-center">
                    <Plus className="w-6 h-6 text-accent2 mx-auto mb-2 rotate-45" />
                    <div className="text-sm text-ink font-bold">{pdfFile.name}</div>
                    <div className="text-xs text-muted mt-1">{(pdfFile.size / 1024).toFixed(1)} KB</div>
                    <div className="text-[10px] text-accent2 mt-2 uppercase tracking-widest">Click to replace</div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-full border border-dashed border-border2 flex items-center justify-center mx-auto mb-3 text-dim">⬆</div>
                    <div className="text-sm text-ink">Drop or click to select PDF</div>
                    <div className="text-xs text-muted mt-1">Max 50 MB</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status */}
          {status.msg && (
            <div className={status.type === 'error' ? 'msg-error' : 'msg-success'}>
              {status.msg}
            </div>
          )}

          {/* Generated IDs */}
          {generatedIds.length > 0 && (
            <div>
              <label className="label" style={{ fontSize: '0.58rem' }}>Generated Student IDs — distribute these</label>
              <div className="panel-elevated p-3 max-h-44 overflow-y-auto">
                <div className="grid grid-cols-5 gap-1.5">
                  {generatedIds.map(id => (
                    <div key={id}
                      className="border border-border hover:border-accent/40 hover:text-accent2 rounded-lg px-2 py-1.5 text-center text-[10px] font-mono text-muted select-all cursor-text transition-colors">
                      {id}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button onClick={handleCreate} disabled={loading}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
            style={{ borderRadius: '10px' }}>
            <Plus className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Deploying…' : 'Generate IDs & Deploy Exam'}
          </button>
        </div>
      </div>

      {/* ── Right: Active Exams ── */}
      <div className="flex-[1] panel flex flex-col overflow-hidden min-h-0" style={{ minWidth: '280px' }}>
        <div className="px-5 py-4 border-b border-border/60 flex-shrink-0">
          <div className="label mb-1" style={{ fontSize: '0.6rem' }}>Live Registry</div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink tracking-tight">Active Exams</h2>
            <span className="badge" style={{ fontSize: '0.58rem' }}>{allExams.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {allExams.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
              <div className="text-3xl opacity-20">◻</div>
              <span className="text-xs text-center">No active exams<br/><span className="text-dim text-[10px]">// null sector</span></span>
            </div>
          ) : allExams.map(({ dept: d, file: f }) => {
            const durs = (catalog as Record<string, unknown>)['_durations'] as Record<string, number> | undefined;
            const mins = durs?.[`${d}/${f}`];
            return (
              <div key={`${d}/${f}`}
                className="panel-elevated px-4 py-3 flex items-center justify-between gap-3 group hover:border-border2 transition-all">
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] text-dim uppercase tracking-widest mb-0.5">{d.replace(/-/g, ' ')}</div>
                  <div className="text-sm text-ink font-bold truncate">{f.replace('.enc', '')}</div>
                  {mins && (
                    <div className="flex items-center gap-1 mt-1">
                      <Timer className="w-2.5 h-2.5 text-accent2" />
                      <span className="text-[9px] text-accent2 font-bold">{mins} min</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setConfirmDelete({ dept: d, file: f })} disabled={loading} className="btn-danger flex-shrink-0 flex items-center gap-1.5"
                  style={{ padding: '6px 12px', fontSize: '0.62rem' }}>
                  <Trash2 className="w-3 h-3" /> End
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Delete Confirm Modal ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-bg/75 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 14 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="panel w-full max-w-md p-8"
            >
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-border/60">
                <div className="w-10 h-10 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-4 h-4 text-danger" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">Confirm End Exam</h3>
                  <p className="text-xs text-muted mt-0.5">This action is irreversible</p>
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed mb-3">You are about to permanently delete:</p>
              <div className="panel-elevated px-4 py-3 mb-5 font-mono text-sm text-ink border-l-2 border-danger/40 rounded-none">
                {confirmDelete!.dept} / {confirmDelete!.file}
              </div>
              <p className="text-xs text-dim leading-relaxed mb-6">
                All students currently viewing this exam will be immediately locked out. The encrypted file will be removed from GitHub.
              </p>

              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1 py-3" style={{ borderRadius: '10px' }}>
                  Cancel
                </button>
                <button
                  onClick={() => { handleEnd(confirmDelete!.dept, confirmDelete!.file); setConfirmDelete(null); }}
                  className="flex-[1.5] py-3 bg-danger text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-red-500 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Purge Exam
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
