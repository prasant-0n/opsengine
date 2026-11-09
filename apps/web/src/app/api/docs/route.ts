import { generateOpenApiSpec } from "@opsengine/api-contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  const spec = generateOpenApiSpec();
  const specJson = JSON.stringify(spec);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpsEngine API Documentation — OpenAPI 3.1</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --border: #1f2937;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --code-bg: #030712;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    header {
      background: #0f172a;
      border-bottom: 1px solid var(--border);
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .brand-badge {
      background: #1e3a8a;
      color: #93c5fd;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .brand h1 { font-size: 1.15rem; font-weight: 700; }
    .header-links a {
      color: #60a5fa;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      margin-left: 1.25rem;
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      border: 1px solid #1e293b;
      background: #0b1120;
      transition: all 0.2s;
    }
    .header-links a:hover {
      background: #1e293b;
      color: #93c5fd;
    }
    .container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    /* Sidebar */
    aside {
      width: 320px;
      background: #0b0f19;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .search-box {
      padding: 1rem;
      border-bottom: 1px solid var(--border);
    }
    .search-input {
      width: 100%;
      padding: 0.6rem 0.85rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #111827;
      color: var(--text);
      font-size: 0.875rem;
      outline: none;
    }
    .search-input:focus { border-color: var(--primary); }
    .tag-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem 0;
    }
    .tag-item {
      padding: 0.65rem 1.25rem;
      font-size: 0.875rem;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.15s;
    }
    .tag-item:hover, .tag-item.active {
      background: #1e293b;
      color: #ffffff;
      font-weight: 600;
    }
    .tag-count {
      background: #1f2937;
      font-size: 0.75rem;
      padding: 0.15rem 0.45rem;
      border-radius: 10px;
    }
    /* Content */
    main {
      flex: 1;
      overflow-y: auto;
      padding: 2rem;
    }
    .endpoint-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }
    .endpoint-header {
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      border-bottom: 1px solid var(--border);
      background: #131d2e;
    }
    .method-badge {
      font-size: 0.75rem;
      font-weight: 800;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-get { background: #0369a1; color: #e0f2fe; }
    .badge-post { background: #065f46; color: #d1fae5; }
    .badge-patch { background: #92400e; color: #fef3c7; }
    .badge-delete { background: #991b1b; color: #fee2e2; }
    .endpoint-path {
      font-family: monospace;
      font-size: 0.95rem;
      font-weight: 600;
      color: #f3f4f6;
    }
    .endpoint-summary {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-left: auto;
    }
    .endpoint-body {
      padding: 1.25rem;
    }
    .endpoint-desc {
      font-size: 0.875rem;
      color: #d1d5db;
      margin-bottom: 1rem;
    }
    .section-title {
      font-size: 0.8rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.05em;
      margin-top: 1rem;
      margin-bottom: 0.5rem;
    }
    pre {
      background: var(--code-bg);
      border: 1px solid #1f2937;
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.825rem;
      color: #e2e8f0;
      margin-top: 0.5rem;
    }
    .curl-box {
      position: relative;
    }
    .copy-btn {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      font-size: 0.75rem;
      padding: 0.3rem 0.6rem;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .copy-btn:hover { background: #334155; color: #fff; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>OpsEngine</h1>
      <span class="brand-badge">OpenAPI 3.1.0</span>
    </div>
    <div class="header-links">
      <a href="/api/openapi.json" target="_blank">Download OpenAPI JSON</a>
      <a href="/api/health" target="_blank">System Health</a>
      <a href="/api/metrics" target="_blank">Prometheus Metrics</a>
    </div>
  </header>
  <div class="container">
    <aside>
      <div class="search-box">
        <input type="text" id="searchInput" class="search-input" placeholder="Filter endpoints or paths...">
      </div>
      <div class="tag-list" id="tagList">
        <div class="tag-item active" data-tag="ALL">
          <span>All Endpoints</span>
          <span class="tag-count" id="totalCount">0</span>
        </div>
      </div>
    </aside>
    <main id="endpointsContainer">
      <!-- Rendered dynamically via JavaScript -->
    </main>
  </div>

  <script>
    const spec = ${specJson};

    const container = document.getElementById("endpointsContainer");
    const tagList = document.getElementById("tagList");
    const searchInput = document.getElementById("searchInput");
    const totalCountEl = document.getElementById("totalCount");

    let currentTag = "ALL";
    let searchQuery = "";

    // Parse all operations
    const operations = [];
    const tagCounts = {};

    for (const [path, methods] of Object.entries(spec.paths || {})) {
      for (const [method, op] of Object.entries(methods)) {
        const item = {
          path,
          method: method.toUpperCase(),
          summary: op.summary || "",
          description: op.description || op.summary || "",
          tags: op.tags || ["General"],
          parameters: op.parameters || [],
          requestBody: op.requestBody || null,
          responses: op.responses || {},
        };
        operations.push(item);

        for (const t of item.tags) {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        }
      }
    }

    totalCountEl.textContent = operations.length;

    // Render tag list
    for (const tag of spec.tags || []) {
      const count = tagCounts[tag.name] || 0;
      if (count === 0) continue;

      const el = document.createElement("div");
      el.className = "tag-item";
      el.dataset.tag = tag.name;
      el.innerHTML = '<span>' + tag.name + '</span><span class="tag-count">' + count + '</span>';
      el.addEventListener("click", () => {
        document.querySelectorAll(".tag-item").forEach(item => item.classList.remove("active"));
        el.classList.add("active");
        currentTag = tag.name;
        renderEndpoints();
      });
      tagList.appendChild(el);
    }

    // Filter and render
    function renderEndpoints() {
      container.innerHTML = "";

      const filtered = operations.filter(op => {
        const matchesTag = currentTag === "ALL" || op.tags.includes(currentTag);
        const matchesSearch = !searchQuery || 
          op.path.toLowerCase().includes(searchQuery) || 
          op.summary.toLowerCase().includes(searchQuery) ||
          op.method.toLowerCase().includes(searchQuery);
        return matchesTag && matchesSearch;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; text-align: center; margin-top: 4rem;">No matching endpoints found.</div>';
        return;
      }

      for (const op of filtered) {
        const card = document.createElement("div");
        card.className = "endpoint-card";

        const badgeClass = "badge-" + op.method.toLowerCase();
        const curlSnippet = 'curl -X ' + op.method + ' "http://localhost:3000' + op.path + '" \\\n  -H "Content-Type: application/json" \\\n  -H "Cookie: ops_session=<token>"';

        card.innerHTML = 
          '<div class="endpoint-header">' +
            '<span class="method-badge ' + badgeClass + '">' + op.method + '</span>' +
            '<span class="endpoint-path">' + op.path + '</span>' +
            '<span class="endpoint-summary">' + op.summary + '</span>' +
          '</div>' +
          '<div class="endpoint-body">' +
            '<p class="endpoint-desc">' + op.description + '</p>' +
            '<div class="section-title">cURL Command</div>' +
            '<div class="curl-box">' +
              '<button class="copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText); this.innerText=\\'Copied!\\'; setTimeout(() => this.innerText=\\'Copy\\', 1500)">Copy</button>' +
              '<pre>' + curlSnippet + '</pre>' +
            '</div>' +
          '</div>';

        container.appendChild(card);
      }
    }

    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderEndpoints();
    });

    renderEndpoints();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
