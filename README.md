# 🌍 GreenTrack Logistics Control Tower

**An Enterprise Data-Driven Supply Chain & Carbon Optimization Platform**

![GreenTrack Dashboard](https://via.placeholder.com/1200x600.png?text=GreenTrack+Fleet+Logistics+Control+Tower)

## 📌 The Business Challenge
In the modern supply chain, organizations struggle with two massive inefficiencies: **Fragmented Data Visibility** and **High Carbon Footprints**. Dispatchers often rely on outdated systems that send heavy, underutilized combustion-engine vehicles on routes better suited for light electric vans. 

**GreenTrack** is an intelligent "Control Tower" designed to solve this. By ingesting raw operational freight data, modeling precise $CO_2$ emission profiles, and applying predictive machine learning algorithms, the platform replaces guesswork with **Data-Driven Prescriptive Optimization**.

---

## 🏗️ Architecture & Data Pipeline

The project features a full-stack, decoupled architecture built for performance and data integrity:

### 1. Data Ingestion & ETL (Extract, Transform, Load)
* **Raw Data Input:** Ingests unnormalized logistic CSV dumps covering master metadata (Addresses, Vehicles, Attributes) and transactional movements (Orders, Stages, Freight Units).
* **Python ETL (`app/ingestion/csv_loader.py`):** Automatically cleanses data, normalizes strings, parses European localized metric types, and dynamically maps records to satisfy strict relational rules, avoiding duplicate entries or orphaned foreign-keys.

### 2. Relational Database Modeling
Data is structured inside a **PostgreSQL** relational database using **SQLAlchemy** (Python ORM).
* **Master Entities:** `Addresses`, `TransportTypes`, `Vehicles`, `VehicleAttributes`. Contains static logic like fuel types, capacity limits, and $CO_2$ emission factors.
* **Transactional Entities:** `FreightUnits`, `FreightOrders`, `FreightOrderStages`.
* **Analytics Fact Table (`TransportStageFact`):** An automated scheduled builder (`fact_builder.py`) flattens complex transactional relationships into a streamlined star-schema "Fact Table". This provides instantaneous OLAP queries for:
  - *Total Stage Distance (km)*
  - *Calculated Stage CO2 (kg)* 
  - *Computed Route Load Ratio (Weight / Capacity)*

### 3. Materialized Views for Dashboards
To guarantee lightning-fast frontend dashboard loading, the architecture uses PostgreSQL `MATERIALIZED VIEWS`. It pre-aggregates intensive analytical queries (like `fleet_utilization` and `emissions_per_vehicle`), ensuring O(1) read efficiencies across millions of rows.

---

## 🤖 Analytics & Machine Learning 

GreenTrack doesn't just display data—it predicts and prescribes optimizations using **Scikit-Learn** (`app/ml/training.py`).

### 🎯 Predictive Models
The system automatically extracts training matrices from the `TransportStageFact` database and trains two **RandomForestRegressor** models:
1. **$CO_2$ Emission Predictor:** Assesses an incoming un-routed order to predict total raw $CO_2$ waste.
2. **Load Ratio Predictor:** Learns from historical dispatch behavior to forecast how empty or full the assigned vehicle will actually be en route.

### 💡 Prescriptive Recommendation Engine
The heart of the value proposition. Rather than relying on a user to spot inefficiencies, the backend rule engine (`app/recommendation/engine.py`) continuously ranks orders:
* ⚠️ **Consolidation Required:** Identifies predicted load ratios $<40\%$ to merge shipments.
* ⚡ **Vehicle Downsize/EV Transition:** Detects short-haul routes emitting high $CO_2$ where Electric Vehicles (EVs) are geometrically and logistically better fits.
* 🛑 **Route Merging:** Flags anomalous long-distance ($>200km$) low-load behavior.

### 🧪 "What-If" API Simulator
The REST API includes a live ML Simulator endpoint (`/api/simulate`). A user can select any given order, dynamically change the assigned `Vehicle Type`, and run an instantaneous ML inference predicting the net $CO_2$ reduction and utilization changes if they actually dispatched it differently.

---

## 💻 Tech Stack
- **Backend Analytics Engine:** Python, FastAPI, Pandas, Scikit-Learn.
- **Data Persistence:** PostgreSQL, SQLAlchemy ORM, Materialized Aggregations.
- **Frontend Dashboard:** React.js, Next.js (TypeScript), Axios, TailwindCSS / ShadCN UI.
- **Development Tooling:** Flake8, MyPy, Prettier, Postman.

---

## 🚀 Setup Instructions

### Backend (Python API & ML)
1. Initialize virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/Scripts/activate
   pip install -r requirements.txt
   ```
2. Start the Postgres Database and configure secrets inside `.env`.
3. Set up Database schema and launch FastAPI:
   ```bash
   uvicorn app.api.main:app --reload --port 8000
   ```

### Frontend (User Interface)
1. Ensure `node` and `npm` are installed.
2. Install JS modules and ensure `.env.local` points to `NEXT_PUBLIC_API_URL=http://localhost:8000/api`.
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   npm run dev
   ```

## 📈 Author Notes & Future Iterations
This repository serves as a prime demonstrator of full-cycle **Data Analytics Engineering**. Future iterations aim to include:
* Real-time Kafka streaming ingestion for GPS route feeds.
* Continuous ML retraining pipelines (Airflow/Dagster).
* Geospatial path visualization utilizing PostGIS mapping endpoints.
