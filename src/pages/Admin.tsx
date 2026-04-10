import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { encryptWithKeyring } from '../lib/crypto';
import { uploadToGitHub, deleteFromGitHub, fetchFullCatalogFromAPI, updateCatalogInRepo } from '../lib/github';

const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack', 'flutter', 'cyber-security', 'digital-marketing', 'data-science'
];

const REPO_OWNER = 'MatteBlack003';
const REPO_NAME   = 'SynnefoVault';
const CATALOG_KEY = 'synnefo_live_catalog';

interface Catalog { [dept: string]: string[]; }

function saveCatalog(c: Catalog) { localStorage.setItem(CATALOG_KEY, JSON.stringify(c)); }
function loadCatalog(): Catalog | null {
  const raw = localStorage.getItem(CATALOG_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// Must be a `function` declaration (not arrow) so it hoists before the useEffect that calls it
function mergeCatalogs(a: Catalog, b: Catalog): Catalog {
  const result: Catalog = {};
  for (const d of DEPARTMENTS) {
    const set = new Set([...(a[d] || []), ...(b[d] || [])]);
    result[d] = Array.from(set);
  }
  const durA = (a as Record<string, unknown>)['_durations'] as Record<string, number> || {};
  const durB = (b as Record<string, unknown>)['_durations'] as Record<string, number> || {};
  (result as Record<string, unknown>)['_durations'] = { ...durA, ...durB };
  return result;
}

export function Admin() {
  const navigate = useNavigate();

  // Auth
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo,  setRepo]  = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Upload form
  const [dept,         setDept]         = useState('networking');
  const [filename,     setFilename]     = useState('');
  const [studentCount, setStudentCount] = useState<number | ''>('');
  const [duration,     setDuration]     = useState<number | ''>('');
  const [content,      setContent]      = useState('');
  const [contentType,  setContentType]  = useState<'markdown' | 'pdf'>('markdown');
  const [pdfFile,      setPdfFile]      = useState<File | null>(null);
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dashboard
  const [catalog, setCatalog] = useState<Catalog>({});
  const [status,  setStatus]  = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ dept: string; file: string } | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('sys_gh_token');
    const o = localStorage.getItem('sys_gh_owner');
    const r = localStorage.getItem('sys_gh_repo');
    if (t && o && r) {
      setToken(t); setOwner(o); setRepo(r);
      setIsLoggedIn(true);
      const local = loadCatalog();
      if (local) setCatalog(local);
      // Wrapped in try/catch so an API failure doesn't crash the page
      fetchFullCatalogFromAPI(o, r, DEPARTMENTS, t)
        .then(apiCatalog => {
          const merged = mergeCatalogs(local || {}, apiCatalog);
          setCatalog(merged);
          saveCatalog(merged);
        })
        .catch(err => console.warn('Catalog API fetch failed:', err));
    }
  }, []);

  const fetchLiveCatalog = async (authToken?: string) => {
    try {
      const apiCatalog = await fetchFullCatalogFromAPI(
        owner  || REPO_OWNER,
        repo   || REPO_NAME,
        DEPARTMENTS,
        authToken || token
      );
      const local  = loadCatalog();
      const merged = mergeCatalogs(local || {}, apiCatalog);
      setCatalog(merged);
      saveCatalog(merged);
    } catch (err) {
      console.warn('Catalog refresh failed:', err);
    }
  };

  const handleLogin = () => {
    if (!token || !owner || !repo) return alert('Enter all credentials first.');
    localStorage.setItem('sys_gh_token', token);
    localStorage.setItem('sys_gh_owner', owner);
    localStorage.setItem('sys_gh_repo',  repo);
    setIsLoggedIn(true);
    fetchLiveCatalog(token);
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setToken(''); setOwner(''); setRepo('');
  };

  const generateUniqueIDs = (count: number, prefix: string): string[] => {
    const ids = new Set<string>();
    while (ids.size < count) {
      const rand = Array.from(window.crypto.getRandomValues(new Uint8Array(2)))
        .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      ids.add(`${prefix.toUpperCase()}-${rand}`);
    }
    return Array.from(ids);
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleCreateExam = async () => {
    const hasContent = contentType === 'pdf' ? pdfFile !== null : content.trim() !== '';
    if (!filename || !hasContent) {
      setStatus({ type: 'error', msg: 'Filename and content are required.' });
      return;
    }
    if (typeof studentCount !== 'number' || studentCount < 1 || studentCount > 200) {
      setStatus({ type: 'error', msg: 'Class size must be 1–200.' });
      return;
    }
    if (duration !== '' && (typeof duration !== 'number' || duration < 1 || duration > 600)) {
      setStatus({ type: 'error', msg: 'Duration must be 1–600 minutes (or leave blank).' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', msg: '' });
    setGeneratedIds([]);

    try {
      const newIds = generateUniqueIDs(studentCount, dept.split('-')[0].substring(0, 3));

      let payload: string;
      if (contentType === 'pdf' && pdfFile) {
        payload = `PDF:${await readFileAsBase64(pdfFile)}`;
      } else {
        payload = `MD:${content}`;
      }

      const encrypted    = await encryptWithKeyring(newIds, payload);
      const safeFilename = filename.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const targetPath   = `${dept}/${safeFilename}.enc`;

      await uploadToGitHub({ repoOwner: owner, repoName: repo, path: targetPath, content: encrypted, message: `Init: ${targetPath}`, token });

      setStatus({ type: 'success', msg: `✓ ${targetPath} deployed. Distribute the IDs below:` });
      setGeneratedIds(newIds);
      setContent(''); setPdfFile(null); setFilename(''); setDuration('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Safe catalog merge — never drops pre-existing exams
      const freshLocal = loadCatalog() || {};
      const updated    = mergeCatalogs(freshLocal, catalog);
      if (!( updated[dept] || []).includes(`${safeFilename}.enc`)) {
        updated[dept] = [...(updated[dept] || []), `${safeFilename}.enc`];
      }
      if (typeof duration === 'number' && duration > 0) {
        const d = (updated as Record<string, unknown>)['_durations'] as Record<string, number> || {};
        (updated as Record<string, unknown>)['_durations'] = { ...d, [targetPath]: duration };
      }
      setCatalog(updated);
      saveCatalog(updated);
      try { await updateCatalogInRepo({ repoOwner: owner, repoName: repo, catalog: updated, token }); } catch { /* non-critical */ }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deploy failed.';
      setStatus({ type: 'error', msg });
    } finally {
      setLoading(false);
    }
  };

  const handleEndExam = async (tDept: string, tFile: string) => {
    setLoading(true);
    setStatus({ type: '', msg: '' });
    const targetPath = `${tDept}/${tFile}`;
    try {
      await deleteFromGitHub({ repoOwner: owner, repoName: repo, path: targetPath, token });
      setStatus({ type: 'success', msg: `✓ ${tFile} purged. Access globally revoked.` });
      const updated = { ...catalog, [tDept]: (catalog[tDept] || []).filter(f => f !== tFile) };
      const durations = (updated as Record<string, unknown>)['_durations'] as Record<string, number> || {};
      delete durations[targetPath];
      (updated as Record<string, unknown>)['_durations'] = durations;
      setCatalog(updated);
      saveCatalog(updated);
      try { await updateCatalogInRepo({ repoOwner: owner, repoName: repo, catalog: updated, token }); } catch { /* non-critical */ }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed.';
      setStatus({ type: 'error', msg });
    } finally {
      setLoading(false);
    }
  };

  // ─── Login Gate ────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="panel p-8">
            {/* Header */}
            <div className="border-b border-border pb-6 mb-6">
              <div className="text-xs text-muted tracking-widest uppercase mb-2">/// Faculty Console</div>
              <h2 className="text-xl font-bold text-ink tracking-wide">Authentication Gateway</h2>
              <p className="text-sm text-muted mt-1">Enter your GitHub credentials to access the exam control panel.</p>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <label className="label">GitHub PAT (Personal Access Token)</label>
                <input type="password" value={token} onChange={e => setToken(e.target.value)}
                  className="input-base" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
              </div>
              <div>
                <label className="label">Repository Owner</label>
                <input type="text" value={owner} onChange={e => setOwner(e.target.value)}
                  className="input-base" placeholder="e.g. MatteBlack003" />
              </div>
              <div>
                <label className="label">Repository Name</label>
                <input type="text" value={repo} onChange={e => setRepo(e.target.value)}
                  className="input-base" placeholder="SynnefoVault"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
              <button onClick={handleLogin} className="btn-primary w-full py-3 text-sm mt-2">
                Authenticate
              </button>
              <button onClick={() => navigate('/')} className="btn-secondary w-full py-3 text-sm">
                ← Return to Student Portal
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────
  const allExams = Object.entries(catalog).flatMap(([d, files]) =>
    Array.isArray(files) ? files.map(f => ({ dept: d, file: f })) : []
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex gap-6 overflow-hidden min-h-0"
    >
      {/* ── Left: Key Generator ── */}
      <div className="flex-[2] panel overflow-y-auto">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div>
            <div className="text-[10px] text-muted tracking-widest uppercase mb-1">/// Encryption Engine</div>
            <h2 className="text-base font-bold text-ink tracking-wide">Key Generator</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => fetchLiveCatalog()} className="btn-secondary text-[10px] px-4 py-2">Refresh</button>
            <button onClick={handleLogout} className="btn-danger px-4 py-2">Disconnect</button>
            <button onClick={() => navigate('/')} className="btn-secondary text-[10px] px-4 py-2">← Portal</button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Form Row 1: dept + filename + class size + duration */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="label">Department</label>
              <select value={dept} onChange={e => setDept(e.target.value)} className="input-base">
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Exam Filename</label>
              <input type="text" value={filename} onChange={e => setFilename(e.target.value)}
                className="input-base" placeholder="e.g. mock-04" />
            </div>
            <div>
              <label className="label">Class Size</label>
              <input type="number" min="1" max="200" value={studentCount}
                onChange={e => setStudentCount(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="input-base" placeholder="e.g. 30" />
            </div>
            <div>
              <label className="label">Duration (min) <span className="normal-case text-dim font-normal tracking-normal">optional</span></label>
              <input type="number" min="1" max="600" value={duration}
                onChange={e => setDuration(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="input-base" placeholder="e.g. 90" />
            </div>
          </div>

          {/* Content type toggle */}
          <div>
            <label className="label">Content Format</label>
            <div className="flex gap-2 mt-1">
              {(['markdown', 'pdf'] as const).map(type => (
                <button key={type}
                  onClick={() => {
                    setContentType(type);
                    if (type === 'markdown') { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
                    else setContent('');
                  }}
                  style={contentType === type ? {
                    background: 'var(--accent)',
                    color: '#fff',
                    borderColor: 'var(--accent)',
                  } : {}}
                  className="flex-1 py-2 text-xs font-bold uppercase tracking-widest border border-border rounded-lg text-muted hover:text-ink hover:border-border2 transition-all"
                >
                  {type === 'markdown' ? '📝 Markdown' : '📄 PDF Upload'}
                </button>
              ))}
            </div>
          </div>

          {/* Content input */}
          {contentType === 'markdown' ? (
            <div>
              <label className="label">Question Paper Content (Markdown)</label>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                className="input-base min-h-[200px] resize-y text-xs leading-relaxed font-mono"
                placeholder="# Question 1&#10;&#10;Write your questions here..." />
            </div>
          ) : (
            <div>
              <label className="label">Upload PDF</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[160px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-surface2 transition-all"
              >
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f?.type === 'application/pdf') setPdfFile(f);
                    else setStatus({ type: 'error', msg: 'Only PDF files accepted.' });
                  }}
                  className="hidden" />
                {pdfFile ? (
                  <div className="text-center">
                    <div className="text-2xl mb-2">📄</div>
                    <div className="text-sm text-ink font-bold">{pdfFile.name}</div>
                    <div className="text-xs text-muted mt-1">{(pdfFile.size / 1024).toFixed(1)} KB</div>
                    <div className="text-xs text-accent mt-3">Click to change file</div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-3xl mb-2 opacity-40">⬆</div>
                    <div className="text-sm text-ink">Click to select PDF</div>
                    <div className="text-xs text-muted mt-1">One file at a time, max 50 MB</div>
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
              <label className="label">Generated Student IDs — distribute these</label>
              <div className="panel-elevated p-4 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-4 gap-2">
                  {generatedIds.map(id => (
                    <div key={id}
                      className="bg-bg border border-border px-2 py-1.5 rounded text-center text-xs font-mono text-ink select-all hover:border-accent hover:text-accent transition-colors cursor-text">
                      {id}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button onClick={handleCreateExam} disabled={loading} className="btn-primary w-full py-3 text-sm">
            {loading ? 'Deploying...' : '⚡ Generate IDs & Deploy Exam'}
          </button>
        </div>
      </div>

      {/* ── Right: Active Exams ── */}
      <div className="flex-[1] panel overflow-y-auto flex flex-col min-h-0">
        <div className="p-6 border-b border-border">
          <div className="text-[10px] text-muted tracking-widest uppercase mb-1">/// Live Registry</div>
          <h2 className="text-base font-bold text-ink">Active Exams</h2>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Purging an exam deletes it from GitHub — students lose access immediately.
          </p>
        </div>

        <div className="p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
          {allExams.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted">
                <div className="text-3xl mb-3 opacity-30">📂</div>
                <div className="text-sm">No active exams</div>
                <div className="text-xs mt-1 text-dim">Deploy an exam using the panel on the left</div>
              </div>
            </div>
          ) : (
            allExams.map(({ dept: d, file: f }) => {
              const durations = (catalog as Record<string, unknown>)['_durations'] as Record<string, number> | undefined;
              const mins = durations?.[`${d}/${f}`];
              return (
                <div key={`${d}/${f}`} className="panel-elevated px-4 py-3 flex justify-between items-center group hover:border-[rgba(239,68,68,0.3)] transition-all">
                  <div className="min-w-0 flex-1 mr-3">
                    <div className="text-[9px] text-muted uppercase tracking-widest mb-1">{d.replace(/-/g, ' ')}</div>
                    <div className="text-sm text-ink font-bold truncate">{f.replace('.enc', '')}</div>
                    {mins && <div className="text-[9px] text-accent mt-0.5 uppercase tracking-widest">⏱ {mins} min limit</div>}
                  </div>
                  <button
                    onClick={() => setConfirmDelete({ dept: d, file: f })}
                    disabled={loading}
                    className="btn-danger shrink-0"
                  >
                    End Exam
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Confirm Delete Modal ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className="panel max-w-md w-full p-8"
            >
              <h3 className="text-danger text-lg font-bold mb-2">Confirm End Exam</h3>
              <p className="text-muted text-sm leading-relaxed mb-1">
                This will permanently delete:
              </p>
              <div className="panel-elevated px-4 py-3 my-4 font-mono text-sm text-ink border-l-2 border-accent">
                {confirmDelete!.dept} / {confirmDelete!.file}
              </div>
              <p className="text-muted text-xs leading-relaxed mb-6">
                All students currently viewing this exam will lose access immediately. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1 py-3">
                  Cancel
                </button>
                <button
                  onClick={() => { handleEndExam(confirmDelete!.dept, confirmDelete!.file); setConfirmDelete(null); }}
                  className="flex-[1.5] py-3 bg-danger text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-red-600 transition-all"
                >
                  ⚠ Purge & End Exam
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
