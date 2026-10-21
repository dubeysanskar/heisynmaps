// Generates ready-to-paste request samples for an ENDPOINTS entry.

function buildPath(endpoint) {
  let path = endpoint.path;
  for (const [k, v] of Object.entries(endpoint.example?.path || {})) path = path.replace(`{${k}}`, v);
  return path;
}

function queryString(endpoint) {
  const entries = Object.entries(endpoint.example?.query || {}).map(([k, v]) => [k, String(v)]);
  return new URLSearchParams(entries).toString();
}

const needsKey = (endpoint) => endpoint.slug !== "status";
const hasBody = (endpoint) => ["POST", "PATCH"].includes(endpoint.method) && endpoint.example?.body;

export function snippets(endpoint, origin) {
  const qs = queryString(endpoint);
  const url = `${origin}${buildPath(endpoint)}${qs ? `?${qs}` : ""}`;
  const body = hasBody(endpoint) ? endpoint.example.body : null;
  const json = body ? JSON.stringify(body, null, 2) : null;
  const key = needsKey(endpoint);

  const curl = [
    `curl${endpoint.method === "GET" ? "" : ` -X ${endpoint.method}`} "${url}"`,
    key && `  -H "X-Api-Key: $NAKSHA_KEY"`,
    body && `  -H "Content-Type: application/json"`,
    body && `  -d '${JSON.stringify(body)}'`,
  ]
    .filter(Boolean)
    .join(" \\\n");

  const headersJs = [key && `"X-Api-Key": process.env.NAKSHA_KEY`, body && `"Content-Type": "application/json"`].filter(Boolean);
  const fetchOptions = [
    endpoint.method !== "GET" && `method: "${endpoint.method}"`,
    headersJs.length && `headers: { ${headersJs.join(", ")} }`,
    body && `body: JSON.stringify(${indent(json, 2).trimStart()})`,
  ].filter(Boolean);

  const javascript = `const res = await fetch("${url}"${
    fetchOptions.length ? `, {\n  ${fetchOptions.join(",\n  ")},\n}` : ""
  });
if (!res.ok) {
  const { error } = await res.json();
  throw new Error(\`\${error.code}: \${error.message}\`);
}
const data = await res.json();
console.log(data);`;

  const node = `// Node.js 18+ (built-in fetch). Keep server keys out of browser code.
const NAKSHA_KEY = process.env.NAKSHA_KEY;

async function main() {
  const res = await fetch("${url}", {
    method: "${endpoint.method}",
    headers: {${key ? `\n      "X-Api-Key": NAKSHA_KEY,` : ""}${body ? `\n      "Content-Type": "application/json",` : ""}
    },${body ? `\n    body: JSON.stringify(${indent(json, 4).trimStart()}),` : ""}
  });
  const data = await res.json();
  if (!res.ok) throw new Error(\`\${data.error.code}: \${data.error.message}\`);
  return data;
}

main().then((data) => console.log(JSON.stringify(data, null, 2)));`;

  const pyHeaders = [key && `"X-Api-Key": os.environ["NAKSHA_KEY"]`].filter(Boolean);
  const python = `import os
import requests

res = requests.${endpoint.method.toLowerCase()}(
    "${origin}${buildPath(endpoint)}",${
      qs ? `\n    params=${pyLiteral(endpoint.example.query)},` : ""
    }${pyHeaders.length ? `\n    headers={${pyHeaders.join(", ")}},` : ""}${body ? `\n    json=${indent(pyLiteral(body, true), 4).trimStart()},` : ""}
    timeout=30,
)
res.raise_for_status()
print(res.json())`;

  return [
    { id: "curl", label: "cURL", lang: "bash", code: curl },
    { id: "js", label: "JavaScript", lang: "js", code: javascript },
    { id: "python", label: "Python", lang: "python", code: python },
    { id: "node", label: "Node.js", lang: "js", code: node },
  ];
}

// Pretty JSON that keeps short arrays of plain values (coordinates, bboxes) on one line.
export function prettyJson(value) {
  return JSON.stringify(value, null, 2).replace(/\[\n\s+([^[\]{}]*?)\n\s*\]/g, (match, inner) => {
    const flat = `[${inner.split(/,\n\s+/).join(", ")}]`;
    return flat.length <= 90 ? flat : match;
  });
}

function indent(text, spaces) {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? line : pad + line))
    .join("\n");
}

// JSON → Python literal (True/False/None).
function pyLiteral(value, pretty = false) {
  return JSON.stringify(value, null, pretty ? 4 : undefined)
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None");
}
