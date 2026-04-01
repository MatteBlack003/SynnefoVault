import fs from 'fs';
import path from 'path';

// Define the departments mapping exactly as expected by the frontend
const DEPARTMENTS = [
  'networking', 'devops', 'python-full-stack', 'mern-stack', 'flutter', 'cyber-security', 'digital-marketing', 'data-science'
];

const catalog = {};

function generate() {
  const rootDir = path.resolve(process.cwd());
  const publicDir = path.join(rootDir, 'public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  for (const dept of DEPARTMENTS) {
    catalog[dept] = [];
    const deptPath = path.join(rootDir, dept);
    
    // Create the folder if it doesn't exist to avoid errors and support admin uploading
    if (!fs.existsSync(deptPath)) {
       fs.mkdirSync(deptPath, { recursive: true });
    }

    const files = fs.readdirSync(deptPath);
    for (const file of files) {
      if (file.endsWith('.enc')) {
        catalog[dept].push(file);
      }
    }
  }

  const catalogPath = path.join(publicDir, 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log(`Successfully generated catalog.json with ${Object.values(catalog).flat().length} exams.`);
}

generate();
