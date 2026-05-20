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



Create Super User: 
cd /home/vssc/Desktop/DCM/Backend
source env/bin/activate
python3 create_superuser.py <new_username> <new_password>


-e VITE_API_BASE_URL = ""



Docker-----

create superuser:
docker exec -it dcm_backend python create_superuser.py


Backend--

cd /home/vssc/Desktop/DCM/Backend

docker build -t dcm-backend .

docker run -d \
  --name dcm_backend \
  -p 8080:8000 \
  -e MONGO_URI="mongodb://admin:password@192.168.1.100:27017/" \
  -e FRONTEND_URL="http://192.168.1.50:3000" \
  dcm-backend



Frontend--

cd /home/vssc/Desktop/DCM/frontend

docker build -t dcm-frontend .

docker run -d \
  --name dcm_frontend \
  -p 3000:80 \
  -e VITE_API_BASE_URL="http://192.168.1.50:8080" \
  dcm-frontend


