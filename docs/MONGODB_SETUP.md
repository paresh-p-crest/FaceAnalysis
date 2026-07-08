# MongoDB Setup (Sprint 1)

## What MongoDB does in AuraScan

MongoDB stores each facial analysis as a **document** (JSON-like record):
- Questionnaire answers
- Full MediaPipe landmarks
- All scores and `cvReport` sections
- Report status (`draft` → later `published`)

MediaPipe math still runs in **Python** — MongoDB only **saves** the results.

---

## Step 1 — Create free MongoDB Atlas account

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up (free **M0** tier is enough for development)
3. Create a **cluster** (choose AWS, region near you)

---

## Step 2 — Create database user

1. Atlas → **Database Access** → **Add New Database User**
2. Username + password (save these)
3. Role: **Read and write to any database**

---

## Step 3 — Allow network access

1. Atlas → **Network Access** → **Add IP Address**
2. For development: **Allow Access from Anywhere** (`0.0.0.0/0`)
3. For production: restrict to your server IPs only

---

## Step 4 — Get connection string

1. Atlas → **Database** → **Connect** → **Drivers**
2. Copy the URI. It looks like:

```
mongodb+srv://myuser:myPASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

3. **Important:** Add database name `aurascan` before the `?`:

```
mongodb+srv://myuser:myPASSWORD@cluster0.xxxxx.mongodb.net/aurascan?retryWrites=true&w=majority
```

---

## Step 5 — Configure your project

**Backend** — create `backend/.env` (or set in shell):

```
MONGODB_URI=mongodb+srv://...
```

**Frontend** — create `.env.local` in project root:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Restart both servers after changing env files.

---

## Step 6 — Install Python deps & run

```powershell
cd "D:\AWS\AWS Projects\Facial AI Tejash\FaceAnalysis"
.\venv\Scripts\activate
pip install -r backend\requirements.txt
uvicorn backend.main:app --reload --port 8000
```

```powershell
npm run dev
```

---

## How to check it works

### 1. Health check (browser or PowerShell)

Open: `http://localhost:8000/api/health`

Expected:
```json
{
  "status": "ok",
  "provider": "python-fastapi",
  "mongodb": "connected"
}
```

If `"mongodb": "not_configured"` → `MONGODB_URI` is missing.  
If `"mongodb": "error"` → wrong URI, password, or IP not whitelisted.

### 2. Run an assessment in the app

1. Complete questionnaire + upload front photo
2. Let scan finish
3. Check backend terminal — no errors

### 3. View data in MongoDB Atlas

1. Atlas → **Database** → **Browse Collections**
2. Database: `aurascan` → Collection: `assessments`
3. You should see documents with `analysis.cvReport`, `landmarks`, etc.

### 4. API — get assessment by ID

After a scan, the response includes `assessmentId`. Open:

```
http://localhost:8000/api/assessments/YOUR_ASSESSMENT_ID
```

### 5. List recent assessments

```
http://localhost:8000/api/assessments
```

---

## Without MongoDB (fallback)

If `NEXT_PUBLIC_API_URL` is **not** set, the app runs analysis **in the browser** (original behavior) and nothing is saved to MongoDB.
