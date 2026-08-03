-- NoxMob D1 · schema.sql
-- Uso: npx wrangler d1 execute noxmob-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'operador',
  status TEXT NOT NULL DEFAULT 'pendente',
  criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  barras TEXT,
  ncm TEXT,
  cnp TEXT,
  preco REAL NOT NULL DEFAULT 0,
  estoque INTEGER NOT NULL DEFAULT 0,
  icms REAL NOT NULL DEFAULT 18,
  cfop TEXT DEFAULT '5102',
  loja_id TEXT DEFAULT 'default',
  criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pessoas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  doc TEXT,
  tipo TEXT DEFAULT 'PF',
  tel TEXT,
  email TEXT,
  criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT,
  total REAL NOT NULL DEFAULT 0,
  impostos REAL NOT NULL DEFAULT 0,
  cbs_ibs REAL NOT NULL DEFAULT 0,
  detalhe_json TEXT,
  data TEXT,
  usuario_email TEXT,
  cliente_nome TEXT,
  cliente_tel TEXT,
  criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  tel TEXT,
  doc TEXT,
  compras INTEGER DEFAULT 0,
  ultima_compra TEXT,
  valor REAL DEFAULT 0,
  criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reset_senha (
  email TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expira TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos(sku);
CREATE INDEX IF NOT EXISTS idx_produtos_barras ON produtos(barras);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data);
CREATE INDEX IF NOT EXISTS idx_leads_tel ON leads(tel);

INSERT OR IGNORE INTO usuarios (email, senha_hash, nome, papel, status)
VALUES ('admin@noxmob.com.br', '123456', 'Administrador', 'admin', 'ativo');
