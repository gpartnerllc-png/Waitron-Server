    // POST /auth/forgot
    if (url.pathname === '/auth/forgot' && req.method === 'POST') {
      const { email } = await req.json();
      if (!env.DB) {
        return json({ ok: true, msg: 'D1 ausente — simulado', tokenDev: 'dev-' + Date.now() }, 200, req, env);
      }
      const token = crypto.randomUUID().slice(0, 8);
      const expira = new Date(Date.now() + 3600e3).toISOString();
      await env.DB.prepare(
        `INSERT OR REPLACE INTO reset_senha (email, token, expira) VALUES (?, ?, ?)`
      ).bind(email, token, expira).run();
      return json({ ok: true, msg: 'Se o e-mail existir, enviamos instruções.', tokenDev: token }, 200, req, env);
    }

    // POST /auth/approve
    if (url.pathname === '/auth/approve' && req.method === 'POST') {
      const { emailAdmin, senhaAdmin, emailAlvo } = await req.json();
      if (!env.DB) return json({ erro: 'D1 necessário' }, 501, req, env);
      const admin = await env.DB.prepare(
        `SELECT * FROM usuarios WHERE email = ? AND papel = 'admin'`
      ).bind(emailAdmin).first();
      if (!admin || admin.senha_hash !== senhaAdmin) {
        return json({ erro: 'Só admin' }, 403, req, env);
      }
      await env.DB.prepare(`UPDATE usuarios SET status = 'ativo' WHERE email = ?`).bind(emailAlvo).run();
      return json({ ok: true }, 200, req, env);
    }

    // GET/POST /api/produtos
    if (url.pathname === '/api/produtos' && req.method === 'GET') {
      if (!env.DB) return json({ produtos: [] }, 200, req, env);
      const { results } = await env.DB.prepare('SELECT * FROM produtos ORDER BY id DESC').all();
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
           barras=excluded.barras, ncm=excluded.ncm`
      ).bind(p.sku, p.nome, p.barras || '', p.ncm || '', p.preco, p.estoque || 0, p.icms || 18, p.cfop || '5102').run();
      return json({ ok: true }, 200, req, env);
    }

    // GET/POST /api/vendas
    if (url.pathname === '/api/vendas' && req.method === 'GET') {
      if (!env.DB) return json({ vendas: [] }, 200, req, env);
      const { results } = await env.DB.prepare('SELECT * FROM vendas ORDER BY id DESC LIMIT 200').all();
      return json({ vendas: results || [] }, 200, req, env);
    }
    if (url.pathname === '/api/vendas' && req.method === 'POST') {
      if (!env.DB) return json({ ok: true, localOnly: true }, 200, req, env);
      const v = await req.json();
      await env.DB.prepare(
        `INSERT INTO vendas (numero, total, impostos, cbs_ibs, detalhe_json, data, usuario_email)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        v.numero || '',
        v.total || 0,
        v.impostos || 0,
        v.cbs_ibs || 0,
        JSON.stringify(v.detalhe || []),
        v.data || new Date().toISOString(),
        v.usuario_email || ''
      ).run();
      return json({ ok: true }, 200, req, env);
    }

    // POST /pay/asaas/pix (esqueleto)
    if (url.pathname === '/pay/asaas/pix' && req.method === 'POST') {
      const key = env.ASAAS_API_KEY;
      if (!key) return json({ erro: 'ASAAS_API_KEY não configurada' }, 501, req, env);
      const body = await req.json();
      const base = (env.ASAAS_BASE || 'https://api-sandbox.asaas.com').replace(/\/$/, '');
      const r = await fetch(base + '/v3/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': key },
        body: JSON.stringify({
          billingType: 'PIX',
          value: body.value,
          description: body.description || 'NoxMob',
        }),
      });
      const data = await r.json();
      return json({ ok: r.ok, data }, r.ok ? 200 : r.status, req, env);
    }
