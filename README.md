# NoxMob SmartPOS

Frontend (`index.html`) + API Cloudflare Worker (`worker/`).

## Estrutura

- `index.html` → Cloudflare **Pages**
- `worker/` → Cloudflare **Workers** (`waitron-server`)
- `schema.sql` → banco **D1**

## Setup rápido

### 1. GitHub
```bash
git init
git remote add origin https://github.com/SEU_USUARIO/noxmob.git
git add .
git commit -m "NoxMob: Pages + Worker"
git branch -M main
git push -u origin main
