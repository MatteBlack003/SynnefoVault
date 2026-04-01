import { useState, useEffect } from 'react';
import { encryptWithKeyring } from '../lib/crypto';
import { uploadToGitHub, deleteFromGitHub } from '../lib/github';

const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack', 'flutter', 'cyber-security', 'digital-marketing', 'data-science'
];

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
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  
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
      fetchCatalog();
    }
  }, []);

  const fetchCatalog = () => {
    fetch(import.meta.env.BASE_URL + 'catalog.json')
      .then(res => res.json())
      .then(data => setCatalog(data))
      .catch(() => setCatalog({}));
  };

  const handleLogin = () => {
    if (!token || !owner || !repo) return alert("Enter all credentials first.");
    localStorage.setItem('sys_gh_token', token);
    localStorage.setItem('sys_gh_owner', owner);
    localStorage.setItem('sys_gh_repo', repo);
    setIsLoggedIn(true);
    fetchCatalog();
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

  const handleCreateExam = async () => {
    if(!filename || !content) {
      setStatus({ type: 'error', msg: 'Filename and Content are strictly required.' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', msg: '' });
    setGeneratedIds([]);

    try {
      // 1. Generate N Student IDs mapped precisely to this specific paper
      const newIds = generateUniqueIDs(studentCount, dept.split('-')[0].substring(0, 3));
      
      // 2. Mathematically bind the IDs into an encrypted Keyring
      const payloadString = await encryptWithKeyring(newIds, content);
      
      const safeFilename = filename.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const targetPath = `${dept}/${safeFilename}.enc`;

      // 3. Directly Commit the Keyring File via the Admin Git Account
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
      setFilename('');
      
      // Update local view so we don't have to wait for the GH Pages Action to finish
      setCatalog(prev => {
        const dArr = prev[dept] || [];
        return { ...prev, [dept]: [...dArr, `${safeFilename}.enc`] };
      });

    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: `ERROR: ${err.message || 'Failed to push Keyring payload to node.'}` });
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
      setCatalog(prev => ({
        ...prev,
        [targetDept]: prev[targetDept].filter(f => f !== targetFile)
      }));

    } catch(err: any) {
      console.error(err);
      setStatus({ type: 'error', msg: `ERROR: ${err.message || 'Failed to execute deletion protocol.'}` });
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
            <input type="text" value={owner} onChange={e => setOwner(e.target.value)} className={inputClass} placeholder="e.g. SynnefoExams" />
            
            <label className={labelClass}>Repository Name</label>
            <input type="text" value={repo} onChange={e => setRepo(e.target.value)} className={inputClass} placeholder="mock-exams" />
            
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
          <button onClick={handleLogout} className="text-xs border border-[#f85149] text-[#f85149] px-3 py-1 rounded hover:bg-[#f85149]/10">DISCONNECT</button>
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

        <div>
           <label className={labelClass}>Question Paper Markdown</label>
           <textarea value={content} onChange={e => setContent(e.target.value)} className={`${inputClass} h-64 font-mono text-sm leading-relaxed`} placeholder="# Question 1..." />
        </div>

        {status.msg && (
          <div className={`p-4 rounded border mb-6 text-sm ${status.type === 'error' ? 'bg-[#f85149]/10 border-[#f85149] text-[#ff7b72]' : 'bg-[#238636]/10 border-[#238636] text-[#3fb950]'}`}>
            {status.msg}
          </div>
        )}

        {/* Display Generated Keys so the Team Leader can copy them */}
        {generatedIds.length > 0 && (
          <div className="mb-6 bg-[#010409] border border-accent/20 p-4 rounded h-40 overflow-y-auto">
             <div className="text-white text-xs mb-2">Generated Cryptographic Keys for {filename}:</div>
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
