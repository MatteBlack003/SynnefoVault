import os
import string
import urllib.parse

DEPARTMENTS = {
    "networking": "networking_links",
    "cyber-security": "cyber_security_links",
    "devops": "devops_links",
    "flutter": "flutter_links",
    "mern-stack": "mern_stack_links",
    "python": "python_links",
    "digital-marketing": "digital_marketing_links",
}

def generate():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    template_path = os.path.join(base_dir, "template.html")
    if not os.path.exists(template_path):
        return
        
    with open(template_path, "r", encoding="utf-8") as f:
        template_str = f.read()

    template = string.Template(template_str)
    replacements = {}
    
    for dept, key in DEPARTMENTS.items():
        dept_path = os.path.join(base_dir, dept)
        links = []
        if os.path.exists(dept_path):
            files = sorted([f for f in os.listdir(dept_path) if os.path.isfile(os.path.join(dept_path, f)) and not f.startswith('.')])
            for file in files:
                filepath = f"{dept}/{urllib.parse.quote(file)}"
                links.append(f'<li><a href="{filepath}" target="_blank">{file}</a></li>')
        
        if not links:
            replacements[key] = '<p class="empty-state">No exams uploaded yet.</p>'
        else:
            replacements[key] = "\n                    ".join(links)
    
    html = template.safe_substitute(replacements)
    
    with open(os.path.join(base_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

import argparse
import time

def watch_directories():
    print("Watching directories for changes... (Press Ctrl+C to stop)")
    last_state = {}
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Run once initially
    generate()
    
    try:
        while True:
            current_state = {}
            for dept in DEPARTMENTS.keys():
                dept_path = os.path.join(base_dir, dept)
                if os.path.exists(dept_path):
                    files = [f for f in os.listdir(dept_path) if os.path.isfile(os.path.join(dept_path, f)) and not f.startswith('.')]
                    current_state[dept] = set(files)
                else:
                    current_state[dept] = set()
            
            if not last_state:
                last_state = current_state
            elif current_state != last_state:
                print("\n[+] Change detected! Regenerating index.html...")
                generate()
                last_state = current_state
                
            time.sleep(2)
    except KeyboardInterrupt:
        print("\nWatcher stopped.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Synnefo Mock Exams Index")
    parser.add_argument("--watch", action="store_true", help="Continuously watch for file additions/deletions and auto-update index.html")
    args = parser.parse_args()
    
    if args.watch:
        watch_directories()
    else:
        generate()
