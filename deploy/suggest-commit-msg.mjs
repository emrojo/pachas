import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = process.cwd();

// 1. Check if inside a git repository
try {
  execSync('git rev-parse --is-inside-work-tree', { cwd: rootDir, stdio: 'ignore' });
} catch {
  console.error('❌ Error: No estás dentro de un repositorio Git.');
  process.exitCode = 1;
  throw new Error('Not inside git work tree');
}

// 2. Read API Key from api_key.txt
const keyPath = path.join(rootDir, 'api_key.txt');
if (!fs.existsSync(keyPath)) {
  console.error(`❌ Error: No se encontró el archivo de API Key en: ${keyPath}`);
  console.error('Crea el archivo "api_key.txt" en la raíz del proyecto con tu clave de Google Gemini.');
  process.exitCode = 1;
  throw new Error('Missing api_key.txt');
}

const apiKey = fs.readFileSync(keyPath, 'utf8').trim().replace(/["']/g, '');
if (!apiKey) {
  console.error('❌ Error: El archivo api_key.txt está vacío.');
  process.exitCode = 1;
  throw new Error('Empty api_key.txt');
}

// 3. Inspect git status (unstaged and staged changes)
let status = '';
try {
  status = execSync('git status -s', { cwd: rootDir, encoding: 'utf8' }).trim();
} catch (e) {
  console.error('❌ Error al verificar git status:', e.message);
  process.exitCode = 1;
  throw e;
}

if (!status) {
  console.log('ℹ️  No se detectaron cambios pendientes en Git para commitear.');
  process.exitCode = 1;
  throw new Error('No git changes');
}

console.log('📂 Ficheros modificados detectados:');
const statusLines = status.split('\n').slice(0, 15);
statusLines.forEach(l => console.log('   ' + l));
if (status.split('\n').length > 15) {
  console.log(`   ... y ${status.split('\n').length - 15} ficheros más.`);
}
console.log('');

// 4. Gather git diff stats and patch preview
let statSummary = '';
try {
  statSummary = execSync('git diff HEAD --stat', { cwd: rootDir, encoding: 'utf8' }).trim() ||
                execSync('git diff --stat', { cwd: rootDir, encoding: 'utf8' }).trim();
} catch {}

let diffPatch = '';
try {
  diffPatch = execSync('git diff HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  if (!diffPatch) {
    diffPatch = execSync('git diff', { cwd: rootDir, encoding: 'utf8' }).trim() + '\n' +
                execSync('git diff --cached', { cwd: rootDir, encoding: 'utf8' }).trim();
  }
} catch {}

if (diffPatch.length > 4000) {
  diffPatch = diffPatch.substring(0, 4000) + '\n... [truncated]';
}

console.log('🤖 Consultando a Gemini para generar propuesta de mensaje de commit...');

const prompt = `
You are a senior software developer reviewing git changes.
Analyze these git modifications:

--- GIT STATUS ---
${status}

--- STATS ---
${statSummary}

--- DIFF PREVIEW ---
${diffPatch}

Task:
Write a single concise, professional git commit message in English explaining the actual change.
Format: <type>(<scope>): <summary> (e.g. "feat(deploy): add commit message suggestion script" or "fix(auth): handle invalid credentials error").
Rules:
- Output ONLY the single line commit message.
- Do NOT include markdown quotes, bullets, preamble, or explanations.
- Max 80 characters.
`.trim();

const MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];

async function queryGemini() {
  let lastError = null;

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000,
          }
        }),
      });

      const data = await res.json();
      if (data.error) {
        lastError = data.error.message || JSON.stringify(data.error);
        continue;
      }

      const candidate = data.candidates?.[0];
      if (!candidate) continue;

      // If cut off by max tokens, skip to another model
      if (candidate.finishReason === 'MAX_TOKENS') {
        lastError = `Model ${model} hit MAX_TOKENS limit`;
        continue;
      }

      let candidateText = candidate.content?.parts?.[0]?.text || '';
      candidateText = candidateText.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      const lines = candidateText
        .split('\n')
        .map(l => l.trim().replace(/^["'`*#]+|["'`*#]+$/g, '').trim())
        .filter(Boolean);

      if (lines.length > 0) {
        const msg = lines[0];
        // Ensure message is not incomplete / truncated (e.g. "feat(api")
        if (msg.includes('(') && !msg.includes(')')) {
          lastError = `Incomplete message produced by ${model}: ${msg}`;
          continue;
        }
        if (!msg.includes(':')) {
          lastError = `Malformed commit message produced by ${model}: ${msg}`;
          continue;
        }
        return msg;
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(lastError || 'No se pudo obtener respuesta de la API de Gemini.');
}

async function run() {
  try {
    const suggestedMsg = await queryGemini();

    console.log('');
    console.log('================================================================');
    console.log('💡 MENSAJE DE COMMIT SUGERIDO:');
    console.log(`   👉 \x1b[32m\x1b[1m${suggestedMsg}\x1b[0m`);
    console.log('================================================================');

    const tempPath = path.join(process.env.TEMP || '/tmp', 'pachas_suggested_msg.txt');
    fs.writeFileSync(tempPath, suggestedMsg, 'utf8');
  } catch (err) {
    console.error('\n❌ Error al consultar a Gemini:', err.message);
    process.exitCode = 1;
  }
}

await run();
