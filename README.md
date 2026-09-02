# ResumeX AI — AI-Powered Resume Intelligence MVP

**ResumeX AI** is a lightweight, high-performance web application designed to help job seekers optimize their resumes for Applicant Tracking Systems (ATS) and hiring managers using the **Grok API (xAI)**.

Built with Python (FastAPI) and a modern dark-mode glassmorphic UI, it delivers recruiter-grade feedback in seconds without permanently storing any user data.

---

## 🌟 Key Features

* **Grok AI-Powered Deep Analysis**: Structural evaluation tailored to target job titles and job descriptions.
* **Instant ATS & Job Compatibility Scoring**: Real-time 0–100 metrics for Overall Score, ATS Compatibility, and Job Alignment.
* **Impact-Driven Bullet Rewrites**: Transform passive descriptions into action-oriented achievements with Before &rarr; After comparisons without hallucinating fake metrics.
* **Missing ATS Keywords & Skills**: Instant gap identification highlighting essential terms absent from the resume.
* **Optimized Professional Summary**: Tailored, role-specific summary generated strictly from verified background.
* **Zero Data Retention**: Pure in-memory processing. Resumes and user submissions are never saved to a database or file storage.
* **Sleek AI SaaS Dashboard**: Dark theme, glassmorphism, responsive multi-column layout, glowing score gauges, and animated multi-stage loading.

---

## 🛠️ Technology Stack

* **Backend**: Python 3.11+, FastAPI, Uvicorn, Pydantic, HTTPX, python-dotenv
* **Frontend**: HTML5, CSS3 (Modern Glassmorphism & Custom Design System), Vanilla JavaScript, Jinja2 Templates
* **AI Engine**: Grok API (`grok-2-latest` / `grok-beta` via xAI endpoint)
* **Storage**: None (Strictly stateless & ephemeral)

---

## 📁 Project Structure

```text
resumex-ai/
│
├── app.py                     # FastAPI application, Grok integration, routes
├── requirements.txt           # Python dependencies
├── .env                       # Environment configuration (ignored in git)
├── .env.example               # Example environment template
├── .gitignore                 # Git ignore configuration
├── README.md                  # Comprehensive documentation
│
├── templates/
│   ├── base.html              # Core layout, nav, privacy footer, styles
│   ├── index.html             # Landing page with hero & feature showcase
│   └── analyze.html           # Interactive resume analyzer & results dashboard
│
└── static/
    ├── css/
    │   └── style.css          # Dark luxury SaaS design system
    └── js/
        └── app.js             # Form handling, animated loader, live DOM rendering
```

---

## 🚀 Quickstart & Installation

### 1. Prerequisites
* Python 3.11 or higher installed on your system.

### 2. Clone / Open the Project
```bash
cd resumex-ai
```

### 3. Create a Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and insert your xAI Grok API key:
```ini
GROK_API_KEY=xai-your_actual_api_key_here
GROK_MODEL=grok-2-latest
GROK_BASE_URL=https://api.x.ai/v1
PORT=8000
```
> **Note**: If `GROK_API_KEY` is not provided, the application runs in interactive **Demo Review Mode** so you can test the UI and workflow out-of-the-box.

### 6. Run the Application
```bash
uvicorn app:app --reload --port 8000
```

Open your browser and navigate to:
👉 **`http://127.0.0.1:8000`**

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Renders the modern landing page |
| `GET` | `/analyze` | Renders the interactive resume analyzer & results dashboard |
| `POST` | `/api/analyze` | Processes resume, queries Grok AI, and returns structured JSON analysis |
| `GET` | `/api/health` | Service health status check |

### Sample `POST /api/analyze` Request Body:
```json
{
  "resume": "Alex Morgan\nSoftware Engineer with 4 years experience...",
  "target_job": "Senior Frontend Engineer",
  "job_description": "Proficient in React, TypeScript, state management..."
}
```

---

## 🔒 Privacy & Data Policy

* **No Database**: ResumeX AI operates completely without a database.
* **No Authentication**: No accounts, passwords, or personal profiles.
* **Ephemeral Processing**: User resume text is only held in memory for the duration of the API call to generate suggestions and is immediately discarded.

---

## ☁️ Deployment Instructions

### Deploy on Render / Railway / Fly.io:
1. Push repository to GitHub.
2. Link repository to your hosting provider.
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Add `GROK_API_KEY` to your environment variables in the provider dashboard.

---

## 📜 License
MIT License — Free for academic, university, and personal portfolio use.

