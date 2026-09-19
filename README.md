# AHR Luxury PG For Gents – PG Management App (MERN)

Block → Room → Customer, with room vacancy always calculated from active customers.

## 1. Prerequisites
| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18 or newer (20/22 recommended) | `node -v` |
| npm | comes with Node | `npm -v` |
| MongoDB | Atlas (free) **or** local MongoDB 6+ | – |

## 2. Get a MongoDB connection string
**Option A – MongoDB Atlas (easiest, free)**
1. Create an account at https://www.mongodb.com/cloud/atlas and create a free **M0** cluster.
2. *Database Access* → add a database user (username + password).
3. *Network Access* → add your IP (or `0.0.0.0/0` for testing only).
4. *Connect* → *Drivers* → copy the string, e.g.
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/ahr_luxury_pg?retryWrites=true&w=majority`
   (put the database name `ahr_luxury_pg` before the `?`).

**Option B – Local MongoDB:** `mongodb://127.0.0.1:27017/ahr_luxury_pg`

## 3. Backend
```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```
Edit `backend/.env`:
```
MONGO_URI=your_mongodb_connection_string
PORT=5000
```
Start it:
```bash
npm run dev
```
You should see: `MongoDB connected: ...`, `Seeded 3 default block(s).` (first run only) and `API running on http://localhost:5000`.
Test: open http://localhost:5000/api/health → `{"status":"ok"}` and http://localhost:5000/api/blocks → the 3 blocks.

(The 3 blocks are seeded automatically on first start. To seed manually: `npm run seed` – safe to repeat.)

## 4. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. In development Vite proxies `/api` and `/uploads` to the backend on port 5000, so no extra config is needed.

## 5. Use it on your phone
1. Phone and computer on the same Wi-Fi.
2. Find your computer's IP (`ipconfig` on Windows / `ifconfig` on Mac/Linux), e.g. `192.168.1.20`.
3. On the phone open `http://192.168.1.20:5173`. (Allow Node through the firewall if asked.)

## 6. First-run checklist
1. Home shows the 3 blocks and stats (all zero).
2. Open **AHR Main Block** → **+ Add Room** → Room `101`, type `3 in 1` → appears as *3 Beds · 0 Occupied · 3 Available · Available*.
3. Open Room 101 → **+ Add Customer** → fill the form, upload an ID image → Save.
4. Room now shows 1 occupied / 2 available (*Partially Occupied*). Add two more → *Fully Occupied*, button becomes **Room Full**.
5. Open a customer → **View** → **Edit Customer** / **Remove Customer** → vacancy updates immediately.

## 7. Business rules enforced by the backend
- Capacity is derived from room type (Single 1, 2 in 1 → 2, 3 in 1 → 3).
- Occupancy / availability / status are **calculated** from active customers – never stored.
- Overbooking blocked (count check before and after insert, so simultaneous requests can't take the last bed).
- Sharing type must equal the room's capacity (a 2-in-1 room only accepts "2 Sharing").
- Room must belong to the chosen building; room number unique inside a block.
- Check-out date cannot be before joining date; Aadhaar must be 12 digits; mobile must be a valid 10-digit Indian number.
- ID proof upload: JPG/PNG/WEBP/PDF, max 5 MB.
- "Remove Customer" sets status **Checked Out** (+ actual checkout date). The record is kept; the bed is freed.
- A room can be deleted only if it has never had a customer.

## 7b. API summary
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/dashboard` | totals for the home page |
| GET / POST | `/api/blocks` | list (with room/bed counts) / create |
| GET | `/api/blocks/:id` | one block |
| GET / POST | `/api/blocks/:blockId/rooms` | rooms of a block / add room |
| GET / PUT / DELETE | `/api/rooms/:roomId` | room details / update / delete |
| GET | `/api/rooms/:roomId/customers` | active occupants |
| GET / POST | `/api/customers` | list (`?status=&q=`) / create (multipart) |
| GET / PUT / DELETE | `/api/customers/:id` | details / edit (multipart) / remove (check out) |

## 8. Production notes
- Frontend: `cd frontend && npm run build` → serve `dist/`. Set `VITE_API_URL` to your API URL before building.
- Backend: `npm start`; set `CLIENT_ORIGIN` to your frontend URL.
- This app has **no login**, as requested. If you deploy it publicly, anyone with the link can see customer data and ID documents. Put it behind a VPN/password-protected proxy or add authentication first.
- Uploaded IDs are stored in `backend/uploads/` (use persistent disk / object storage in production and back it up).

## 9. Troubleshooting
| Problem | Fix |
|---|---|
| `Failed to start server: MONGO_URI is not defined` | Create `backend/.env` (step 3). |
| `MongooseServerSelectionError` | Wrong string/password, or your IP isn't allowed in Atlas Network Access. |
| Frontend shows "Unable to reach the server" | Backend not running, or not on port 5000 (update `vite.config.js` proxy). |
| Special characters in Atlas password | URL-encode them (`@` → `%40`). |
| `EADDRINUSE` | Change `PORT` in `.env` and the proxy target in `frontend/vite.config.js`. |
