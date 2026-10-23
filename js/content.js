// Everything a visitor can read in Boypje World lives here.
// Each island id matches an island in world.js.

const chips = (list) => `<div class="chips">${list.map((t) => `<span>${t}</span>`).join("")}</div>`;

const bar = (label, pct) => `
  <div class="bar"><div class="bar-top"><span>${label}</span><b>${pct}%</b></div>
  <div class="bar-track"><i style="--w:${pct}%"></i></div></div>`;

const projects = [
  {
    title: "AI Agent for Hospital Management",
    sub: "Intelligent decision support & data exploration",
    img: "assets/ai_agent_hospital.png",
    desc: "An AI assistant ecosystem that lets hospital staff explore operational data and internal documents with natural-language questions.",
    points: [
      ["Dual agent architecture", "a RAG document agent over hospital PDFs, plus a database agent over vectorized hospital data."],
      ["Document RAG", "policies, SOPs and reports are synced from Google Drive, embedded, and answered with sources."],
      ["Database vector agent", "PostgreSQL (Supabase) data is vectorized for semantic search and analytical Q&A."],
      ["Orchestration", "n8n automates ingestion, Drive sync, database updates and agent pipelines."],
      ["Query routing", "LangChain classifies each question and routes it to the right agent and model."],
    ],
    stack: ["Python", "LangChain", "n8n", "PostgreSQL", "Supabase", "Vector DB", "Google Drive API"],
  },
  {
    title: "Altari Restaurant POS & Management",
    sub: "Sales, inventory & financial reporting",
    img: "assets/pos_restaurant.png",
    desc: "A full-stack restaurant POS that speeds up the cashier and gives owners accurate, real-time business numbers.",
    points: [
      ["Point of sale", "automatic bill calculation, receipt printing and payment tracking."],
      ["Reporting", "daily, weekly and monthly sales, revenue summaries and transaction breakdowns."],
      ["Inventory", "real-time stock deduction, low-stock alerts and usage reports."],
      ["Impact", "less manual recording, fewer human errors, one source of truth."],
    ],
    stack: ["Laravel", "PHP", "MySQL", "Bootstrap"],
  },
  {
    title: "WhatsApp Blast & Monitoring CMS",
    sub: "Customer engagement & call-center monitoring",
    img: "assets/whatsapp_cms.png",
    desc: "Automates WhatsApp messaging while giving supervisors full visibility into call-center conversations.",
    points: [
      ["Laravel + Node.js", "Laravel backend integrated with a Node.js service on an extended Baileys API."],
      ["Conversation monitoring", "every message is logged so supervisors can review agent–customer chats."],
      ["Broadcast & compliance", "bulk broadcasts plus history tracking to catch misinformation or misconduct."],
      ["Impact", "more transparency, fewer disputes, wider and auditable marketing reach."],
    ],
    stack: ["Laravel", "PHP", "Node.js", "Baileys API", "Redis", "MySQL"],
  },
  {
    title: "Rent Car Operational & Management System",
    sub: "Fleet, booking & financial reporting",
    img: "assets/rent_car.png",
    desc: "A web system for running a rent-car business: fleet availability, bookings and financial performance.",
    points: [
      ["Multi-role access", "Super Admin, Operational Admin, Finance and Customer roles."],
      ["Rental calendar", "real-time availability, no double booking, automatic status changes."],
      ["Finance", "income, expenses, profit summaries and export-ready reports."],
    ],
    stack: ["Laravel", "PHP", "MySQL", "FullCalendar"],
  },
];

const journey = [
  ["Jul 2025 – Present", "East Java Provincial Government", "System & IT Administrator",
    "Manages and develops regional hospital information systems (SIMRS), designs enterprise data-warehouse architecture, and builds AI workflow automation with n8n. Administers Linux/Ubuntu production servers, security, deployments and backups under government IT-governance standards."],
  ["May 2024 – Jul 2025", "PT. Sahabat Sakinah Senter", "Information Technology Staff",
    "Built and maintained internal apps with Laravel and Node.js, managed MySQL and MongoDB, and supported hardware, software and network infrastructure across departments."],
  ["Feb – Jun 2023", "PT. Arkatama Multi Solusindo", "Software Tester & Documentation Specialist",
    "Manual and automated testing (Selenium Java, Katalon Studio) following STLC, black-box and regression testing, plus technical and end-user documentation."],
  ["Oct 2022 – Feb 2023", "Altari Restaurant", "Project Leader & Full-Stack Developer",
    "Led the full lifecycle of a restaurant cashier app with Waterfall: UML design, Laravel development, usability and black-box testing."],
  ["Aug – Dec 2022", "Brawijaya University", "Lecture Assistant – Computer Networks",
    "Ran practical sessions with Cisco Packet Tracer and Wireshark and helped students troubleshoot network fundamentals."],
];

export const PROJECTS = projects;
export const JOURNEY = journey;

export const ISLANDS_CONTENT = {
  spawn: {
    emoji: "🌱",
    title: "Welcome Gate",
    sub: "Where every guest lands",
    html: () => `
      <p>Welcome to <b>Boypje World</b>: a small sky archipelago where each island holds a piece of my portfolio. Follow the light beams and hop across the stepping stones, or just fly.</p>
      <h4>How to move</h4>
      <div class="keys">
        <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>walk, keep going to break into a run</span></div>
        <div><kbd>Space</kbd><span>jump, press again in the air to double-jump, hold to glide</span></div>
        <div><kbd>Shift</kbd><span>take off / land. While flying, <kbd>W</kbd> flies where the camera looks: drag the mouse up to climb, down to dive</span></div>
        <div><kbd>E</kbd><span>open the island you're standing on</span></div>
        <div><kbd>M</kbd><span>world map &amp; fast travel</span></div>
        <div><kbd>N</kbd><span>sound on / off</span></div>
        <div><span class="mouse">🖱</span><span>drag to look around, scroll to zoom</span></div>
      </div>
      <p class="muted">On a phone: left thumb moves, ☁️ takes off, swipe anywhere else to look and aim your flight.</p>`,
  },
  profile: {
    emoji: "🌳",
    title: "Profile Tree",
    sub: "Hello, I'm Primula",
    html: () => `
      <div class="profile">
        <img src="assets/profile_thumb.jpg" data-full="assets/profile_photo.PNG" alt="Primula Juventauricula" class="zoomable">
        <div>
          <h3>Primula Juventauricula</h3>
          <p class="role">Full-stack developer · Data engineer · AI automation</p>
          <p class="muted">📍 Sidoarjo, East Java, Indonesia</p>
        </div>
      </div>
      <p>I focus on <b>full-stack web development</b> and <b>data engineering</b>, using <b>AI automation</b> to build scalable systems.</p>
      <p>Right now I keep hospital information systems (<b>SIMRS</b>) and data warehouses running as a System &amp; IT Administrator for the <b>East Java Provincial Government</b>.</p>
      ${chips(["Laravel", "Node.js", "SIMRS", "Data Warehouse", "ETL", "n8n", "Linux Server"])}
      <p class="muted">Tip: the other islands hold my story, education, journey, skills, projects and contact.</p>`,
  },
  about: {
    emoji: "📖",
    title: "About Island",
    sub: "Who am I?",
    html: () => `
      <p>I'm an intermediate-level programmer with broad experience in <b>system development</b>, <b>server administration</b> and <b>data-warehouse engineering</b>. I work in public-sector technology governance, focused on healthcare information systems (SIMRS) and Linux/Ubuntu servers.</p>
      <p>I've architected scalable data solutions, managed production servers and built AI-driven workflow automation with n8n to make systems more reliable and teams more efficient.</p>
      <p>I like turning data into insight people can act on, and I care about clear, complete technical documentation.</p>
      <h4>Soft skills &amp; leadership</h4>
      <div class="grid2">
        <div><b>Public speaking</b><span>Webinar speaker &amp; trainer (200+ participants)</span></div>
        <div><b>Leadership</b><span>Vice chairman &amp; project team coordinator</span></div>
        <div><b>Project management</b><span>Waterfall, timelines &amp; documentation</span></div>
        <div><b>Critical thinking</b><span>Analytical problem solving</span></div>
        <div><b>Communication</b><span>Cross-team &amp; stakeholder collaboration</span></div>
        <div><b>Mentoring</b><span>Lecture assistant &amp; junior guidance</span></div>
        <div><b>Time management</b><span>Many projects, strict deadlines</span></div>
        <div><b>Adaptability</b><span>Fast learner with new tech</span></div>
      </div>
      <h4>Achievement</h4>
      <div class="award">🏆 <span><b>1st Place, Icon Design</b><br>Ministry of Religious Affairs</span></div>`,
  },
  education: {
    emoji: "🎓",
    title: "Education Isle",
    sub: "Where it started",
    html: () => `
      <div class="edu">
        <div class="edu-cap">🎓</div>
        <div>
          <h3>Brawijaya University</h3>
          <p class="role">Bachelor of Computer Science</p>
          <p class="muted">2020 – 2024 · Malang, East Java</p>
        </div>
      </div>
      <div class="stats">
        <div><b>3.72</b><span>GPA / 4.00</span></div>
        <div><b>4 yrs</b><span>Computer Science</span></div>
        <div><b>1</b><span>Semester as lecture assistant</span></div>
      </div>
      <h4>On campus</h4>
      <p><b>Lecture Assistant, Computer Networks</b> (Aug – Dec 2022): ran hands-on sessions with Cisco Packet Tracer and Wireshark and helped students troubleshoot network fundamentals.</p>
      <p>Also served as <b>vice chairman</b> and project team coordinator, and spoke at webinars for 200+ participants.</p>`,
  },
  experience: {
    emoji: "🧭",
    title: "Journey Cliffs",
    sub: "Professional journey · climb the pillars",
    html: () => `<div class="timeline">${journey.map(([when, org, role, text]) => `
      <div class="tl"><i></i><div><span class="when">${when}</span><h3>${role}</h3><p class="org">${org}</p><p>${text}</p></div></div>`).join("")}</div>`,
  },
  skills: {
    emoji: "💎",
    title: "Skill Crystals",
    sub: "Technical skills",
    html: () => `
      <h4>Programming &amp; frameworks</h4>
      ${bar("PHP & Laravel", 85)}${bar("JavaScript / Node.js", 80)}${bar("Python", 80)}${bar("Java", 75)}${bar("Golang", 65)}
      <h4>Database &amp; data engineering</h4>
      ${bar("MySQL / PostgreSQL", 85)}${bar("MongoDB / DB2", 80)}${bar("Data Warehouse & ETL", 80)}
      <h4>Infrastructure &amp; DevOps</h4>
      ${bar("Linux / Ubuntu Server", 85)}${bar("Server Deployment & Security", 80)}${bar("Backup & Performance Monitoring", 80)}
      <h4>Automation, testing &amp; AI</h4>
      ${bar("n8n Workflow Automation", 85)}${bar("Selenium / Automation Testing", 80)}${bar("Katalon / TestNG / Black-box", 75)}
      <h4>Creative tools</h4>
      ${chips(["Adobe Photoshop", "Blender 3D", "Figma", "3DVista"])}`,
  },
  projects: {
    emoji: "🛠️",
    title: "Project Plaza",
    sub: "Featured projects",
    html: () => projects.map((p) => `
      <article class="proj">
        <img src="${p.img}" alt="${p.title}" class="zoomable" loading="lazy">
        <h3>${p.title}</h3>
        <p class="role">${p.sub}</p>
        <p>${p.desc}</p>
        <details><summary>Details</summary><ul>${p.points.map(([b, t]) => `<li><b>${b}:</b> ${t}</li>`).join("")}</ul></details>
        ${chips(p.stack)}
      </article>`).join(""),
  },
  contact: {
    emoji: "🗼",
    title: "Lighthouse",
    sub: "Let's connect",
    html: () => `
      <p>Interested in <b>AI</b>, <b>healthcare systems</b> or <b>data engineering</b>? Let's build something together.</p>
      <div class="contacts">
        <a href="mailto:primulajuve@gmail.com"><span>✉️</span><div><b>Email</b>primulajuve@gmail.com</div></a>
        <a href="https://www.linkedin.com/in/primulajuve" target="_blank" rel="noopener"><span>💼</span><div><b>LinkedIn</b>in/primulajuve</div></a>
        <a href="https://github.com/boypje" target="_blank" rel="noopener"><span>🐙</span><div><b>GitHub</b>@boypje</div></a>
        <a href="https://instagram.com/primulajuve" target="_blank" rel="noopener"><span>📸</span><div><b>Instagram</b>@primulajuve</div></a>
        <div class="loc"><span>📍</span><div><b>Location</b>Sidoarjo, East Java</div></div>
      </div>
      <p class="muted">“Building the future, one line of code at a time.”</p>`,
  },
};
