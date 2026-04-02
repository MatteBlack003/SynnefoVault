import fs from 'fs';
import path from 'path';

// Define the departments mapping exactly as expected by the frontend
const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack', 'flutter', 'cyber-security', 'digital-marketing', 'data-science'
];

const REPO_OWNER = 'MatteBlack003';
const REPO_NAME = 'SynnefoVault';

const catalog = {};

async function generate() {
  const rootDir = path.resolve(process.cwd());
  const publicDir = path.join(rootDir, 'public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // First, scan local directories for .enc files
  for (const dept of DEPARTMENTS) {
    catalog[dept] = [];
    const deptPath = path.join(rootDir, dept);
    
    if (fs.existsSync(deptPath)) {
      const files = fs.readdirSync(deptPath);
      for (const file of files) {
        if (file.endsWith('.enc')) {
          catalog[dept].push(file);
        }
      }
    }
  }

  const localCount = Object.values(catalog).flat().length;

  // If no local files found, try fetching from GitHub (for dev environments)
  if (localCount === 0) {
    console.log('No local .enc files found. Attempting to fetch catalog from GitHub...');
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/main?recursive=1`
      );
      
      if (res.ok) {
        const data = await res.json();
        for (const item of data.tree) {
          if (item.type !== 'blob' || !item.path.endsWith('.enc')) continue;
          const parts = item.path.split('/');
          if (parts.length === 2 && DEPARTMENTS.includes(parts[0])) {
            catalog[parts[0]].push(parts[1]);
          }
        }
        console.log(`Fetched ${Object.values(catalog).flat().length} exams from GitHub.`);
      } else {
        console.warn(`GitHub API returned ${res.status}. Catalog will be empty.`);
      }
    } catch (err) {
      console.warn('Could not fetch from GitHub:', err.message);
    }
  }

  const catalogPath = path.join(publicDir, 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log(`Successfully generated catalog.json with ${Object.values(catalog).flat().length} exams.`);
}

generate();
