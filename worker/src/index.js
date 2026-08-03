/**
 * waitron-server · NoxMob API
 * Auth · D1 · CNPJ · WhatsApp Zernio · Asaas · CORS
 * Secrets: ZERNIO_API_KEY, ASAAS_API_KEY, SERPRO_TOKEN, API_KEY
 */

const DEFAULT_ORIGINS = [
  'https://ws.droppfy.com',
  'https://droppfy.com',
  'https://www.droppfy.com',
  'https://waitron-server.contatodroppfy.workers.dev',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
];

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGIN || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const list = allowed.length ? allowed : DEFAULT_ORIGINS;
  const allow = list.includes(origin) ? origin : list[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, req, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(req, env),
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '');
}

function normalizePhoneBR(tel) {
  let d = onlyDigits(tel);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  if (!d.startsWith('+')) d = '+' + d;
  return d;
}

async function zernioFetch(env, path, options = {}) {
  const base = (env.ZERNIO_BASE || 'https://zernio.com/api/v1').replace(/\/$/, '');
  const key = env.ZERNIO_API_KEY;
  if (!key) throw new Error('ZERNIO_API_KEY não configurada no Worker');
  const r = await fetch(base + path, {
    ...options,
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { ok: r.ok, status: r.status, data };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    }

    // ── Health ────────────────────────────────────────
    if (url.pathname === '/' || url.pathname === '/health') {
      return json(
        {
          ok: true,
          service: 'noxmob-api',
          worker: 'waitron-server',
          env: env.ENV || 'production',
          zernio: !!env.ZERNIO_API_KEY,
          asaas: !!env.ASAAS_API_KEY,
          d1: !!env.DB,
          routes: [
            'GET /health',
            'GET /cnpj/:cnpj',
            'POST /wa/send',
            'POST /wa/broadcast',
            'POST /auth/login',
            'POST /auth/register',
            'POST /auth/forgot',
            'POST /auth/approve',
            'GET|POST /api/produtos',
            'GET|POST /api/vendas',
            'POST /pay/asaas/pix',
          ],
        },
        200,
        req,
        env
      );
    }

    // ── CNPJ ──────────────────────────────────────────
    if (url.pathname.startsWith('/cnpj/') && req.method === 'GET') {
      const cnpj = onlyDigits(url.pathname.split('/').pop());
      if (cnpj.length !== 14) return json({ erro: 'CNPJ inválido' }, 400, req, env);
      try {
        const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + cnpj);
        if (!r.ok) return json({ erro: 'CNPJ não encontrado' }, r.status, req, env);
        const data = await r.json();
        return json(
          {
            cnpj,
            razao_social: data.razao_social || '',
            nome: data.razao_social || data.nome_fantasia || '',
            telefone: data.ddd_telefone_1 || '',
            uf: data.uf || '',
            municipio: data.municipio || '',
            fonte: 'brasilapi',
          },
          200,
          req,
          env
        );
      } catch (e) {
        return json({ erro: String(e.message || e) }, 502, req, env);
      }
    }

    // ── WhatsApp send ─────────────────────────────────
    if (url.pathname === '/wa/send' && req.method === 'POST') {
      try {
        const body = await req.json();
        const phone = normalizePhoneBR(body.phone || body.tel || '');
        const text = body.text || body.message || '';
        if (!phone || phone.length < 12) {
          return json({ erro: 'Telefone inválido (use DDI+DDD+número)' }, 400, req, env);
        }
        if (!text && !(body.useTemplate && body.templateName)) {
          return json({ erro: 'Mensagem ou template obrigatório' }, 400, req, env);
        }

        if (body.useTemplate && body.templateName) {
          const created = await zernioFetch(env, '/broadcasts', {
            method: 'POST',
            body: JSON.stringify({
              profileId: body.profileId || env.ZERNIO_PROFILE_ID,
              accountId: body.accountId || env.ZERNIO_ACCOUNT_ID,
              platform: 'whatsapp',
              name: body.campaignName || 'NoxMob-' + Date.now(),
              template: {
                name: body.templateName,
                language: body.language || 'pt_BR',
                components: body.components || [
                  {
                    type: 'body',
                    parameters: (body.params || []).map((t) => ({
                      type: 'text',
                      text: String(t),
                    })),
                  },
                ],
              },
            }),
          });
          if (!created.ok) {
            return json(
              { erro: 'Falha ao criar broadcast', detalhe: created.data },
              created.status,
              req,
              env
            );
          }
          const id = created.data?.broadcast?.id || created.data?.id;
          if (id) {
            await zernioFetch(env, `/broadcasts/${id}/recipients`, {
              method: 'POST',
              body: JSON.stringify({ phones: [phone] }),
            });
            const sent = await zernioFetch(env, `/broadcasts/${id}/send`, {
              method: 'POST',
            });
            return json(
              { ok: sent.ok, mode: 'template_broadcast', detalhe: sent.data },
              sent.ok ? 200 : sent.status,
              req,
              env
            );
          }
          return json(
            { ok: true, mode: 'template_broadcast', detalhe: created.data },
            200,
            req,
            env
          );
        }

        if (!env.ZERNIO_API_KEY) {
          const waMe =
            'https://wa.me/' + onlyDigits(phone) + '?text=' + encodeURIComponent(text);
          return json(
            {
              ok: false,
              fallback: true,
              waMe,
              dica: 'Configure ZERNIO_API_KEY ou use waMe',
            },
            200,
            req,
            env
          );
        }

        const msg = await zernioFetch(env, '/messages/send', {
          method: 'POST',
          body: JSON.stringify({
            platform: 'whatsapp',
            accountId: body.accountId || env.ZERNIO_ACCOUNT_ID,
            to: phone,
            type: 'text',
            text: { body: text },
          }),
        });

        if (msg.ok) {
          return json(
            { ok: true, mode: 'zernio_message', detalhe: msg.data },
            200,
            req,
            env
          );
        }

        const waMe =
          'https://wa.me/' + onlyDigits(phone) + '?text=' + encodeURIComponent(text);
        return json(
          {
            ok: false,
            fallback: true,
            waMe,
            detalhe: msg.data,
            dica: 'Use template aprovado (useTemplate:true) ou abra waMe',
          },
          200,
          req,
          env
        );
      } catch (e) {
        return json({ erro: String(e.message || e) }, 500, req, env);
      }
    }

    // ── WhatsApp broadcast ────────────────────────────
    if (url.pathname === '/wa/broadcast' && req.method === 'POST') {
      try {
        const body = await req.json();
        const phones = (body.phones || []).map(normalizePhoneBR);
        if (!phones.length) return json({ erro: 'Lista de telefones vazia' }, 400, req, env);
        if (!body.templateName) {
          return json({ erro: 'templateName obrigatório' }, 400, req, env);
        }
        const created = await zernioFetch(env, '/broadcasts', {
          method: 'POST',
          body: JSON.stringify({
            profileId: body.profileId || env.ZERNIO_PROFILE_ID,
            accountId: body.accountId || env.ZERNIO_ACCOUNT_ID,
            platform: 'whatsapp',
            name: body.name || 'NoxMob-BC-' + Date.now(),
            template: {
              name: body.templateName,
              language: body.language || 'pt_BR',
              components: body.components || [],
            },
          }),
        });
        if (!created.ok) {
          return json(
            { erro: 'Criar broadcast', detalhe: created.data },
            created.status,
            req,
            env
          );
        }
        const id = created.data?.broadcast?.id || created.data?.id;
        await zernioFetch(env, `/broadcasts/${id}/recipients`, {
          method: 'POST',
          body: JSON.stringify({ phones }),
        });
        const sent = await zernioFetch(env, `/broadcasts/${id}/send`, {
          method: 'POST',
        });
        return json(
          { ok: sent.ok, broadcastId: id, detalhe: sent.data },
          sent.ok ? 200 : sent.status,
          req,
          env
        );
      } catch (e) {
        return json({ erro: String(e.message || e) }, 500, req, env);
      }
    }

    // ── Auth login ────────────────────────────────────
    if (url.pathname === '/auth/login' && req.method === 'POST') {
      const { email, senha } = await req.json();
      if (env.DB) {
        const u = await env.DB.prepare('SELECT * FROM usuarios WHERE email = ?')
          .bind(email)
          .first();
        if (!u || u.senha_hash !== senha) {
          return json({ erro: 'Credenciais inválidas' }, 401, req, env);
        }
        if (u.status !== 'ativo') {
          return json({ erro: 'Aguardando liberação do admin' }, 403, req, env);
        }
        return json(
          {
            ok: true,
            usuario: { email: u.email, nome: u.nome, papel: u.papel },
          },
          200,
          req,
          env
        );
      }
      if (email === 'admin@noxmob.com.br' && senha === '123456') {
        return json(
          { ok: true, usuario: { email, nome: 'Admin', papel: 'admin' } },
          200,
          req,
          env
        );
      }
      return json(
        { erro: 'Sem D1 — use admin@noxmob.com.br / 123456 ou conecte o banco' },
        401,
        req,
        env
      );
    }

    // ── Auth register ─────────────────────────────────
    if (url.pathname === '/auth/register' && req.method === 'POST') {
      const { email, senha, nome } = await req.json();
      if (!env.DB) {
        return json({ erro: 'D1 não conectado — associe o banco DB' }, 501, req, env);
      }
      try {
        await env.DB.prepare(
          `INSERT INTO usuarios (email, senha_hash, nome, papel, status)
           VALUES (?, ?, ?, 'operador', 'pendente')`
        )
          .bind(email, senha, nome || email)
          .run();
        return json(
          { ok: true, msg: 'Cadastro pendente de aprovação' },
          201,
          req,
          env
        );
      } catch {
        return json({ erro: 'E-mail já existe' }, 409, req, env);
      }
    }

    // ── Auth forgot ───────────────────────────────────
    if (url.pathname === '/auth/forgot' && req.method === 'POST') {
      const { email } = await req.json();
      if (!env.DB) {
        return json(
          { ok: true, msg: 'D1 ausente — simulado', tokenDev: 'dev-' + Date.now() },
          200,
          req,
          env
        );
      }
      const token = crypto.randomUUID().slice(0, 8);
      const expira = new Date(Date.now() + 3600e3).toISOString();
      await env.DB.prepare(
        `INSERT OR REPLACE INTO reset_senha (email, token, expira) VALUES (?, ?, ?)`
      )
        .bind(email, token, expira)
        .run();
      return json(
        {
          ok: true,
          msg: 'Se o e-mail existir, enviamos instruções.',
          tokenDev: token,
        },
        200,
        req,
        env
      );
    }

    // ── Auth approve ──────────────────────────────────
    if (url.pathname === '/auth/approve' && req.method === 'POST') {
      const { emailAdmin, senhaAdmin, emailAlvo } = await req.json();
      if (!env.DB) return json({ erro: 'D1 necessário' }, 501, req, env);
      const admin = await env.DB.prepare(
        `SELECT * FROM usuarios WHERE email = ? AND papel = 'admin'`
      )
        .bind(emailAdmin)
        .first();
      if (!admin || admin.senha_hash !== senhaAdmin) {
        return json({ erro: 'Só admin' }, 403, req, env);
      }
      await env.DB.prepare(`UPDATE usuarios SET status = 'ativo' WHERE email = ?`)
        .bind(emailAlvo)
        .run();
      return json({ ok: true }, 200, req, env);
    }

    // ── API produtos ──────────────────────────────────
    if (url.pathname === '/api/produtos' && req.method === 'GET') {
      if (!env.DB) return json({ produtos: [] }, 200, req, env);
      const { results } = await env.DB.prepare(
        'SELECT * FROM produtos ORDER BY id DESC'
      ).all();
      return json({ produtos: results || [] }, 200, req, env);
    }
    if (url.pathname === '/api/produtos' && req.method === 'POST') {
      if (!env.DB) return json({ erro: 'D1 necessário' }, 501, req, env);
      const p = await req.json();
      await env.DB.prepare(
        `INSERT INTO produtos (sku, nome, barras, ncm, preco, estoque, icms, cfop)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(sku) DO UPDATE SET
           nome=excluded.nome, preco=excluded.preco, estoque=excluded.estoque,
           barras=excluded.barras, ncm=excluded.ncm, icms=excluded.icms, cfop=excluded.cfop`
      )
        .bind(
          p.sku,
          p.nome,
          p.barras || '',
          p.ncm || '',
          p.preco,
          p.estoque || 0,
          p.icms || 18,
          p.cfop || '5102'
        )
        .run();
      return json({ ok: true }, 200, req, env);
    }

    // ── API vendas ────────────────────────────────────
    if (url.pathname === '/api/vendas' && req.method === 'GET') {
      if (!env.DB) return json({ vendas: [] }, 200, req, env);
      const { results } = await env.DB.prepare(
        'SELECT * FROM vendas ORDER BY id DESC LIMIT 200'
      ).all();
      return json({ vendas: results || [] }, 200, req, env);
    }
    if (url.pathname === '/api/vendas' && req.method === 'POST') {
      if (!env.DB) return json({ ok: true, localOnly: true }, 200, req, env);
      const v = await req.json();
      await env.DB.prepare(
        `INSERT INTO vendas (numero, total, impostos, cbs_ibs, detalhe_json, data, usuario_email, cliente_nome, cliente_tel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          v.numero || '',
          v.total || 0,
          v.impostos || 0,
          v.cbs_ibs || 0,
          JSON.stringify(v.detalhe || []),
          v.data || new Date().toISOString(),
          v.usuario_email || '',
          v.clienteNome || '',
          v.clienteTel || ''
        )
        .run();
      return json({ ok: true }, 200, req, env);
    }

    // ── Asaas PIX ─────────────────────────────────────
    if (url.pathname === '/pay/asaas/pix' && req.method === 'POST') {
      const key = env.ASAAS_API_KEY;
      if (!key) {
        return json({ erro: 'ASAAS_API_KEY não configurada' }, 501, req, env);
      }
      try {
        const body = await req.json();
        const base = (env.ASAAS_BASE || 'https://api-sandbox.asaas.com').replace(
          /\/$/,
          ''
        );
        const r = await fetch(base + '/v3/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            access_token: key,
          },
          body: JSON.stringify({
            billingType: 'PIX',
            value: body.value,
            description: body.description || 'NoxMob',
          }),
        });
        const data = await r.json();
        return json({ ok: r.ok, data }, r.ok ? 200 : r.status, req, env);
      } catch (e) {
        return json({ erro: String(e.message || e) }, 502, req, env);
      }
    }

    return json({ erro: 'Rota não encontrada', path: url.pathname }, 404, req, env);
  },
};
