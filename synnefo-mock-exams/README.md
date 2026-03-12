# Synnefo Solutions - Mock Exams Platform

Welcome to the Synnefo Solutions Mock Exams repository! This repository uses **GitHub Pages** to host a fast, simple, and beautifully designed single-page website where students can access mock exam papers for all our training departments.

## 🔗 Platform Link
*(Once you enable GitHub Pages, put your live `.github.io` link here for the students!)*

---

## 👨‍🏫 Instructions for Team Leads

As a team lead, you are responsible for uploading your department's mock exams. It takes 2 easy steps: Note: You don't even need the command line; you can do this directly in the GitHub web interface!

### Step 1: Upload the Question Paper
1. Open this repository on GitHub.
2. Click on Add File -> Create new file (or Upload files).
3. We recommend organizing by folder. If the folder doesn't exist, you can type `networking/mock-exam-1.pdf` and GitHub will automatically create the `networking` folder for you.
4. Upload your PDF or assignment file and commit the changes.

### Step 2: Update the Index Page
So that students know the file is there, you need to link it on the main site.
1. Open `index.html` in the GitHub web interface and click the **Edit** (pencil) icon.
2. Find your department's card in the HTML. It will look like this:
   ```html
   <div class="card">
       <h2>🌐 Networking</h2>
       <ul class="exam-list">
           <p class="empty-state">No exams uploaded yet.</p>
       </ul>
   </div>
   ```
3. Remove the `<p class="empty-state">...` line, and add a link to your new file using an `<li>` tag:
   ```html
   <div class="card">
       <h2>🌐 Networking</h2>
       <ul class="exam-list">
           <li><a href="networking/mock-exam-1.pdf" target="_blank">Networking Mock Exam 1</a></li>
       </ul>
   </div>
   ```
4. Scroll down and click **Commit changes**.

That's it! GitHub Pages will automatically update the live website within 1 minute.

---

## 🚀 How to Setup GitHub Pages (For the Admin)
1. Push this repository to Synnefo Solutions's GitHub account.
2. Go to the repository **Settings**.
3. On the left sidebar, click on **Pages**.
4. Under "Build and deployment", set the source to **Deploy from a branch**.
5. Select the `main` (or `master`) branch and the `/ (root)` folder, then click **Save**.
6. Wait a minute, and your platform is live!
