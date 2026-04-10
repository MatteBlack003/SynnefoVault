import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { decryptWithKeyring } from '../lib/crypto';
import { fetchFullCatalogFromAPI } from '../lib/github';
import { marked } from 'marked';
import { Lock, ChevronRight, RefreshCw, Timer, ShieldCheck } from 'lucide-react';

const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack',
  'flutter', 'cyber-security', 'digital-marketing', 'data-science',
];

const REPO_OWNER  = 'MatteBlack003';
const REPO_NAME   = 'SynnefoVault';
const PAGES_BASE  = `https://${REPO_OWNER.toLowerCase()}.github.io/${REPO_NAME}/`;
const CATALOG_KEY = 'synnefo_live_catalog';

interface Catalog { [dept: string]: string[]; }

const containerV: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const itemV: Variants = {
  hidden: { opacity: 0, x: -10 },
  show:   { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
};
const cardV: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show:   { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

export function Student() {
  const [catalog,        setCatalog]        = useState<Catalog>({});
  const [activeDept,     setActiveDept]     = useState(DEPARTMENTS[0]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [activeFile,      setActiveFile]      = useState<{ path: string; name: string } | null>(null);
  const [examCode,        setExamCode]        = useState('');
  const [decryptedHtml,   setDecryptedHtml]   = useState<string | null>(null);
  const [decryptedPdfUrl, setDecryptedPdfUrl] = useState<string | null>(null);
  const [timeLeft,        setTimeLeft]        = useState<number | null>(null);

  const [status,  setStatus]  = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  const hasExams = (c: Catalog) =>
    Object.entries(c).some(([k, v]) => k !== '_durations' && Array.isArray(v) && v.length > 0);

  const fetchCatalog = async () => {
    setCatalogLoading(true);
    // 1. localStorage
    try {
      const raw = localStorage.getItem(CATALOG_KEY);
      if (raw) {
        const d: Catalog = JSON.parse(raw);
        if (hasExams(d)) { setCatalog(d); setCatalogLoading(false); return; }
      }
    } catch { /**/ }
    // 2. raw.githubusercontent
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/public/catalog.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) { const d: Catalog = await res.json(); if (hasExams(d)) { setCatalog(d); setCatalogLoading(false); return; } }
    } catch { /**/ }
    // 3. Pages
    try {
      const isLocal = ['localhost','127.0.0.1'].includes(window.location.hostname);
      const url = isLocal ? `${import.meta.env.BASE_URL}catalog.json?t=${Date.now()}` : `${PAGES_BASE}catalog.json?t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) { const d: Catalog = await res.json(); if (hasExams(d)) { setCatalog(d); setCatalogLoading(false); return; } }
    } catch { /**/ }
    // 4. Git Trees API
    try { setCatalog(await fetchFullCatalogFromAPI(REPO_OWNER, REPO_NAME, DEPARTMENTS)); } catch { /**/ }
    setCatalogLoading(false);
  };

  useEffect(() => { fetchCatalog(); }, []);

  // Kill switch
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CATALOG_KEY && e.newValue) {
        try {
          const fresh: Catalog = JSON.parse(e.newValue);
          setCatalog(fresh);
          if (activeFile) {
            const [dept, fileName] = activeFile.path.split('/');
            const arr = fresh[dept];
            if (Array.isArray(arr) && !arr.includes(fileName)) {
              alert('SESSION TERMINATED — Administrator has ended this exam.');
              closeViewer();
            }
          }
        } catch { /**/ }
      }
    };
    window.addEventListener('storage', onStorage);
    let interval: ReturnType<typeof setInterval>;
    if (activeFile) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/public/catalog.json?t=${Date.now()}`, { cache: 'no-store' });
          if (res.ok) {
            const fresh: Catalog = await res.json();
            const [dept, fileName] = activeFile.path.split('/');
            const arr = fresh[dept];
            if (Array.isArray(arr) && !arr.includes(fileName)) {
              alert('SESSION TERMINATED — Administrator has ended this exam.');
              closeViewer();
            }
          }
        } catch { /**/ }
      }, 30_000);
    }
    return () => { window.removeEventListener('storage', onStorage); if (interval) clearInterval(interval); };
  }, [activeFile]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { alert('TIME EXPIRED — Your exam session has ended.'); closeViewer(); return; }
    const t = setInterval(() => setTimeLeft(p => p !== null ? p - 1 : null), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  // DRM
  useEffect(() => {
    if (!(decryptedHtml || decryptedPdfUrl) || !activeFile) return;
    const bc = (e: MouseEvent)   => e.preventDefault();
    const bk = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && 'cpsx a'.includes(e.key.toLowerCase())) e.preventDefault(); };
    document.addEventListener('contextmenu', bc);
    document.addEventListener('keydown', bk);
    document.body.classList.add('select-none');
    return () => { document.removeEventListener('contextmenu', bc); document.removeEventListener('keydown', bk); document.body.classList.remove('select-none'); };
  }, [decryptedHtml, decryptedPdfUrl, activeFile]);

  const handleDecrypt = async () => {
    if (!activeFile || !examCode) return;
    setLoading(true); setStatus({ type: '', msg: '' });
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${activeFile.path}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not retrieve exam file from server.');
      const payload   = await res.text();
      const decrypted = await decryptWithKeyring(examCode, payload);
      if (decrypted.startsWith('PDF:')) {
        const bytes   = Uint8Array.from(atob(decrypted.substring(4)), c => c.charCodeAt(0));
        setDecryptedPdfUrl(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })));
        setDecryptedHtml(null);
      } else {
        const md = decrypted.startsWith('MD:') ? decrypted.substring(3) : decrypted;
        setDecryptedHtml(marked.parse(md) as string);
        setDecryptedPdfUrl(null);
      }
      const durs = (catalog as Record<string, unknown>)['_durations'] as Record<string, number> | undefined;
      setTimeLeft(durs?.[activeFile.path] ? durs[activeFile.path] * 60 : null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setStatus({ type: 'error', msg: msg.includes('retrieve') ? 'Network error — could not download the exam.' : 'Access denied — invalid student ID.' });
    } finally { setLoading(false); }
  };

  const closeViewer = () => {
    if (decryptedPdfUrl) URL.revokeObjectURL(decryptedPdfUrl);
    setDecryptedHtml(null); setDecryptedPdfUrl(null);
    setActiveFile(null); setExamCode(''); setTimeLeft(null);
    setStatus({ type: '', msg: '' });
  };

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const timerDanger = timeLeft !== null && timeLeft <= 300;

  // Viewer toolbar
  const ViewerBar = () => (
    <div className="flex items-center justify-between px-8 py-4 border-b border-border/60 bg-surface/80 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <ShieldCheck className="w-4 h-4 text-accent2" />
        <span className="text-sm font-bold text-ink tracking-wide">{activeFile?.name}</span>
        <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
          DRM ACTIVE
        </span>
      </div>
      <div className="flex items-center gap-5">
        {timeLeft !== null && (
          <div className={`flex items-center gap-2 ${timerDanger ? 'text-danger animate-pulse' : 'text-accent2'}`}>
            <Timer className="w-3.5 h-3.5" />
            <span className="font-mono font-bold text-base tracking-widest">{fmtTime(timeLeft)}</span>
          </div>
        )}
        <button onClick={closeViewer} className="btn-secondary py-2 px-5 text-[10px]">
          End Session
        </button>
      </div>
    </div>
  );

  if (decryptedPdfUrl && activeFile) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-bg flex flex-col">
      {/* Watermark */}
      <div className="absolute inset-0 pointer-events-none z-20 opacity-[0.04] grid grid-cols-5 grid-rows-6 items-center justify-items-center">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="text-2xl font-bold text-ink -rotate-30 whitespace-nowrap tracking-widest">
            {examCode.toUpperCase()}
          </div>
        ))}
      </div>
      <ViewerBar />
      <iframe src={decryptedPdfUrl} className="flex-1 w-full border-0 z-10" title="Exam" />
    </motion.div>
  );

  if (decryptedHtml && activeFile) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-bg flex flex-col">
      <ViewerBar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-12">
          <div className="md-body prose max-w-none" dangerouslySetInnerHTML={{ __html: decryptedHtml }} />
        </div>
      </div>
    </motion.div>
  );

  const exams = (catalog[activeDept] || []).filter(f => typeof f === 'string');

  return (
    <div className="flex flex-1 gap-5 overflow-hidden min-h-0 w-full">
      {/* ── Sidebar ── */}
      <motion.nav
        variants={containerV} initial="hidden" animate="show"
        className="flex flex-col panel overflow-hidden"
        style={{ minWidth: '220px', maxWidth: '220px' }}
      >
        <div className="px-4 py-4 border-b border-border/60">
          <div className="label mb-1" style={{ fontSize: '0.6rem' }}>Departments</div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink font-bold">{DEPARTMENTS.length} Nodes</span>
            <button onClick={fetchCatalog} title="Refresh" className="p-1 rounded-full text-dim hover:text-accent2 transition-colors">
              <RefreshCw className={`w-3 h-3 ${catalogLoading ? 'animate-spin text-accent2' : ''}`} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-0.5">
          {DEPARTMENTS.map(d => (
            <motion.button
              variants={itemV} key={d}
              onClick={() => setActiveDept(d)}
              className={`nav-item ${activeDept === d ? 'active' : ''}`}
            >
              <span>{d.replace(/-/g, ' ')}</span>
              {activeDept === d && <ChevronRight className="w-3 h-3 text-accent2 flex-shrink-0" />}
            </motion.button>
          ))}
        </div>
      </motion.nav>

      {/* ── Exam grid ── */}
      <div className="flex flex-col flex-1 overflow-hidden min-h-0">
        {/* Section header */}
        <div className="flex items-end justify-between mb-5 flex-shrink-0">
          <div>
            <div className="label mb-1">// Active Formation</div>
            <h2 className="text-xl font-bold text-ink capitalize tracking-tight">
              {activeDept.replace(/-/g, ' ')}
            </h2>
          </div>
          {!catalogLoading && (
            <span className="badge" style={{ fontSize: '0.6rem' }}>
              {exams.length} exam{exams.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pb-4 pr-1">
          {catalogLoading ? (
            <div className="panel h-44 flex items-center justify-center gap-3 text-muted">
              <RefreshCw className="w-4 h-4 animate-spin text-accent2" />
              <span className="text-sm">Syncing catalog…</span>
            </div>
          ) : (
            <motion.div
              key={`${activeDept}-${exams.length}`}
              variants={containerV} initial="hidden" animate="show"
              className="grid grid-cols-2 gap-4"
            >
              {exams.length === 0 ? (
                <motion.div variants={cardV}
                  className="col-span-2 panel h-44 flex items-center justify-center flex-col gap-3 text-muted">
                  <div className="text-3xl opacity-20">◻</div>
                  <span className="text-sm">No exams scheduled</span>
                  <span className="text-[10px] text-dim uppercase tracking-widest">// null sector</span>
                </motion.div>
              ) : exams.map((file, i) => {
                const durs = (catalog as Record<string, unknown>)['_durations'] as Record<string, number> | undefined;
                const mins = durs?.[`${activeDept}/${file}`];
                return (
                  <motion.button
                    variants={cardV}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    key={file}
                    onClick={() => setActiveFile({ path: `${activeDept}/${file}`, name: file.replace('.enc', '') })}
                    className="panel text-left p-5 flex flex-col gap-4 group hover:border-border2 transition-all duration-200"
                    style={{ minHeight: '140px' }}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between w-full">
                      <span className="badge" style={{ fontSize: '0.58rem', padding: '2px 8px' }}>
                        #{String(i + 1).padStart(2, '0')}
                      </span>
                      <Lock className="w-3.5 h-3.5 text-dim group-hover:text-accent2 transition-colors" />
                    </div>
                    {/* Title */}
                    <div className="flex-1">
                      <div className="text-sm font-bold text-ink capitalize leading-tight mb-1 truncate group-hover:text-accent2 transition-colors">
                        {file.replace('.enc', '')}
                      </div>
                      <div className="text-[10px] text-dim uppercase tracking-widest">Encrypted payload</div>
                    </div>
                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      {mins ? (
                        <div className="flex items-center gap-1.5 text-accent2">
                          <Timer className="w-3 h-3" />
                          <span className="text-[10px] font-bold">{mins} min</span>
                        </div>
                      ) : <span className="text-[10px] text-dim">No time limit</span>}
                      <span className="text-[10px] text-dim uppercase tracking-widest">Click to open →</span>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Access Modal ── */}
      <AnimatePresence>
        {activeFile && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-50 bg-bg/75 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 14 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="panel w-full max-w-md p-8"
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-6 pb-5 border-b border-border/60">
                <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4 text-accent2" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">Access Required</h3>
                  <p className="text-[11px] text-muted mt-0.5 truncate max-w-xs">{activeFile.name}</p>
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed mb-5">
                This exam is cryptographically locked. Enter your assigned Student ID to decrypt and access the paper.
              </p>

              <div className="mb-4">
                <label className="label" style={{ fontSize: '0.6rem' }}>Student ID / Passkey</label>
                <input
                  type="password" autoFocus
                  value={examCode}
                  onChange={e => setExamCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDecrypt()}
                  className="input-base text-center text-lg font-bold tracking-[0.3em]"
                  placeholder="NET-A1"
                  style={{ borderRadius: '12px' }}
                />
              </div>

              <AnimatePresence>
                {status.msg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="msg-error mb-4"
                  >
                    {status.msg}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3 mt-2">
                <button onClick={() => setActiveFile(null)} className="btn-secondary flex-1 py-3">
                  Cancel
                </button>
                <button onClick={handleDecrypt} disabled={loading || !examCode} className="btn-primary flex-1 py-3">
                  {loading ? 'Verifying…' : 'Unlock Exam'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
