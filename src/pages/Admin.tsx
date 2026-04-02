import { useState, useEffect, useRef } from 'react';
import { encryptWithKeyring } from '../lib/crypto';
import { uploadToGitHub, deleteFromGitHub, fetchFullCatalogFromAPI, updateCatalogInRepo } from '../lib/github';

const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack', 'flutter', 'cyber-security', 'digital-marketing', 'data-science'
];

const REPO_OWNER = 'MatteBlack003';
const REPO_NAME = 'SynnefoVault';

interface Catalog {
  [dept: string]: string[];
}

export function Admin() {
  const [token, setToken] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Upload State
  const [dept, setDept] = useState('networking');
  const [filename, setFilename] = useState('');
  const [studentCount, setStudentCount] = useState(50);
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<'markdown' | 'pdf'>('markdown');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dashboard Tools
  const [catalog, setCatalog] = useState<Catalog>({});
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('sys_gh_token');
    const o = localStorage.getItem('sys_gh_owner');
    const r = localStorage.getItem('sys_gh_repo');
    if (t && o && r) {
      setToken(t); setOwner(o); setRepo(r);
      setIsLoggedIn(true);
      // Single API call to fetch entire catalog
      fetchFullCatalogFromAPI(o, r, DEPARTMENTS, t).then(setCatalog);
    }
  }, []);

  // Fetch live catalog using a single Git Trees API call
  const fetchLiveCatalog = async (authToken?: string) => {
    const effectiveToken = authToken || token;
    const effectiveOwner = owner || REPO_OWNER;
    const effectiveRepo = repo || REPO_NAME;
    const newCatalog = await fetchFullCatalogFromAPI(effectiveOwner, effectiveRepo, DEPARTMENTS, effectiveToken);
    setCatalog(newCatalog);
  };

  const handleLogin = () => {
    if (!token || !owner || !repo) return alert("Enter all credentials first.");
    localStorage.setItem('sys_gh_token', token);
    localStorage.setItem('sys_gh_owner', owner);
    localStorage.setItem('sys_gh_repo', repo);
    setIsLoggedIn(true);
    fetchLiveCatalog(token);
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setToken(''); setOwner(''); setRepo('');
  };

  // Generate an array of strictly unique Student IDs
  const generateUniqueIDs = (count: number, prefix: string): string[] => {
    const ids: Set<string> = new Set();
    while (ids.size < count) {
      const randomSegment = Array.from(window.crypto.getRandomValues(new Uint8Array(2)))
        .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      ids.add(`${prefix.toUpperCase()}-${randomSegment}`);
    }
    return Array.from(ids);
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setContent(''); // Clear markdown content if switching to PDF
    } else if (file) {
      setStatus({ type: 'error', msg: 'Only PDF files are accepted.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g. "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCreateExam = async () => {
    const hasContent = contentType === 'pdf' ? pdfFile !== null : content.trim() !== '';
    if(!filename || !hasContent) {
      setStatus({ type: 'error', msg: 'Filename and Content (PDF or Markdown) are strictly required.' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', msg: '' });
    setGeneratedIds([]);

    try {
      // 1. Generate N Student IDs mapped precisely to this specific paper
      const newIds = generateUniqueIDs(studentCount, dept.split('-')[0].substring(0, 3));
      
      // 2. Prepare content with type marker
      let payloadContent: string;
      if (contentType === 'pdf' && pdfFile) {
        const base64Data = await readFileAsBase64(pdfFile);
        payloadContent = `PDF:${base64Data}`;
      } else {
        payloadContent = `MD:${content}`;
      }

      // 3. Mathematically bind the IDs into an encrypted Keyring
      const payloadString = await encryptWithKeyring(newIds, payloadContent);
      
      const safeFilename = filename.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const targetPath = `${dept}/${safeFilename}.enc`;

      // 4. Directly Commit the Keyring File via the Admin Git Account
      await uploadToGitHub({
        repoOwner: owner,
        repoName: repo,
        path: targetPath,
        content: payloadString,
        message: `System: Init Exam on ${targetPath}`,
        token
      });

      setStatus({ type: 'success', msg: `SUCCESS: ${targetPath} injected into the Node. Distribute these exact Student IDs to the class:` });
      setGeneratedIds(newIds);
      setContent('');
      setPdfFile(null);
      setFilename('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Update local view AND sync catalog.json to the repo
      const updatedCatalog = { ...catalog };
      const dArr = updatedCatalog[dept] || [];
      updatedCatalog[dept] = [...dArr, `${safeFilename}.enc`];
      setCatalog(updatedCatalog);

      // Commit updated catalog.json so students immediately see the new exam
      try {
        await updateCatalogInRepo({ repoOwner: owner, repoName: repo, catalog: updatedCatalog, token });
      } catch { /* non-critical — the exam was already uploaded */ }

    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to push Keyring payload to node.';
      setStatus({ type: 'error', msg: `ERROR: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleEndExam = async (targetDept: string, targetFile: string) => {
    if (!confirm(`Are you certain you wish to purge and revoke all access to ${targetFile}? This is permanent.`)) return;

    setLoading(true);
    setStatus({ type: '', msg: '' });
    const targetPath = `${targetDept}/${targetFile}`;

    try {
      await deleteFromGitHub({
        repoOwner: owner,
        repoName: repo,
        path: targetPath,
        token
      });
      
      setStatus({ type: 'success', msg: `EXECUTED: ${targetFile} has been entirely deleted from the GitHub node. Access globally revoked.` });
      const updatedCatalog = {
        ...catalog,
        [targetDept]: (catalog[targetDept] || []).filter(f => f !== targetFile)
      };
      setCatalog(updatedCatalog);

      // Commit updated catalog.json so students immediately see the removal
      try {
        await updateCatalogInRepo({ repoOwner: owner, repoName: repo, catalog: updatedCatalog, token });
      } catch { /* non-critical — the exam was already deleted */ }

    } catch(err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to execute deletion protocol.';
      setStatus({ type: 'error', msg: `ERROR: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-[#010409] border border-white/20 text-white rounded p-3 mb-4 focus:outline-none focus:border-accent font-mono";
  const labelClass = "block text-muted text-sm font-bold mb-2 uppercase tracking-widest";

  // LOGIN GATEWAY
  if (!isLoggedIn) {
    return (
      <div className="flex-1 overflow-y-auto p-12 relative z-10 flex items-center justify-center font-mono">
        <div className="w-full max-w-md bg-surface backdrop-blur-3xl border border-white/10 rounded-xl p-10 shadow-2xl text-center">
          <h2 className="font-display text-accent text-xl tracking-widest mb-6">FACULTY AUTHORIZATION GATEWAY</h2>
          <div className="text-left">
            <label className={labelClass}>Master Team Lead Key</label>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} className={inputClass} placeholder="ghp_xxxxxxxxxxxx" />
            
            <label className={labelClass}>Institute Repo Owner</label>
            <input type="text" value={owner} onChange={e => setOwner(e.target.value)} className={inputClass} placeholder="e.g. MatteBlack003" />
            
            <label className={labelClass}>Repository Name</label>
            <input type="text" value={repo} onChange={e => setRepo(e.target.value)} className={inputClass} placeholder="SynnefoVault" />
            
            <button onClick={handleLogin} className="w-full bg-[#238636] text-white p-3 rounded font-bold hover:bg-[#2ea043] mt-4">AUTHORIZE ACCESS</button>
          </div>
        </div>
      </div>
    );
  }

  // SYSTEM DASHBOARD
  return (
    <div className="flex-1 overflow-y-auto p-8 relative z-10 font-mono flex gap-8">
      {/* Upload Panel */}
      <div className="flex-[2] bg-surface backdrop-blur-3xl border border-white/10 rounded-xl p-8 shadow-2xl h-fit">
        <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-6">
          <h2 className="font-display text-xl text-accent">EXAM KEYRING GENERATOR</h2>
          <div className="flex gap-2">
            <button onClick={() => fetchLiveCatalog()} className="text-xs border border-accent text-accent px-3 py-1 rounded hover:bg-accent/10">REFRESH</button>
            <button onClick={handleLogout} className="text-xs border border-[#f85149] text-[#f85149] px-3 py-1 rounded hover:bg-[#f85149]/10">DISCONNECT</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-4">
          <div>
            <label className={labelClass}>Department</label>
            <select value={dept} onChange={e => setDept(e.target.value)} className={inputClass}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Exam Filename</label>
            <input type="text" value={filename} onChange={e => setFilename(e.target.value)} className={inputClass} placeholder="e.g. mock-04" />
          </div>
          <div>
            <label className={labelClass}>Class Size (IDs to Generate)</label>
            <input type="number" min="1" max="200" value={studentCount} onChange={e => setStudentCount(parseInt(e.target.value, 10))} className={inputClass} />
          </div>
        </div>

        {/* Content Type Toggle */}
        <div className="mb-4">
          <label className={labelClass}>Content Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => { setContentType('markdown'); setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className={`flex-1 p-3 rounded font-bold text-sm border transition-all ${
                contentType === 'markdown'
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'border-white/20 text-muted hover:border-white/40'
              }`}
            >
              ✍️ MARKDOWN TEXT
            </button>
            <button
              onClick={() => { setContentType('pdf'); setContent(''); }}
              className={`flex-1 p-3 rounded font-bold text-sm border transition-all ${
                contentType === 'pdf'
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'border-white/20 text-muted hover:border-white/40'
              }`}
            >
              📄 PDF UPLOAD
            </button>
          </div>
        </div>

        {/* Content Input - Markdown or PDF */}
        {contentType === 'markdown' ? (
          <div>
            <label className={labelClass}>Question Paper Markdown</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} className={`${inputClass} h-64 font-mono text-sm leading-relaxed`} placeholder="# Question 1..." />
          </div>
        ) : (
          <div>
            <label className={labelClass}>Upload Question Paper (PDF)</label>
            <div className={`${inputClass} h-40 flex flex-col items-center justify-center border-dashed cursor-pointer hover:border-accent/50 transition-colors`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfSelect}
                className="hidden"
              />
              {pdfFile ? (
                <div className="text-center">
                  <div className="text-accent text-lg mb-2">📄</div>
                  <div className="text-accent text-sm font-bold">{pdfFile.name}</div>
                  <div className="text-muted text-xs mt-1">{(pdfFile.size / 1024).toFixed(1)} KB</div>
                  <div className="text-muted text-xs mt-2">Click to change file</div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-muted text-3xl mb-2">⬆️</div>
                  <div className="text-muted text-sm">Click to select a PDF file</div>
                  <div className="text-muted text-xs mt-1">Only .pdf files accepted</div>
                </div>
              )}
            </div>
          </div>
        )}

        {status.msg && (
          <div className={`p-4 rounded border mb-6 text-sm ${status.type === 'error' ? 'bg-[#f85149]/10 border-[#f85149] text-[#ff7b72]' : 'bg-[#238636]/10 border-[#238636] text-[#3fb950]'}`}>
            {status.msg}
          </div>
        )}

        {/* Display Generated Keys so the Team Leader can copy them */}
        {generatedIds.length > 0 && (
          <div className="mb-6 bg-[#010409] border border-accent/20 p-4 rounded h-40 overflow-y-auto">
             <div className="text-white text-xs mb-2">Generated Cryptographic Keys for {filename || 'exam'}:</div>
             <div className="grid grid-cols-4 gap-2 text-accent text-xs">
               {generatedIds.map(id => <div key={id} className="bg-accent/10 px-2 py-1 rounded select-all">{id}</div>)}
             </div>
          </div>
        )}

        <button onClick={handleCreateExam} disabled={loading} className="w-full bg-accent text-[#0d1117] font-bold tracking-widest p-4 rounded hover:bg-[#79b8ff] disabled:opacity-50">
          {loading ? 'GENERATING KEYRING & INJECTING TO NODE...' : 'GENERATE IDS & SECURE EXAM'}
        </button>
      </div>

      {/* Control Panel (End Exam) */}
      <div className="flex-1 bg-surface backdrop-blur-3xl border border-white/10 rounded-xl p-8 shadow-2xl h-fit">
        <h2 className="font-display text-lg text-[#f85149] border-b border-[#f85149]/30 pb-4 mb-6">LIVE EXAM CONTROL</h2>
        <p className="text-muted text-xs mb-6">Clicking END EXAM will physically delete the encrypted file off the GitHub repository, irrevocably revoking access for all Student IDs on the Keyring.</p>
        
        <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto">
          {Object.entries(catalog).flatMap(([d, files]) => 
            files.map(file => (
               <div key={`${d}/${file}`} className="flex justify-between items-center bg-[#010409] p-3 rounded border border-white/5 group hover:border-[#f85149]/50">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted uppercase">{d}</span>
                    <span className="text-white text-sm">{file}</span>
                  </div>
                  <button onClick={() => handleEndExam(d, file)} disabled={loading} className="text-xs bg-[#f85149]/20 text-[#f85149] hover:bg-[#f85149] hover:text-white px-3 py-2 rounded">
                    END EXAM
                  </button>
               </div>
            ))
          )}
          {Object.values(catalog).flat().length === 0 && (
             <div className="text-muted text-sm text-center">No live exams currently on node.</div>
          )}
        </div>
      </div>
    </div>
  );
}
