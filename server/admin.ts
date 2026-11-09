// /admin: your private page to review, edit, approve or reject the agent's X drafts, write your own post,
// and see where visitors come from. The page asks for ADMIN_TOKEN and sends it with each request
// (Authorization: Bearer). The page itself holds no data; every /api/admin call checks the token.
import crypto from 'crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { addManualPost, checkPost, editPost, listPosts, publishPost, rejectPost, runAgentOnce, xLength } from './marketing.ts';
import { visitTotals } from './visits.ts';
import { checkX, xConfigured, xKeyHints } from './xclient.ts';

const failures = new Map<string, { n: number; until: number }>();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = process.env.ADMIN_TOKEN?.trim() || '';
  if (token.length < 24) return void res.status(404).json({ error: 'admin is off (ADMIN_TOKEN missing or shorter than 24 characters)' });
  const ip = req.ip || 'unknown';
  const f = failures.get(ip);
  if (f && f.until > Date.now() && f.n >= 10) return void res.status(429).json({ error: 'too many attempts, try in 15 minutes' });
  const m = /^Bearer (.+)$/.exec(String(req.get('authorization') ?? ''));
  const pass = m ? m[1].trim() : '';
  const a = crypto.createHash('sha256').update(pass).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    failures.set(ip, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    return void res.status(401).json({ error: 'wrong password' });
  }
  // Changes must come from the admin page itself (a custom header cannot be sent cross-site).
  if (req.method !== 'GET' && req.get('X-Admin') !== '1') return void res.status(403).json({ error: 'forbidden' });
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  next();
}

export function mountAdmin(app: express.Express) {
  const r = express.Router();
  const guard = [requireAdmin, express.json({ limit: '8kb' })];
  const handle = (fn: (req: Request) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
      res.json(await fn(req));
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  };
  const id = (req: Request) => {
    const n = Number(req.params.id);
    if (!Number.isInteger(n) || n <= 0) throw new Error('bad id');
    return n;
  };
  const text = (req: Request) => String((req.body as { text?: unknown })?.text ?? '').trim();

  r.get('/api/admin/state', ...guard, handle(async () => ({
    x_ready: xConfigured(),
    x_keys: xKeyHints(),
    autopost: process.env.MARKETING_AUTOPOST === '1',
    agent: process.env.MARKETING_ENABLED === '1',
    posts: await listPosts(40),
    visits: await visitTotals(14),
  })));
  r.post('/api/admin/check', ...guard, handle(async (req) => ({ problems: checkPost(text(req)), length: xLength(text(req)) })));
  r.post('/api/admin/posts', ...guard, handle(async (req) => addManualPost(text(req))));
  r.post('/api/admin/posts/:id/edit', ...guard, handle(async (req) => editPost(id(req), text(req))));
  r.post('/api/admin/posts/:id/reject', ...guard, handle(async (req) => rejectPost(id(req))));
  r.post('/api/admin/posts/:id/publish', ...guard, handle(async (req) =>
    publishPost(id(req), Boolean((req.body as { alt?: unknown })?.alt))));
  r.post('/api/admin/x-check', ...guard, handle(async () => checkX()));
  r.post('/api/admin/run-agent', ...guard, handle(async () => {
    await runAgentOnce();
    return { ok: true };
  }));
  r.get('/admin', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'");
    res.type('html').send(PAGE);
  });
  app.use(r);
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Admin - Bot Log</title>
<style>
:root{color-scheme:dark}body{margin:0;background:#020617;color:#e2e8f0;font:14px/1.5 system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:16px}h1{font-size:18px}h2{font-size:15px;margin-top:28px}
.card{border:1px solid #1e293b;background:#0f172a;border-radius:10px;padding:12px;margin:10px 0}
.meta{font-size:12px;color:#94a3b8;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.pill{padding:1px 7px;border-radius:99px;background:#1e293b}.posted{background:#064e3b;color:#a7f3d0}.failed{background:#7f1d1d;color:#fecaca}.draft{background:#78350f;color:#fde68a}
textarea{width:100%;box-sizing:border-box;min-height:96px;background:#020617;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:8px;font:inherit}
button{background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:7px;padding:6px 11px;cursor:pointer;font:inherit;font-size:13px}
button.go{background:#f59e0b;color:#0f172a;border-color:#f59e0b;font-weight:600}button:disabled{opacity:.5;cursor:default}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center}.err{color:#fca5a5;font-size:12px}.ok{color:#86efac;font-size:12px}
.alt{border-left:3px solid #a78bfa;padding-left:8px;margin-top:8px;color:#c4b5fd;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #1e293b;padding:4px 6px;text-align:left}
</style></head><body><main>
<h1>Bot Log admin <button id="logout" style="float:right;display:none">Log out</button></h1>
<form id="login" class="card" style="display:none"><div class="meta">Admin password (ADMIN_TOKEN)</div>
<div class="row"><input id="pw" type="password" autocomplete="current-password" style="flex:1;min-width:200px;background:#020617;color:#e2e8f0;border:1px solid #334155;border-radius:7px;padding:7px">
<button class="go" type="submit">Log in</button><span id="loginmsg" class="err"></span></div></form>
<div id="app" style="display:none"><div id="status" class="meta"></div>
<div class="row"><button id="xcheck">Check X connection (posts nothing)</button><span id="xres" class="meta"></span></div>
<h2>Write a post</h2><div class="card"><textarea id="new" placeholder="Your own post (280 characters; links count as 23)"></textarea>
<div class="row"><button class="go" id="add">Save as draft</button><span id="newinfo" class="meta"></span></div></div>
<h2>Drafts and posts <button id="run" style="margin-left:8px">Check for new drafts now</button></h2><div id="posts"></div>
<h2>Visitors (last 14 days, by source)</h2><div class="card" id="visits"></div></div>
</main><script>
const $=s=>document.querySelector(s);
let tok='';try{tok=sessionStorage.getItem('adm')||''}catch(e){}
const api=async(path,body)=>{const h={'Authorization':'Bearer '+tok};const r=await fetch(path,body===undefined?{headers:h}:{method:'POST',headers:{...h,'Content-Type':'application/json','X-Admin':'1'},body:JSON.stringify(body)});
if(r.status===401){showLogin('Wrong password');throw new Error('login needed')}
const j=await r.json().catch(()=>({error:'HTTP '+r.status}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){const s=await api('/api/admin/state');
$('#status').innerHTML='<span class="pill">X keys '+(s.x_ready?'set':'missing')+(s.x_keys&&s.x_keys.api_key_ends_with?' (API key ...'+esc(s.x_keys.api_key_ends_with)+', token for user id '+esc(s.x_keys.access_token_user_id||'?')+')':'')+'</span><span class="pill">agent '+(s.agent?'on':'off')+'</span><span class="pill">autopost '+(s.autopost?'on':'off')+'</span>';
$('#posts').innerHTML=s.posts.length?'':'<p class="meta">No drafts yet.</p>';
for(const p of s.posts){const d=document.createElement('div');d.className='card';
const editable=p.status==='draft'||p.status==='failed';
d.innerHTML='<div class="meta"><span class="pill '+p.status+'">'+p.status+'</span><span>'+esc(p.kind)+'</span><span>'+new Date(p.created_at).toLocaleString()+'</span>'+(p.post_id?'<span>post id '+esc(p.post_id)+'</span>':'')+'</div>'+
(editable?'<textarea>'+esc(p.text)+'</textarea>':'<p style="white-space:pre-wrap">'+esc(p.text)+'</p>')+(p.alt_text&&editable?'<div class="alt"><b>AI wording:</b> '+esc(p.alt_text)+'</div>':'')+
(p.error?'<div class="err">'+esc(p.error)+'</div>':'')+(editable?'<div class="row"><button class="go" data-a="publish">Post to X</button>'+(p.alt_text?'<button data-a="alt">Post AI wording</button>':'')+'<button data-a="edit">Save edit</button><button data-a="reject">Reject</button><span class="msg"></span></div>':'');
d.querySelectorAll('button').forEach(b=>b.onclick=async()=>{const msg=d.querySelector('.msg');d.querySelectorAll('button').forEach(x=>x.disabled=true);
try{const t=d.querySelector('textarea').value;const a=b.dataset.a;
if(a==='publish'){if(t!==p.text)await api('/api/admin/posts/'+p.id+'/edit',{text:t});if(!confirm('Post this to X now?'))throw new Error('cancelled');await api('/api/admin/posts/'+p.id+'/publish',{})}
else if(a==='alt'){if(!confirm('Post the AI wording to X now?'))throw new Error('cancelled');await api('/api/admin/posts/'+p.id+'/publish',{alt:true})}
else if(a==='edit')await api('/api/admin/posts/'+p.id+'/edit',{text:t});else await api('/api/admin/posts/'+p.id+'/reject',{});await load()}
catch(e){msg.className='err msg';msg.textContent=e.message;d.querySelectorAll('button').forEach(x=>x.disabled=false)}});
$('#posts').appendChild(d)}
const days=Object.keys(s.visits).sort().reverse();const refs=[...new Set(days.flatMap(d=>Object.keys(s.visits[d])))].sort();
$('#visits').innerHTML=days.length?'<table><tr><th>Day</th>'+refs.map(r=>'<th>'+esc(r)+'</th>').join('')+'<th>Total</th></tr>'+days.map(d=>'<tr><td>'+d+'</td>'+refs.map(r=>'<td>'+(s.visits[d][r]||'')+'</td>').join('')+'<td>'+Object.values(s.visits[d]).reduce((a,b)=>a+b,0)+'</td></tr>').join('')+'</table>':'<p class="meta">No visits counted yet.</p>'}
let t;$('#new').oninput=()=>{clearTimeout(t);t=setTimeout(async()=>{const c=await api('/api/admin/check',{text:$('#new').value});$('#newinfo').innerHTML=c.length+'/280 '+(c.problems.length?'<span class="err">'+esc(c.problems.join('; '))+'</span>':'')},300)};
$('#add').onclick=async()=>{try{await api('/api/admin/posts',{text:$('#new').value});$('#new').value='';$('#newinfo').innerHTML='<span class="ok">saved</span>';await load()}catch(e){$('#newinfo').innerHTML='<span class="err">'+esc(e.message)+'</span>'}};
$('#xcheck').onclick=async()=>{$('#xres').textContent='checking...';try{const c=await api('/api/admin/x-check',{});$('#xres').innerHTML=c.ok?'<span class="ok">OK: these keys post as @'+esc(c.username)+'</span>':'<span class="err">'+esc(c.error)+'</span>'}catch(e){$('#xres').innerHTML='<span class="err">'+esc(e.message)+'</span>'}};
$('#run').onclick=async()=>{await api('/api/admin/run-agent',{}).catch(e=>alert(e.message));await load()};
function showLogin(msg){$('#app').style.display='none';$('#logout').style.display='none';$('#login').style.display='';$('#loginmsg').textContent=msg||'';try{sessionStorage.removeItem('adm')}catch(e){}tok=''}
async function start(){if(!tok)return showLogin('');try{await load();$('#login').style.display='none';$('#app').style.display='';$('#logout').style.display=''}catch(e){if(e.message!=='login needed'){$('#login').style.display='';$('#loginmsg').textContent=e.message}}}
$('#login').onsubmit=async(ev)=>{ev.preventDefault();tok=$('#pw').value.trim();$('#pw').value='';try{sessionStorage.setItem('adm',tok)}catch(e){}await start()};
$('#logout').onclick=()=>showLogin('');
start();
</script></body></html>`;
