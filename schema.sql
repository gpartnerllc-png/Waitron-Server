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

-- ============================================================
-- BIOMETRIA VASCULAR + HOTEL + FRIGOBAR (NoxMob Palm Power)
-- Tudo abaixo é NOVO – não altera nada do que já existia
-- ============================================================

CREATE TABLE IF NOT EXISTS palm_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospede_id INTEGER NOT NULL,
  template_hash TEXT NOT NULL UNIQUE,
  template_b64 TEXT,
  device_id TEXT,
  criado_em TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (hospede_id) REFERENCES pessoas(id)
);

CREATE TABLE IF NOT EXISTS hospede_quarto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospede_id INTEGER NOT NULL,
  quarto TEXT NOT NULL,
  checkin TEXT DEFAULT (datetime('now')),
  checkout TEXT,
  status TEXT DEFAULT 'ocupado',
  FOREIGN KEY (hospede_id) REFERENCES pessoas(id)
);

CREATE TABLE IF NOT EXISTS consumos_hotel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quarto TEXT NOT NULL,
  hospede_id INTEGER,
  descricao TEXT NOT NULL DEFAULT 'Consumo Frigobar',
  valor REAL NOT NULL,
  pago_via TEXT DEFAULT 'palma',
  txid_pix TEXT,
  status TEXT DEFAULT 'pago',
  device_id TEXT,
  criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS frigobar_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  preco REAL NOT NULL DEFAULT 0,
  estoque INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER DEFAULT 3,
  ativo INTEGER DEFAULT 1,
  criado_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS frigobar_movimentacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  quarto TEXT,
  quantidade INTEGER NOT NULL,
  tipo TEXT DEFAULT 'consumo',
  consumo_id INTEGER,
  criado_em TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES frigobar_itens(id)
);

-- Índices novos
CREATE INDEX IF NOT EXISTS idx_palm_hash ON palm_templates(template_hash);
CREATE INDEX IF NOT EXISTS idx_hospede_quarto ON hospede_quarto(quarto, status);
CREATE INDEX IF NOT EXISTS idx_consumos_quarto ON consumos_hotel(quarto);
CREATE INDEX IF NOT EXISTS idx_frigobar_sku ON frigobar_itens(sku);

-- Dados iniciais do frigobar (opcional – pode remover se não quiser)
INSERT OR IGNORE INTO frigobar_itens (sku, nome, preco, estoque, estoque_minimo) VALUES
('FRIG-AGUA', 'Água Mineral 500ml', 6.00, 50, 10),
('FRIG-COCA', 'Coca-Cola 350ml', 9.00, 40, 8),
('FRIG-CERV', 'Cerveja Long Neck', 12.00, 30, 6),
('FRIG-CHOCO', 'Chocolate', 8.50, 25, 5),
('FRIG-SNACK', 'Salgadinho', 7.00, 35, 7);
