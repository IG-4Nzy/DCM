# Project Commands

## Backend (.Python Fast API)

**Install Dependencies (Restore)**
source env/bin/activate
pip install -r requirements.txt 


**Run the API Server**
python3 -m uvicorn main:app --reload --host [IP_ADDRESS] --port 8000

*(The backend will start and listen on a local port, usually `http://localhost:5000` or `https://localhost:5001`)*

python3 -m uvicorn main:app --reload --host 127.0.0.1 --port 8000


## Frontend (React/Vite)

**Install Dependencies**
npm install

**Run the Development Server**
npm run dev

*(The frontend will start and listen on a local port, usually `http://localhost:5173`)*
