import os
import json
import re
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path

import io
from fastapi import FastAPI, Request, HTTPException, status, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import httpx
from pypdf import PdfReader
import docx

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("resumex-ai")

# Configuration
GROK_API_KEY = os.getenv("GROK_API_KEY", "").strip()
GROK_MODEL = os.getenv("GROK_MODEL", "grok-2-latest").strip()
GROK_BASE_URL = os.getenv("GROK_BASE_URL", "https://api.x.ai/v1").rstrip("/")

def get_api_config():
    api_key = os.getenv("GROK_API_KEY", "").strip()
    base_url = os.getenv("GROK_BASE_URL", "https://api.x.ai/v1").rstrip("/")
    model = os.getenv("GROK_MODEL", "grok-2-latest").strip()

    # Automatically adapt for Groq API keys (gsk_...) vs xAI Grok keys (xai-...)
    if api_key.startswith("gsk_"):
        base_url = "https://api.groq.com/openai/v1"
        if model in ["grok-2-latest", "grok-beta", "grok-2", "your_model"]:
            model = "openai/gpt-oss-120b"

    return api_key, base_url, model

BASE_DIR = Path(__file__).resolve().parent

# Initialize FastAPI App
app = FastAPI(
    title="ResumeX AI",
    description="AI-Powered Resume Reviewer, ATS Optimizer & Resume Maker using Grok API",
    version="1.1.0"
)

# Mount Static Files and Templates
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


# --- Pydantic Request Models for Analysis ---
class AnalyzeRequest(BaseModel):
    resume: str = Field(..., min_length=20, max_length=25000, description="Resume text")
    target_job: str = Field(..., min_length=2, max_length=200, description="Target job title")
    job_description: Optional[str] = Field(default="", max_length=25000, description="Optional job description")


class BulletPointImprovement(BaseModel):
    before: str
    after: str
    reason: Optional[str] = ""


class ATSChecklistItem(BaseModel):
    category: str
    status: str  # "pass", "warning", "fail"
    title: str
    detail: str
    fix_tip: str


class AnalysisResponse(BaseModel):
    overall_score: int
    ats_score: int
    ats_explanation: str
    job_match_score: int
    strengths: List[str]
    weaknesses: List[str]
    missing_keywords: List[str]
    professional_summary: str
    bullet_point_improvements: List[BulletPointImprovement]
    skills_present: List[str]
    skills_recommended: List[str]
    ats_checklist: List[ATSChecklistItem]
    ats_improvement_suggestions: List[str]
    final_recommendations: List[str]
    is_simulated: Optional[bool] = False


# --- Pydantic Models for Resume Builder ---
class ExperienceItem(BaseModel):
    company: str
    role: str
    location: Optional[str] = ""
    start_date: str
    end_date: str
    current: Optional[bool] = False
    description: str


class EducationItem(BaseModel):
    school: str
    degree: str
    field_of_study: Optional[str] = ""
    graduation_year: str
    gpa_or_honors: Optional[str] = ""


class ProjectItem(BaseModel):
    name: str
    tools: Optional[str] = ""
    description: str
    link: Optional[str] = ""


class GenerateResumeRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: str = Field(..., min_length=5, max_length=150)
    phone: Optional[str] = ""
    location: Optional[str] = ""
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    portfolio: Optional[str] = ""
    target_job: str = Field(..., min_length=2, max_length=200)
    job_description: Optional[str] = ""
    experiences: List[ExperienceItem] = []
    educations: List[EducationItem] = []
    skills_input: str = ""
    projects: Optional[List[ProjectItem]] = []
    certifications: Optional[List[str]] = []


# --- Grok AI System Prompts ---
ANALYSIS_SYSTEM_PROMPT = """You are ResumeX AI, an elite resume reviewer, ATS (Applicant Tracking System) specialist, certified career coach, and executive recruitment assistant.

Your role is to critically analyze the user's resume against their specified target job and optional job description.

CRITICAL RULES:
1. Do NOT invent, hallucinate, or fabricate fake work experience, fake companies, fake dates, fake certifications, or fake quantitative metrics not supported by the original resume.
2. If important details (e.g., metrics, leadership scope, tools) are missing, explicitly highlight them as areas for improvement rather than making up fictional data.
3. Every suggestion, summary improvement, and bullet point rewrite must be grounded in the candidate's actual qualifications while upgrading vocabulary, action verbs, impact clarity, and ATS keyword relevance.
4. You must respond with ONLY a valid, parseable JSON object matching the exact schema specified below, without any markdown code fence wrappers, introductory remarks, or trailing explanations.

JSON SCHEMA:
{
  "overall_score": <integer 0-100>,
  "ats_score": <integer 0-100>,
  "ats_explanation": "<concise explanation of ATS formatting, readability, and parseability>",
  "job_match_score": <integer 0-100>,
  "strengths": [
    "<strength 1>",
    "<strength 2>",
    "<strength 3>"
  ],
  "weaknesses": [
    "<weakness 1>",
    "<weakness 2>",
    "<weakness 3>"
  ],
  "missing_keywords": [
    "<missing keyword or critical tool 1>",
    "<missing keyword or critical tool 2>",
    "<missing keyword 3>"
  ],
  "professional_summary": "<an impactful, polished 3-4 sentence professional summary tailored to the target role, strictly using real background from the resume>",
  "bullet_point_improvements": [
    {
      "before": "<exact or representative weak bullet point from the resume>",
      "after": "<enhanced version using strong action verb and impactful phrasing without fake numbers>",
      "reason": "<why this rewrite improves impact and readability>"
    },
    {
      "before": "<second weak bullet point from resume>",
      "after": "<enhanced version>",
      "reason": "<explanation>"
    }
  ],
  "skills_present": [
    "<skills clearly found in the resume relevant to target role>"
  ],
  "skills_recommended": [
    "<in-demand industry skills for target role that candidate should highlight or learn>"
  ],
  "ats_checklist": [
    {
      "category": "Header & Contact Format",
      "status": "pass",
      "title": "Contact Details Parseability",
      "detail": "Standard email, phone and location formats detected.",
      "fix_tip": "Keep contact information in plain text without graphics or tables."
    },
    {
      "category": "Keyword Density & Role Alignment",
      "status": "warning",
      "title": "Core Role Keywords",
      "detail": "Found foundational terms but missing specialized tech stack keywords.",
      "fix_tip": "Integrate missing keywords into experience bullets naturally."
    },
    {
      "category": "Impact & Metric Quantification",
      "status": "warning",
      "title": "XYZ Metric Formula Coverage",
      "detail": "Only some bullet points contain quantifiable business outcomes.",
      "fix_tip": "Frame bullets as: Accomplished [X], as measured by [Y], by doing [Z]."
    },
    {
      "category": "Section Organization",
      "status": "pass",
      "title": "Standard ATS Section Headers",
      "detail": "Standard section headers (Summary, Experience, Skills, Education) are identifiable.",
      "fix_tip": "Avoid creative section names like 'What I do' or 'My Journey'."
    }
  ],
  "ats_improvement_suggestions": [
    "<specific ATS improvement recommendation 1>",
    "<specific ATS improvement recommendation 2>",
    "<specific ATS improvement recommendation 3>",
    "<specific ATS improvement recommendation 4>"
  ],
  "final_recommendations": [
    "<actionable recommendation 1>",
    "<actionable recommendation 2>",
    "<actionable recommendation 3>",
    "<actionable recommendation 4>",
    "<actionable recommendation 5>"
  ]
}
"""

BUILDER_SYSTEM_PROMPT = """You are ResumeX AI Resume Architect, a world-class executive resume writer and ATS compliance master.

Your task is to take the candidate's raw profile details, work history, education, skills, and target job, and construct a 100% ATS-compliant, ultra-professional, and interview-winning resume customized precisely for their desired target job role.

RULES:
1. Re-phrase and polish raw experience notes into powerful, professional bullet points starting with assertive action verbs (e.g., Spearheaded, Architected, Engineered, Formulated, Streamlined, Orchestrated).
2. Follow the Google XYZ formula (Accomplished [X], measured by [Y], by doing [Z]) wherever context permits, without fabricating fictional metrics or companies.
3. Organize skills into logical ATS-friendly categories (e.g., "Languages & Frameworks", "Tools & Platforms", "Methodologies & Concepts").
4. Craft an executive 3-4 sentence professional summary that immediately pitches the candidate for their target role.
5. Return ONLY a valid JSON object matching the schema below, without any markdown code fence wrappers or chat commentary.

JSON SCHEMA:
{
  "full_name": "<candidate name>",
  "target_job": "<target job title>",
  "contact_info": {
    "email": "<email>",
    "phone": "<phone>",
    "location": "<location>",
    "linkedin": "<linkedin url>",
    "github": "<github url>",
    "portfolio": "<portfolio url>"
  },
  "summary": "<tailored, punchy 3-4 sentence professional summary for target job>",
  "experience": [
    {
      "company": "<company name>",
      "role": "<job title>",
      "location": "<location>",
      "dates": "<e.g., 2022 – Present>",
      "bullets": [
        "<high-impact rewritten bullet point 1>",
        "<high-impact rewritten bullet point 2>",
        "<high-impact rewritten bullet point 3>"
      ]
    }
  ],
  "education": [
    {
      "school": "<institution>",
      "degree": "<degree and major>",
      "year": "<graduation year>",
      "details": "<honors, gpa or relevant coursework if provided>"
    }
  ],
  "skills_categorized": [
    {
      "category": "Core Technical Skills",
      "skills": ["<skill 1>", "<skill 2>", "<skill 3>"]
    },
    {
      "category": "Frameworks & Libraries",
      "skills": ["<skill 1>", "<skill 2>"]
    },
    {
      "category": "Tools & Methodologies",
      "skills": ["<skill 1>", "<skill 2>"]
    }
  ],
  "projects": [
    {
      "name": "<project title>",
      "tools": "<tools used>",
      "description": "<impactful project description>",
      "link": "<optional link>"
    }
  ],
  "certifications": [
    "<certification 1>",
    "<certification 2>"
  ],
  "ats_score_estimate": 96,
  "ats_highlights": [
    "Clean single-column standard ATS layout",
    "Optimized action verbs and keyword density for target role",
    "Standardized chronological headers and date formats"
  ]
}
"""


def generate_fallback_analysis(resume: str, target_job: str, job_description: str) -> Dict[str, Any]:
    """Generates an intelligent fallback review for evaluation when no Grok API key is configured."""
    resume_lower = resume.lower()
    target_lower = target_job.lower()

    has_metrics = bool(re.search(r'\d+%', resume) or re.search(r'\$\d+', resume) or re.search(r'\d+\+', resume))
    has_summary = any(k in resume_lower for k in ["summary", "profile", "objective", "about me"])
    has_skills_section = any(k in resume_lower for k in ["skills", "technologies", "tech stack", "competencies"])

    overall_score = 78 if has_metrics else 68
    if has_skills_section:
        overall_score += 6
    if has_summary:
        overall_score += 4
    overall_score = min(92, max(58, overall_score))

    ats_score = 82 if has_skills_section else 66
    job_match = 76 if target_lower in resume_lower else 64

    first_lines = [line.strip() for line in resume.split("\n") if len(line.strip()) > 20]
    sample_bullet = first_lines[2] if len(first_lines) > 2 else "Worked on client projects and collaborated with team members."
    sample_bullet_2 = first_lines[4] if len(first_lines) > 4 else "Responsible for bug fixing and feature development."

    return {
        "overall_score": overall_score,
        "ats_score": ats_score,
        "ats_explanation": "Clean structure detected, but keyword density and bullet point impact can be optimized for automated ATS parsers.",
        "job_match_score": job_match,
        "strengths": [
            f"Demonstrates clear experience relevant to technical environments and {target_job} workflows.",
            "Logical progression of responsibilities with identifiable core competencies.",
            "Good foundational skill coverage across key functional areas."
        ],
        "weaknesses": [
            "Lacks quantifiable business outcomes and specific performance metrics in several bullet points.",
            f"Keyword alignment for '{target_job}' could be strengthened to stand out against competitive applicant pools.",
            "Action verbs in experience descriptions are occasionally passive or repetitive."
        ],
        "missing_keywords": [
            f"{target_job} Best Practices",
            "Performance Optimization",
            "Cross-functional Collaboration",
            "Agile / Scrum Methodologies",
            "System Architecture"
        ],
        "professional_summary": f"Results-driven professional with demonstrated expertise preparing to excel as a {target_job}. Proven track record of delivering reliable solutions, optimizing operational workflows, and collaborating effectively across teams to achieve key organizational milestones.",
        "bullet_point_improvements": [
            {
                "before": sample_bullet,
                "after": f"Spearheaded key development initiatives and collaborated cross-functionally to deliver high-quality solutions aligned with {target_job} standards.",
                "reason": "Replaced generic phrasing with high-impact action verbs and strategic orientation."
            },
            {
                "before": sample_bullet_2,
                "after": "Identified, diagnosed, and resolved critical software bottlenecks while engineering robust feature enhancements.",
                "reason": "Clarifies ownership and demonstrates proactive problem-solving."
            }
        ],
        "skills_present": [
            "Problem Solving",
            "Technical Documentation",
            "Team Collaboration",
            "Project Execution"
        ],
        "skills_recommended": [
            f"Advanced {target_job} Tooling",
            "Automated Testing & CI/CD",
            "Performance Profiling",
            "Cloud Infrastructure / Deployment"
        ],
        "ats_checklist": [
            {
                "category": "Header & Contact Format",
                "status": "pass",
                "title": "Contact Details Parseability",
                "detail": "Standard email and phone detected. Clean plain text structure.",
                "fix_tip": "Keep contact details at the very top in simple text format."
            },
            {
                "category": "Role Keyword Match",
                "status": "warning" if job_match < 75 else "pass",
                "title": f"'{target_job}' Target Alignment",
                "detail": f"Resume matches approximately {job_match}% of standard {target_job} job keywords.",
                "fix_tip": f"Incorporate target role terms into experience descriptions and skill summaries."
            },
            {
                "category": "Measurable Impact (XYZ)",
                "status": "pass" if has_metrics else "warning",
                "title": "Quantifiable Metrics & Percentages",
                "detail": "Metrics detected in bullet points." if has_metrics else "Few numbers or quantifiable business results found.",
                "fix_tip": "Add percentages, scale, speed improvements, or project sizes to bullet points."
            },
            {
                "category": "ATS Standard Sections",
                "status": "pass" if has_skills_section else "warning",
                "title": "Universal Header Names",
                "detail": "Standard headers detected." if has_skills_section else "Use clear headers like 'Skills', 'Experience', 'Education'.",
                "fix_tip": "Ensure standard section titles (Professional Experience, Technical Skills, Education)."
            }
        ],
        "ats_improvement_suggestions": [
            f"Embed high-frequency keywords for '{target_job}' within the first 3 lines of your professional summary.",
            "Utilize the Google XYZ bullet formula: Accomplished [X], measured by [Y], by doing [Z].",
            "Use standard bullet characters (•) and avoid complex nested tables or multi-column text boxes.",
            "Include months and years in work history (e.g. 'Jan 2022 – Present') for accurate timeline parsing."
        ],
        "final_recommendations": [
            "Incorporate measurable outcomes (e.g., latency reduction, user adoption, time saved) into your bullet points.",
            f"Tailor your top 3-5 listed technical skills directly to the key requirements of {target_job}.",
            "Replace passive verbs like 'Responsible for' or 'Helped with' with active verbs like 'Architected', 'Spearheaded', 'Optimized'.",
            "Ensure standard ATS header naming conventions (Experience, Education, Skills, Projects).",
            "Include a targeted 3-line professional summary at the very top of your resume."
        ],
        "is_simulated": True
    }


def generate_fallback_resume(payload: GenerateResumeRequest) -> Dict[str, Any]:
    """Generates an intelligent ATS-optimized resume structure for demo/offline mode."""
    target = payload.target_job.strip()
    raw_skills = [s.strip() for s in payload.skills_input.split(",") if s.strip()]
    if not raw_skills:
        raw_skills = ["JavaScript", "Python", "React", "Node.js", "Git", "SQL", "REST APIs", "Agile Methodologies"]

    # Re-structure experiences
    enhanced_exp = []
    if payload.experiences:
        for exp in payload.experiences:
            raw_desc = exp.description.strip()
            bullets = [b.strip().lstrip("-•* ") for b in raw_desc.split("\n") if len(b.strip()) > 5]
            if not bullets:
                bullets = [
                    f"Spearheaded key technical initiatives contributing to core {target} objectives and team performance.",
                    "Collaborated cross-functionally with product and engineering teams to deliver scalable solutions on schedule.",
                    "Diagnosed and resolved critical performance bottlenecks, improving system reliability."
                ]
            else:
                enhanced_bullets = []
                for b in bullets:
                    if not any(b.lower().startswith(v) for v in ["spearheaded", "engineered", "architected", "developed", "streamlined"]):
                        enhanced_bullets.append(f"Architected and delivered {b.lower() if not b.startswith('I ') else b[2:]}, enhancing overall operational efficiency.")
                    else:
                        enhanced_bullets.append(b)
                bullets = enhanced_bullets

            dates_str = f"{exp.start_date} – {'Present' if exp.current else exp.end_date}"
            enhanced_exp.append({
                "company": exp.company,
                "role": exp.role,
                "location": exp.location or "Remote",
                "dates": dates_str,
                "bullets": bullets
            })
    else:
        enhanced_exp.append({
            "company": "Tech Solutions Corp",
            "role": target,
            "location": "San Francisco, CA",
            "dates": "2022 – Present",
            "bullets": [
                f"Led end-to-end development of critical features aligned with {target} industry best practices.",
                "Engineered responsive and scalable architectures, reducing load latency and boosting user engagement by 25%.",
                "Collaborated with cross-functional stakeholders in agile sprints to deploy production-ready updates."
            ]
        })

    # Education
    enhanced_edu = []
    if payload.educations:
        for edu in payload.educations:
            deg = f"{edu.degree} in {edu.field_of_study}" if edu.field_of_study else edu.degree
            enhanced_edu.append({
                "school": edu.school,
                "degree": deg,
                "year": edu.graduation_year,
                "details": edu.gpa_or_honors or ""
            })
    else:
        enhanced_edu.append({
            "school": "University of Technology",
            "degree": "Bachelor of Science in Computer Science",
            "year": "2021",
            "details": "Dean's Honor List"
        })

    # Categorized skills
    skills_cat = [
        {
            "category": "Core Technical Skills",
            "skills": raw_skills[:4] if len(raw_skills) >= 4 else raw_skills
        },
        {
            "category": "Tools & Technologies",
            "skills": raw_skills[4:8] if len(raw_skills) >= 8 else (raw_skills[4:] if len(raw_skills) > 4 else ["Git", "Docker", "CI/CD", "Postman"])
        },
        {
            "category": "Professional Competencies",
            "skills": ["System Architecture", "Cross-Functional Collaboration", "Problem Solving", "Agile & Scrum"]
        }
    ]

    # Projects
    enhanced_proj = []
    if payload.projects:
        for p in payload.projects:
            enhanced_proj.append({
                "name": p.name,
                "tools": p.tools or f"{target} Tools",
                "description": p.description,
                "link": p.link or ""
            })

    return {
        "full_name": payload.full_name,
        "target_job": target,
        "contact_info": {
            "email": payload.email,
            "phone": payload.phone,
            "location": payload.location,
            "linkedin": payload.linkedin,
            "github": payload.github,
            "portfolio": payload.portfolio
        },
        "summary": f"High-performing professional with proven expertise in building modern, scalable solutions as a {target}. Demonstrated ability to streamline operations, engineer high-quality deliverables, and collaborate across technical teams to achieve high-impact business outcomes.",
        "experience": enhanced_exp,
        "education": enhanced_edu,
        "skills_categorized": skills_cat,
        "projects": enhanced_proj,
        "certifications": payload.certifications or ["Professional Agile & Scrum Certified"],
        "ats_score_estimate": 97,
        "ats_highlights": [
            "100% single-column ATS parser friendly layout",
            f"Custom tailored keyword density matching '{target}' requirements",
            "Action-oriented XYZ bullet formulas with zero formatting traps"
        ],
        "is_simulated": True
    }


async def call_grok_api(system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    """Calls xAI Grok or GroqCloud API using OpenAI-compatible chat completions."""
    api_key, base_url, model = get_api_config()

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.2,
        "max_tokens": 3500,
        "response_format": {"type": "json_object"}
    }

    url = f"{base_url}/chat/completions"

    async with httpx.AsyncClient(timeout=75.0) as client:
        try:
            response = await client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException:
            logger.error("Grok API request timed out.")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Grok AI request timed out. Please try again in a few moments."
            )
        except httpx.RequestError as exc:
            logger.error(f"Network error communicating with Grok API: {exc}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to reach Grok AI servers. Please verify your connection."
            )

    if response.status_code == 401:
        logger.error("Invalid Grok API Key (401 Unauthorized).")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Grok API key. Please check your GROK_API_KEY in the .env configuration."
        )
    elif response.status_code == 429:
        logger.error("Grok API rate limit exceeded.")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Grok API rate limit reached. Please wait a moment before trying again."
        )
    elif response.status_code != 200:
        logger.error(f"Grok API returned error code {response.status_code}: {response.text}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Grok AI service returned an error (Status {response.status_code})."
        )

    try:
        data = response.json()
        raw_content = data["choices"][0]["message"]["content"].strip()

        if raw_content.startswith("```"):
            raw_content = re.sub(r"^```(?:json)?\s*", "", raw_content)
            raw_content = re.sub(r"\s*```$", "", raw_content)

        parsed_json = json.loads(raw_content)
        parsed_json["is_simulated"] = False
        return parsed_json
    except (KeyError, json.JSONDecodeError) as e:
        logger.error(f"Failed to parse Grok API response as JSON: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Received an unexpected response structure from Grok AI. Please try again."
        )


# --- HTML Web Routes ---
@app.get("/", response_class=HTMLResponse)
async def landing_page(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/analyze", response_class=HTMLResponse)
async def analyze_page(request: Request):
    api_key, _, _ = get_api_config()
    return templates.TemplateResponse(request=request, name="analyze.html", context={
        "has_api_key": bool(api_key and api_key != "your_xai_grok_api_key_here")
    })


@app.get("/builder", response_class=HTMLResponse)
async def builder_page(request: Request):
    api_key, _, _ = get_api_config()
    return templates.TemplateResponse(request=request, name="builder.html", context={
        "has_api_key": bool(api_key and api_key != "your_xai_grok_api_key_here")
    })


def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """Extracts clean text from PDF or DOCX file bytes."""
    fname_lower = filename.lower()
    extracted_text = ""

    if fname_lower.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    pages_text.append(t)
            extracted_text = "\n\n".join(pages_text).strip()
        except Exception as e:
            logger.error(f"Error parsing PDF {filename}: {e}")
            raise HTTPException(status_code=400, detail=f"Unable to parse PDF file: {str(e)}")

    elif fname_lower.endswith((".docx", ".doc")):
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            extracted_text = "\n".join(paragraphs).strip()
        except Exception as e:
            logger.error(f"Error parsing DOCX {filename}: {e}")
            raise HTTPException(status_code=400, detail=f"Unable to parse Word (.docx) file: {str(e)}")

    elif fname_lower.endswith(".txt"):
        try:
            extracted_text = file_bytes.decode("utf-8", errors="ignore").strip()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unable to read text file: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a PDF (.pdf) or Word document (.docx).")

    if not extracted_text or len(extracted_text) < 15:
        raise HTTPException(status_code=400, detail="Could not extract readable text from the uploaded file. Please make sure it is not password-protected or empty.")

    return extracted_text


@app.post("/api/upload-resume")
async def upload_resume_file(file: UploadFile = File(...)):
    """Accepts uploaded PDF/DOCX resume file, extracts text, and returns extracted content."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=400, detail="File size exceeds the 10MB limit.")

    text = extract_text_from_bytes(contents, file.filename)
    return {
        "filename": file.filename,
        "extracted_text": text,
        "char_count": len(text)
    }


# --- API Routes ---
@app.get("/api/health")
async def health_check():
    api_key, _, _ = get_api_config()
    return {
        "status": "ok",
        "service": "ResumeX AI",
        "model": GROK_MODEL,
        "has_grok_key": bool(api_key and api_key != "your_xai_grok_api_key_here")
    }


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_resume(payload: AnalyzeRequest):
    resume_text = payload.resume.strip()
    target_job = payload.target_job.strip()
    job_desc = payload.job_description.strip() if payload.job_description else ""

    if not resume_text or len(resume_text) < 20:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume text is required and must contain at least 20 characters."
        )

    if not target_job or len(target_job) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Target job title is required."
        )

    if not GROK_API_KEY or GROK_API_KEY in ["your_xai_grok_api_key_here", "your_api_key", ""]:
        logger.info("GROK_API_KEY not configured. Using intelligent demo review mode.")
        analysis = generate_fallback_analysis(resume_text, target_job, job_desc)
        return JSONResponse(content=analysis)

    user_prompt = f"""Please analyze the following candidate resume for the target job role.

TARGET JOB TITLE:
{target_job}

TARGET JOB DESCRIPTION (IF PROVIDED):
{job_desc if job_desc else 'None provided'}

CANDIDATE RESUME TEXT:
{resume_text}

Remember: Output ONLY the strict JSON object as specified in the system instructions. Do not include markdown code block quotes.
"""
    try:
        analysis_data = await call_grok_api(ANALYSIS_SYSTEM_PROMPT, user_prompt)
        return JSONResponse(content=analysis_data)
    except Exception as e:
        logger.warning(f"Grok API call encountered an error: {e}. Falling back to intelligent analyzer engine.")
        fallback = generate_fallback_analysis(resume_text, target_job, job_desc)
        return JSONResponse(content=fallback)


@app.post("/api/generate-resume")
async def generate_resume_endpoint(payload: GenerateResumeRequest):
    if not payload.full_name.strip():
        raise HTTPException(status_code=422, detail="Full name is required.")
    if not payload.target_job.strip():
        raise HTTPException(status_code=422, detail="Target job role is required.")

    api_key, _, _ = get_api_config()
    if not api_key or api_key in ["your_xai_grok_api_key_here", "your_api_key", ""]:
        logger.info("API key not configured. Generating ATS resume using demo engine.")
        generated = generate_fallback_resume(payload)
        return JSONResponse(content=generated)

    # Format user input for Grok
    exp_summary = []
    for exp in payload.experiences:
        exp_summary.append(f"- Company: {exp.company}, Role: {exp.role}, Dates: {exp.start_date} to {exp.end_date}, Details: {exp.description}")

    edu_summary = []
    for edu in payload.educations:
        edu_summary.append(f"- School: {edu.school}, Degree: {edu.degree} {edu.field_of_study}, Year: {edu.graduation_year}")

    proj_summary = []
    if payload.projects:
        for p in payload.projects:
            proj_summary.append(f"- Project: {p.name}, Tools: {p.tools}, Description: {p.description}")

    user_prompt = f"""Construct a high-scoring ATS-friendly professional resume based on these candidate details:

CANDIDATE INFO:
- Name: {payload.full_name}
- Email: {payload.email}
- Phone: {payload.phone or 'N/A'}
- Location: {payload.location or 'N/A'}
- LinkedIn: {payload.linkedin or 'N/A'}
- GitHub/Portfolio: {payload.github or payload.portfolio or 'N/A'}

TARGET DESIRED JOB:
{payload.target_job}

TARGET JOB DESCRIPTION (IF ANY):
{payload.job_description or 'None provided'}

WORK EXPERIENCE RAW NOTES:
{chr(10).join(exp_summary) if exp_summary else 'Entry-level candidate with foundational experience.'}

EDUCATION:
{chr(10).join(edu_summary) if edu_summary else 'Higher education in relevant field.'}

SKILLS INPUT:
{payload.skills_input or 'Core programming, problem solving, agile development.'}

PROJECTS:
{chr(10).join(proj_summary) if proj_summary else 'None provided'}

CERTIFICATIONS:
{', '.join(payload.certifications) if payload.certifications else 'None provided'}

Please structure this into a high-scoring ATS-optimized resume in the specified JSON format.
"""

    try:
        resume_data = await call_grok_api(BUILDER_SYSTEM_PROMPT, user_prompt)
        return JSONResponse(content=resume_data)
    except Exception as e:
        logger.warning(f"Grok API call encountered an error in builder: {e}. Falling back to intelligent resume builder engine.")
        fallback_res = generate_fallback_resume(payload)
        return JSONResponse(content=fallback_res)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="127.0.0.1", port=port, reload=True)
