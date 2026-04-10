import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { decryptWithKeyring } from '../lib/crypto';
import { fetchFullCatalogFromAPI } from '../lib/github';
import { marked } from 'marked';
import { Lock, ChevronRight, RefreshCw } from 'lucide-react';

const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack', 'flutter', 'cyber-security', 'digital-marketing', 'data-science'
];

const REPO_OWNER = 'MatteBlack003';
const REPO_NAME  = 'SynnefoVault';
const PAGES_BASE = `https://${REPO_OWNER.toLowerCase()}.github.io/${REPO_NAME}/`;
const CATALOG_KEY = 'synnefo_live_catalog';

interface Catalog { [dept: string]: string[]; }

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.04 } }
};
const itemVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  show:   { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0,  transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export function Student() {
  const [catalog,        setCatalog]       = useState<Catalog>({});
  const [activeDept,     setActiveDept]    = useState(DEPARTMENTS[0]);
  const [catalogLoading, setCatalogLoading]= useState(true);

  const [activeFile,     setActiveFile]    = useState<{ path: string; name: string } | null>(null);
  const [examCode,       setExamCode]      = useState('');
  const [decryptedHtml,  setDecryptedHtml] = useState<string | null>(null);
  const [decryptedPdfUrl,setDecryptedPdfUrl] = useState<string | null>(null);
  const [timeLeft,       setTimeLeft]      = useState<number | null>(null);

  const [status,  setStatus]  = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  const hasExams = (c: Catalog) => Object.values(c).some(f => Array.isArray(f) && f.length > 0);

  const fetchCatalog = async () => {
    setCatalogLoading(true);

    // 1. localStorage (instant)
    try {
      const raw = localStorage.getItem(CATALOG_KEY);
      if (raw) {
        const data: Catalog = JSON.parse(raw);
        if (hasExams(data)) { setCatalog(data); setCatalogLoading(false); return; }
      }
    } catch { /* continue */ }

    // 2. raw.githubusercontent.com
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/public/catalog.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data: Catalog = await res.json();
        if (hasExams(data)) { setCatalog(data); setCatalogLoading(false); return; }
      }
    } catch { /* continue */ }

    // 3. GitHub Pages catalog.json
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const url = isLocal
        ? `${import.meta.env.BASE_URL}catalog.json?t=${Date.now()}`
        : `${PAGES_BASE}catalog.json?t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data: Catalog = await res.json();
        if (hasExams(data)) { setCatalog(data); setCatalogLoading(false); return; }
      }
    } catch { /* continue */ }

    // 4. Git Trees API (last resort)
    try {
      const live = await fetchFullCatalogFromAPI(REPO_OWNER, REPO_NAME, DEPARTMENTS);
      setCatalog(live);
    } catch { console.warn('All catalog sources failed.'); }

    setCatalogLoading(false);
  };

  useEffect(() => { fetchCatalog(); }, []);

  // Kill-switch daemon
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CATALOG_KEY && e.newValue) {
        try {
          const fresh: Catalog = JSON.parse(e.newValue);
          setCatalog(fresh);
          if (activeFile) {
            const [dept, fileName] = activeFile.path.split('/');
            const deptFiles = fresh[dept];
            // Only purge if the dept array exists and EXPLICITLY excludes this file
            if (Array.isArray(deptFiles) && !deptFiles.includes(fileName)) {
              alert('EXAM TERMINATED: Administrator has ended this session.');
              closeViewer();
            }
          }
        } catch { /* corrupt */ }
      }
    };
    window.addEventListener('storage', handleStorage);

    let interval: ReturnType<typeof setInterval>;
    if (activeFile) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(
            `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/public/catalog.json?t=${Date.now()}`,
            { cache: 'no-store' }
          );
          if (res.ok) {
            const fresh: Catalog = await res.json();
            const [dept, fileName] = activeFile.path.split('/');
            const deptFiles = fresh[dept];
            if (Array.isArray(deptFiles) && !deptFiles.includes(fileName)) {
              alert('EXAM TERMINATED: Administrator has ended this session.');
              closeViewer();
            }
          }
        } catch { /* network fail, ignore */ }
      }, 30_000);
    }

    return () => {
      window.removeEventListener('storage', handleStorage);
      if (interval) clearInterval(interval);
    };
  }, [activeFile]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      alert('TIME UP: Your exam session has expired.');
      closeViewer();
      return;
    }
    const tick = setInterval(() => setTimeLeft(prev => prev !== null ? prev - 1 : null), 1000);
    return () => clearInterval(tick);
  }, [timeLeft]);

  // DRM / Anti-cheating
  useEffect(() => {
    if (!(decryptedHtml || decryptedPdfUrl) || !activeFile) return;
    const blockCtx = (e: MouseEvent) => { e.preventDefault(); };
    const blockKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c','p','s','x','a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', blockCtx);
    document.addEventListener('keydown', blockKey);
    document.body.classList.add('select-none');
    return () => {
      document.removeEventListener('contextmenu', blockCtx);
      document.removeEventListener('keydown', blockKey);
      document.body.classList.remove('select-none');
    };
  }, [decryptedHtml, decryptedPdfUrl, activeFile]);

  const handleDecrypt = async () => {
    if (!activeFile || !examCode) return;
    setLoading(true);
    setStatus({ type: '', msg: '' });
    try {
      const rawUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${activeFile.path}?t=${Date.now()}`;
      const res = await fetch(rawUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not download the exam file from the server.');
      const payloadString = await res.text();
      const decrypted = await decryptWithKeyring(examCode, payloadString);

      if (decrypted.startsWith('PDF:')) {
        const bytes = Uint8Array.from(atob(decrypted.substring(4)), c => c.charCodeAt(0));
        const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        setDecryptedPdfUrl(blobUrl);
        setDecryptedHtml(null);
      } else {
        const md = decrypted.startsWith('MD:') ? decrypted.substring(3) : decrypted;
        setDecryptedHtml(marked.parse(md) as string);
        setDecryptedPdfUrl(null);
      }

      // Start timer if duration stored
      const durs = (catalog as Record<string, unknown>)['_durations'] as Record<string, number> | undefined;
      setTimeLeft(durs?.[activeFile.path] ? durs[activeFile.path] * 60 : null);

    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('download') || msg.includes('fetch')) {
        setStatus({ type: 'error', msg: 'Network error: could not download the exam file.' });
      } else {
        setStatus({ type: 'error', msg: 'Access denied: invalid student ID or passkey.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const closeViewer = () => {
    if (decryptedPdfUrl) URL.revokeObjectURL(decryptedPdfUrl);
    setDecryptedHtml(null);
    setDecryptedPdfUrl(null);
    setActiveFile(null);
    setExamCode('');
    setTimeLeft(null);
    setStatus({ type: '', msg: '' });
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const timerColor = timeLeft !== null && timeLeft <= 300 ? '#ef4444' : '#6366f1';

  // ── Viewer bar shared component ─────────────────────────────────────
  const ViewerBar = () => (
    <div className="flex justify-between items-center px-8 py-4 bg-surface border-b border-border relative z-10">
      <div className="flex items-center gap-4">
        <span className="text-base font-bold text-ink tracking-wide">{activeFile?.name}</span>
        <span className="text-[10px] font-bold text-danger uppercase tracking-widest bg-danger/10 px-2 py-0.5 rounded">
          DRM Active
        </span>
      </div>
      <div className="flex items-center gap-6">
        {timeLeft !== null && (
          <div className="font-mono font-bold text-lg" style={{ color: timerColor }}>
            {formatTime(timeLeft)}
          </div>
        )}
        <button onClick={closeViewer}
          className="btn-secondary py-2 px-5 text-xs">
          End Session
        </button>
      </div>
    </div>
  );

  // ── PDF Viewer ───────────────────────────────────────────────────────
  if (decryptedPdfUrl && activeFile) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 bg-bg flex flex-col overflow-hidden"
      >
        {/* Watermark */}
        <div className="absolute inset-0 pointer-events-none z-20 opacity-[0.04] grid grid-cols-5 grid-rows-6 items-center justify-items-center">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="text-3xl font-bold text-ink -rotate-30 whitespace-nowrap">
              {examCode.toUpperCase()}
            </div>
          ))}
        </div>
        <ViewerBar />
        <iframe src={decryptedPdfUrl} className="flex-1 w-full border-0 relative z-10" title="Exam PDF" />
      </motion.div>
    );
  }

  // ── Markdown Viewer ───────────────────────────────────────────────────
  if (decryptedHtml && activeFile) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 bg-bg flex flex-col overflow-hidden"
      >
        <ViewerBar />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-12">
            <div
              className="md-body prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: decryptedHtml }}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Main Dashboard ────────────────────────────────────────────────────
  const exams = (catalog[activeDept] || []).filter(f => typeof f === 'string');

  return (
    <div className="flex-1 grid grid-cols-[260px_1fr] gap-6 min-h-0 overflow-hidden">
      {/* Sidebar */}
      <motion.div
        variants={containerVariants} initial="hidden" animate="show"
        className="panel flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-muted tracking-widest uppercase mb-0.5">/// Navigation</div>
              <div className="text-sm font-bold text-ink">Departments</div>
            </div>
            <button onClick={fetchCatalog} title="Refresh" className="text-muted hover:text-ink transition-colors p-1">
              <RefreshCw className={`w-3.5 h-3.5 ${catalogLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {DEPARTMENTS.map(d => (
            <motion.button
              variants={itemVariants}
              key={d}
              onClick={() => setActiveDept(d)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex justify-between items-center transition-all duration-150 group ${
                activeDept === d
                  ? 'bg-accent/20 text-ink border border-accent/30'
                  : 'text-muted hover:bg-surface2 hover:text-ink'
              }`}
            >
              <span className="capitalize font-medium">{d.replace(/-/g, ' ')}</span>
              {activeDept === d && (
                <ChevronRight className="w-3.5 h-3.5 text-accent flex-shrink-0" />
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Exam grid */}
      <div className="flex flex-col overflow-hidden">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-[10px] text-muted tracking-widest uppercase mb-1">/// Available Exams</div>
            <h2 className="text-xl font-bold text-ink capitalize">{activeDept.replace(/-/g, ' ')}</h2>
          </div>
          {!catalogLoading && (
            <div className="text-xs text-muted">{exams.length} exam{exams.length !== 1 ? 's' : ''} available</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {catalogLoading ? (
            <div className="panel h-48 flex items-center justify-center gap-3 text-muted">
              <RefreshCw className="w-4 h-4 animate-spin text-accent" />
              <span className="text-sm">Loading exams…</span>
            </div>
          ) : (
            <motion.div
              key={`${activeDept}-${exams.length}`}
              variants={containerVariants} initial="hidden" animate="show"
              className="grid grid-cols-2 gap-4 pb-4"
            >
              {exams.length === 0 ? (
                <motion.div variants={cardVariants}
                  className="col-span-2 panel h-48 flex items-center justify-center flex-col text-muted">
                  <div className="text-3xl mb-3 opacity-30">📂</div>
                  <div className="text-sm">No exams in this department</div>
                </motion.div>
              ) : (
                exams.map((file, i) => {
                  const durs = (catalog as Record<string, unknown>)['_durations'] as Record<string, number> | undefined;
                  const mins = durs?.[`${activeDept}/${file}`];
                  return (
                    <motion.button
                      variants={cardVariants}
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      key={file}
                      onClick={() => setActiveFile({ path: `${activeDept}/${file}`, name: file.replace('.enc', '') })}
                      className="panel panel-elevated text-left p-5 flex flex-col gap-3 hover:border-accent/40 transition-all group"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-muted uppercase tracking-widest bg-surface px-2 py-0.5 rounded border border-border">
                          #{String(i + 1).padStart(2, '0')}
                        </span>
                        <Lock className="w-3.5 h-3.5 text-dim group-hover:text-accent transition-colors" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-ink capitalize mb-1 truncate">
                          {file.replace('.enc', '')}
                        </div>
                        <div className="text-xs text-muted">Encrypted exam</div>
                        {mins && (
                          <div className="text-[10px] text-accent mt-1 font-bold">⏱ {mins} min</div>
                        )}
                      </div>
                    </motion.button>
                  );
                })
              )}
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
            className="absolute inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="panel w-full max-w-md p-8"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-lg font-bold text-ink mb-1">Access Required</h3>
                <p className="text-sm text-muted leading-relaxed">
                  <span className="text-ink font-semibold">{activeFile.name}</span> is encrypted.
                  <br />Enter your student ID to unlock.
                </p>
              </div>

              <div className="mb-4">
                <label className="label">Student ID / Passkey</label>
                <input
                  type="password"
                  autoFocus
                  value={examCode}
                  onChange={e => setExamCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDecrypt()}
                  className="input-base text-center text-lg tracking-[0.3em] font-bold"
                  placeholder="e.g. NET-A1"
                />
              </div>

              <AnimatePresence>
                {status.msg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="msg-error mb-4"
                  >
                    {status.msg}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3">
                <button onClick={() => setActiveFile(null)} className="btn-secondary flex-1 py-3">
                  Cancel
                </button>
                <button
                  onClick={handleDecrypt}
                  disabled={loading || !examCode}
                  className="btn-primary flex-1 py-3"
                >
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
