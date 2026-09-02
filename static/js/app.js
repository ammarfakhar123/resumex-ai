/**
 * ResumeX AI — Client Application (ATS Analyzer & AI Resume Maker)
 */

// Sample Resume for ATS Analyzer 1-click testing
const SAMPLE_RESUME = `ALEX MORGAN
alex.morgan@email.com | (555) 019-2834 | San Francisco, CA | linkedin.com/in/alexmorgan

PROFESSIONAL SUMMARY
Software engineer with 4 years of experience working on full-stack web applications. Skilled in JavaScript, Python, and building web user interfaces. Looking to transition into a Senior Frontend Developer role.

EXPERIENCE
Frontend Developer | TechNova Solutions | 2022 – Present
- Worked on user interface features using React, HTML5, and CSS3.
- Fixed frontend bugs and improved site loading speed.
- Collaborated with product managers and UX designers on new sprint deliverables.
- Built reusable UI components for internal admin dashboard.

Junior Web Developer | Apex Digital | 2020 – 2022
- Maintained company website and integrated third-party REST APIs.
- Wrote unit tests using Jest and assisted senior engineers with deployments.
- Participated in daily standups and agile code reviews.

SKILLS
- Languages: JavaScript, Python, TypeScript, HTML5, CSS3, SQL
- Frameworks & Libraries: React, Node.js, Express, Tailwind CSS, Bootstrap
- Tools: Git, GitHub, Docker, Postman, Vite, Webpack

EDUCATION
Bachelor of Science in Computer Science
University of California, Davis | Graduated 2020`;

const SAMPLE_TARGET_JOB = "Senior Frontend Engineer";
const SAMPLE_JOB_DESC = "We are seeking a Senior Frontend Engineer proficient in React, TypeScript, state management, Next.js, and modern CI/CD pipelines. Experience in web performance optimization, automated testing, and mentoring junior engineers is required.";

let currentAnalysisData = null;
let currentGeneratedResume = null;
let loadingTimer = null;
let selectedResumeFile = null;

// Character counter
function updateCharCount() {
    const resume = document.getElementById("resume");
    const counter = document.getElementById("resume-char-count");
    if (resume && counter) {
        counter.textContent = `${resume.value.length.toLocaleString()} / 25,000`;
    }
}

// Switch Input Mode (Upload vs Paste)
function switchInputMode(mode) {
    const btnUpload = document.getElementById("btn-mode-upload");
    const btnPaste = document.getElementById("btn-mode-paste");
    const dropzone = document.getElementById("dropzone-area");

    if (mode === "upload") {
        if (btnUpload) btnUpload.classList.add("active");
        if (btnPaste) btnPaste.classList.remove("active");
        if (dropzone) dropzone.style.display = "block";
    } else {
        if (btnPaste) btnPaste.classList.add("active");
        if (btnUpload) btnUpload.classList.remove("active");
        if (dropzone) dropzone.style.display = "none";
    }
}

// Drag and Drop Event Handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById("dropzone-area");
    if (dropzone) dropzone.classList.add("dragover");
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById("dropzone-area");
    if (dropzone) dropzone.classList.remove("dragover");
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dropzone = document.getElementById("dropzone-area");
    if (dropzone) dropzone.classList.remove("dragover");

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        processResumeFileUpload(file);
    }
}

function handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        processResumeFileUpload(file);
    }
}

// Upload & Extract Text from PDF/DOCX
async function processResumeFileUpload(file) {
    const validExtensions = [".pdf", ".docx", ".doc", ".txt"];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
        showToast("Please upload a PDF (.pdf) or Word document (.docx).", "error");
        return;
    }

    selectedResumeFile = file;

    const spinner = document.getElementById("uploading-spinner");
    const badge = document.getElementById("file-loaded-badge");
    const badgeName = document.getElementById("file-loaded-name");

    if (spinner) spinner.style.display = "block";
    if (badge) badge.style.display = "none";

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/api/upload-resume", {
            method: "POST",
            body: formData
        });

        if (spinner) spinner.style.display = "none";

        if (!response.ok) {
            let errorMsg = "Failed to parse file.";
            try {
                const err = await response.json();
                if (err.detail) errorMsg = err.detail;
            } catch (e) {}
            throw new Error(errorMsg);
        }

        const data = await response.json();
        const resumeTextarea = document.getElementById("resume");
        if (resumeTextarea) {
            resumeTextarea.value = data.extracted_text;
            updateCharCount();
        }

        if (badge && badgeName) {
            badgeName.textContent = `${file.name} (${data.char_count.toLocaleString()} chars)`;
            badge.style.display = "inline-flex";
        }

        showToast(`Successfully extracted text from ${file.name}!`, "success");

    } catch (err) {
        if (spinner) spinner.style.display = "none";
        showToast(err.message || "Error reading file.", "error");
    }
}

// Clear Uploaded File
function clearUploadedFile(e) {
    e.stopPropagation();
    selectedResumeFile = null;
    const fileInput = document.getElementById("resume-file-input");
    const badge = document.getElementById("file-loaded-badge");
    const resumeTextarea = document.getElementById("resume");

    if (fileInput) fileInput.value = "";
    if (badge) badge.style.display = "none";
    if (resumeTextarea) {
        resumeTextarea.value = "";
        updateCharCount();
    }
    showToast("Uploaded file removed.", "info");
}

// Load Sample Resume Data into Analyzer
function loadSampleResume() {
    const resumeInput = document.getElementById("resume");
    const targetJobInput = document.getElementById("target_job");
    const jdInput = document.getElementById("job_description");

    if (resumeInput) resumeInput.value = SAMPLE_RESUME;
    if (targetJobInput) targetJobInput.value = SAMPLE_TARGET_JOB;
    if (jdInput) jdInput.value = SAMPLE_JOB_DESC;

    updateCharCount();
    showToast("Sample resume loaded successfully!", "success");
}

// Toast Notification System
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check text-success";
    if (type === "error") icon = "fa-circle-xmark text-danger";

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Copy Text Helper
function copyText(elementId, btn) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const textToCopy = element.innerText || element.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
            setTimeout(() => {
                btn.innerHTML = originalHtml;
            }, 2000);
        }
        showToast("Copied to clipboard!", "success");
    }).catch(() => {
        showToast("Failed to copy to clipboard", "error");
    });
}

// Copy Full Report Summary
function copyFullReport() {
    if (!currentAnalysisData) return;

    const report = `RESUMEX AI ANALYSIS REPORT
Target Role: ${document.getElementById("target_job").value}
Overall Score: ${currentAnalysisData.overall_score}/100
ATS Score: ${currentAnalysisData.ats_score}/100
Job Match Score: ${currentAnalysisData.job_match_score}/100

IMPROVED PROFESSIONAL SUMMARY:
${currentAnalysisData.professional_summary}

STRENGTHS:
${currentAnalysisData.strengths.map(s => `- ${s}`).join("\n")}

AREAS FOR IMPROVEMENT:
${currentAnalysisData.weaknesses.map(w => `- ${w}`).join("\n")}

MISSING KEYWORDS:
${currentAnalysisData.missing_keywords.join(", ")}

RECOMMENDATIONS:
${currentAnalysisData.final_recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}
`;

    navigator.clipboard.writeText(report).then(() => {
        showToast("Full summary report copied!", "success");
    });
}

// Reset Analyzer
function resetAnalyzer() {
    const resultsSection = document.getElementById("results-section");
    const inputSection = document.getElementById("input-section");
    const loadingSection = document.getElementById("loading-section");

    if (resultsSection) resultsSection.style.display = "none";
    if (loadingSection) loadingSection.style.display = "none";
    if (inputSection) inputSection.style.display = "block";

    currentAnalysisData = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Animated Score Counter
function animateScoreCounter(elementId, targetVal, duration = 1200) {
    const el = document.getElementById(elementId);
    if (!el) return;

    let start = 0;
    const increment = targetVal / (duration / 25);
    
    const timer = setInterval(() => {
        start += increment;
        if (start >= targetVal) {
            el.textContent = Math.round(targetVal);
            clearInterval(timer);
        } else {
            el.textContent = Math.round(start);
        }
    }, 25);
}

// Handle Resume Analysis Submission
async function handleResumeAnalysis(event) {
    event.preventDefault();

    const resume = document.getElementById("resume").value.trim();
    const targetJob = document.getElementById("target_job").value.trim();
    const jobDesc = document.getElementById("job_description").value.trim();

    if (!resume || resume.length < 20) {
        showToast("Please enter a valid resume with at least 20 characters.", "error");
        return;
    }

    if (!targetJob || targetJob.length < 2) {
        showToast("Please specify your target job title.", "error");
        return;
    }

    const inputSection = document.getElementById("input-section");
    const loadingSection = document.getElementById("loading-section");
    const resultsSection = document.getElementById("results-section");

    inputSection.style.display = "none";
    resultsSection.style.display = "none";
    loadingSection.style.display = "block";

    const loadingTitle = document.getElementById("loading-title");
    const loadingSubtitle = document.getElementById("loading-subtitle");
    const progressBarFill = document.getElementById("progress-bar-fill");
    const step2 = document.getElementById("step-2");
    const step3 = document.getElementById("step-3");

    progressBarFill.style.width = "20%";

    loadingTimer = setTimeout(() => {
        if (loadingTitle) loadingTitle.textContent = "Checking ATS compatibility...";
        if (loadingSubtitle) loadingSubtitle.textContent = "Scanning parser readability and keyword matching against target job.";
        if (progressBarFill) progressBarFill.style.width = "55%";
        if (step2) step2.classList.add("active");
    }, 2400);

    const loadingTimer2 = setTimeout(() => {
        if (loadingTitle) loadingTitle.textContent = "Finding improvement opportunities...";
        if (loadingSubtitle) loadingSubtitle.textContent = "Synthesizing high-impact action verbs and bullet point enhancements.";
        if (progressBarFill) progressBarFill.style.width = "85%";
        if (step3) step3.classList.add("active");
    }, 4800);

    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resume, target_job: targetJob, job_description: jobDesc })
        });

        clearTimeout(loadingTimer);
        clearTimeout(loadingTimer2);

        if (!response.ok) {
            let errorMsg = "Unable to analyze your resume right now. Please try again.";
            try {
                const errData = await response.json();
                if (errData && errData.detail) {
                    errorMsg = typeof errData.detail === "string" ? errData.detail : errorMsg;
                }
            } catch (e) {}
            throw new Error(errorMsg);
        }

        const data = await response.json();
        currentAnalysisData = data;

        renderAnalysisResults(data, targetJob);

        loadingSection.style.display = "none";
        resultsSection.style.display = "flex";
        window.scrollTo({ top: 150, behavior: "smooth" });

    } catch (err) {
        clearTimeout(loadingTimer);
        clearTimeout(loadingTimer2);
        loadingSection.style.display = "none";
        inputSection.style.display = "block";
        showToast(err.message || "Unable to analyze your resume right now. Please try again.", "error");
    }
}

// Render Dashboard Elements
function renderAnalysisResults(data, targetJob) {
    const roleTag = document.getElementById("role-tag");
    if (roleTag) roleTag.textContent = targetJob;

    const simulatedBadge = document.getElementById("simulated-badge");
    if (simulatedBadge) {
        simulatedBadge.style.display = data.is_simulated ? "inline-block" : "none";
    }

    animateScoreCounter("val-overall-score", data.overall_score || 0);
    animateScoreCounter("val-ats-score", data.ats_score || 0);
    animateScoreCounter("val-job-match-score", data.job_match_score || 0);

    const scoreCircle = document.getElementById("overall-score-circle");
    const verdictEl = document.getElementById("overall-score-verdict");
    if (scoreCircle && verdictEl) {
        const score = data.overall_score || 0;
        if (score >= 80) {
            scoreCircle.style.borderColor = "var(--success)";
            verdictEl.innerHTML = `<span class="text-success font-bold">Strong Candidate</span> &bull; Ready for competitive roles`;
        } else if (score >= 65) {
            scoreCircle.style.borderColor = "var(--warning)";
            verdictEl.innerHTML = `<span class="text-warning font-bold">Moderate Readiness</span> &bull; Recommended edits will boost visibility`;
        } else {
            scoreCircle.style.borderColor = "var(--danger)";
            verdictEl.innerHTML = `<span class="text-danger font-bold">Needs Attention</span> &bull; Apply suggested optimizations`;
        }
    }

    const atsExp = document.getElementById("val-ats-explanation");
    if (atsExp) atsExp.textContent = data.ats_explanation || "High ATS readability and formatting score.";

    // ATS Checklist
    const atsChecklistContainer = document.getElementById("container-ats-checklist");
    if (atsChecklistContainer) {
        const checklist = data.ats_checklist || [
            { category: "Formatting", status: "pass", title: "Single Column Layout", detail: "Clean structure detected.", fix_tip: "Maintain simple standard headers." },
            { category: "Keyword Match", status: "warning", title: "Target Term Density", detail: "Some expected terms missing.", fix_tip: "Add missing keywords." }
        ];

        atsChecklistContainer.innerHTML = checklist.map(item => `
            <div class="ats-check-item">
                <div class="check-item-header">
                    <span class="check-category">${escapeHtml(item.category)}</span>
                    <span class="check-status-badge status-${item.status}">${item.status.toUpperCase()}</span>
                </div>
                <div class="check-title">${escapeHtml(item.title)}</div>
                <div class="check-detail">${escapeHtml(item.detail)}</div>
                <div class="check-fix-tip"><i class="fa-solid fa-lightbulb"></i> <strong>ATS Fix:</strong> ${escapeHtml(item.fix_tip)}</div>
            </div>
        `).join("");
    }

    // Strengths
    const strengthsList = document.getElementById("list-strengths");
    if (strengthsList) {
        strengthsList.innerHTML = (data.strengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join("");
    }

    // Weaknesses
    const weaknessesList = document.getElementById("list-weaknesses");
    if (weaknessesList) {
        weaknessesList.innerHTML = (data.weaknesses || []).map(w => `<li>${escapeHtml(w)}</li>`).join("");
    }

    // Missing Keywords
    const keywordsContainer = document.getElementById("container-missing-keywords");
    if (keywordsContainer) {
        if (!data.missing_keywords || data.missing_keywords.length === 0) {
            keywordsContainer.innerHTML = `<span class="text-muted">No critical missing keywords detected. Great job!</span>`;
        } else {
            keywordsContainer.innerHTML = data.missing_keywords.map(kw => 
                `<span class="chip chip-missing"><i class="fa-solid fa-plus"></i> ${escapeHtml(kw)}</span>`
            ).join("");
        }
    }

    // Professional Summary
    const summaryText = document.getElementById("val-summary-text");
    if (summaryText) {
        summaryText.textContent = data.professional_summary || "No summary generated.";
    }

    // Bullet Point Improvements
    const bulletList = document.getElementById("list-bullet-improvements");
    if (bulletList) {
        if (!data.bullet_point_improvements || data.bullet_point_improvements.length === 0) {
            bulletList.innerHTML = `<p class="text-muted">No specific bullet point rewrites necessary.</p>`;
        } else {
            bulletList.innerHTML = data.bullet_point_improvements.map(item => `
                <div class="bullet-item">
                    <div class="bullet-row">
                        <span class="bullet-tag tag-before">Before</span>
                        <p class="bullet-text before-text">${escapeHtml(item.before)}</p>
                    </div>
                    <div class="bullet-row">
                        <span class="bullet-tag tag-after">AI Optimized</span>
                        <p class="bullet-text after-text">${escapeHtml(item.after)}</p>
                    </div>
                    ${item.reason ? `<p class="bullet-reason"><i class="fa-solid fa-circle-info"></i> ${escapeHtml(item.reason)}</p>` : ''}
                </div>
            `).join("");
        }
    }

    // Skills Present
    const skillsPresentContainer = document.getElementById("container-skills-present");
    if (skillsPresentContainer) {
        skillsPresentContainer.innerHTML = (data.skills_present || []).map(sk => 
            `<span class="chip chip-present"><i class="fa-solid fa-check"></i> ${escapeHtml(sk)}</span>`
        ).join("");
    }

    // Skills Recommended
    const skillsRecContainer = document.getElementById("container-skills-recommended");
    if (skillsRecContainer) {
        skillsRecContainer.innerHTML = (data.skills_recommended || []).map(sk => 
            `<span class="chip chip-recommended"><i class="fa-solid fa-star"></i> ${escapeHtml(sk)}</span>`
        ).join("");
    }

    // Final Recommendations & ATS Tips
    const recsList = document.getElementById("list-final-recommendations");
    if (recsList) {
        const allRecs = [
            ...(data.ats_improvement_suggestions || []),
            ...(data.final_recommendations || [])
        ];
        recsList.innerHTML = allRecs.map((rec, index) => `
            <div class="rec-item">
                <div class="rec-number">${index + 1}</div>
                <div class="rec-text">${escapeHtml(rec)}</div>
            </div>
        `).join("");
    }
}


/* ==========================================================================
   AI Resume Maker (Builder) Logic
   ========================================================================== */

let expCount = 0;
let eduCount = 0;
let projCount = 0;

// Add Experience Row
function addExperienceRow(data = {}) {
    expCount++;
    const container = document.getElementById("experience-container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "repeater-card";
    row.id = `exp-row-${expCount}`;

    row.innerHTML = `
        <div class="repeater-header">
            <span class="repeater-title"><i class="fa-solid fa-building text-secondary"></i> Experience #${expCount}</span>
            <button type="button" class="btn btn-sm btn-danger-outline" onclick="removeRow('exp-row-${expCount}')">
                <i class="fa-solid fa-trash-can"></i> Remove
            </button>
        </div>
        <div class="form-grid">
            <div class="form-group span-6">
                <label class="form-label">Company Name <span class="required">*</span></label>
                <input type="text" class="form-control exp-company" value="${data.company || ''}" placeholder="e.g. Acme Corp" required>
            </div>
            <div class="form-group span-6">
                <label class="form-label">Job Title / Role <span class="required">*</span></label>
                <input type="text" class="form-control exp-role" value="${data.role || ''}" placeholder="e.g. Software Engineer" required>
            </div>
            <div class="form-group span-4">
                <label class="form-label">Location</label>
                <input type="text" class="form-control exp-location" value="${data.location || ''}" placeholder="e.g. New York, NY / Remote">
            </div>
            <div class="form-group span-4">
                <label class="form-label">Start Date</label>
                <input type="text" class="form-control exp-start" value="${data.start_date || ''}" placeholder="e.g. Jan 2022">
            </div>
            <div class="form-group span-4">
                <label class="form-label">End Date</label>
                <input type="text" class="form-control exp-end" value="${data.end_date || ''}" placeholder="e.g. Present">
            </div>
            <div class="form-group span-full-md">
                <label class="form-label">Key Responsibilities & Achievements (Raw Notes)</label>
                <textarea class="form-control exp-desc" rows="3" placeholder="Enter brief bullet points or sentences of what you did. Grok AI will polish these with action verbs and XYZ impact metrics...">${data.description || ''}</textarea>
            </div>
        </div>
    `;
    container.appendChild(row);
}

// Add Education Row
function addEducationRow(data = {}) {
    eduCount++;
    const container = document.getElementById("education-container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "repeater-card";
    row.id = `edu-row-${eduCount}`;

    row.innerHTML = `
        <div class="repeater-header">
            <span class="repeater-title"><i class="fa-solid fa-school text-info"></i> Education #${eduCount}</span>
            <button type="button" class="btn btn-sm btn-danger-outline" onclick="removeRow('edu-row-${eduCount}')">
                <i class="fa-solid fa-trash-can"></i> Remove
            </button>
        </div>
        <div class="form-grid">
            <div class="form-group span-6">
                <label class="form-label">School / University <span class="required">*</span></label>
                <input type="text" class="form-control edu-school" value="${data.school || ''}" placeholder="e.g. University of California, Davis" required>
            </div>
            <div class="form-group span-6">
                <label class="form-label">Degree & Major <span class="required">*</span></label>
                <input type="text" class="form-control edu-degree" value="${data.degree || ''}" placeholder="e.g. Bachelor of Science in Computer Science" required>
            </div>
            <div class="form-group span-6">
                <label class="form-label">Graduation Year</label>
                <input type="text" class="form-control edu-year" value="${data.graduation_year || ''}" placeholder="e.g. 2021">
            </div>
            <div class="form-group span-6">
                <label class="form-label">GPA / Honors <span class="optional">(Optional)</span></label>
                <input type="text" class="form-control edu-honors" value="${data.gpa_or_honors || ''}" placeholder="e.g. Magna Cum Laude / 3.8 GPA">
            </div>
        </div>
    `;
    container.appendChild(row);
}

// Add Project Row
function addProjectRow(data = {}) {
    projCount++;
    const container = document.getElementById("projects-container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "repeater-card";
    row.id = `proj-row-${projCount}`;

    row.innerHTML = `
        <div class="repeater-header">
            <span class="repeater-title"><i class="fa-solid fa-diagram-project text-warning"></i> Project #${projCount}</span>
            <button type="button" class="btn btn-sm btn-danger-outline" onclick="removeRow('proj-row-${projCount}')">
                <i class="fa-solid fa-trash-can"></i> Remove
            </button>
        </div>
        <div class="form-grid">
            <div class="form-group span-6">
                <label class="form-label">Project Name</label>
                <input type="text" class="form-control proj-name" value="${data.name || ''}" placeholder="e.g. E-Commerce Microservices Platform">
            </div>
            <div class="form-group span-6">
                <label class="form-label">Tools & Tech Used</label>
                <input type="text" class="form-control proj-tools" value="${data.tools || ''}" placeholder="e.g. React, Node.js, Docker, Redis">
            </div>
            <div class="form-group span-full-md">
                <label class="form-label">Project Description</label>
                <textarea class="form-control proj-desc" rows="2" placeholder="Briefly describe what this project does and the outcome...">${data.description || ''}</textarea>
            </div>
        </div>
    `;
    container.appendChild(row);
}

// Remove Row Helper
function removeRow(rowId) {
    const el = document.getElementById(rowId);
    if (el) el.remove();
}

// Auto-Fill Sample Profile into Builder Form
function loadSampleProfile() {
    document.getElementById("b_full_name").value = "Jordan Hayes";
    document.getElementById("b_email").value = "jordan.hayes@email.com";
    document.getElementById("b_phone").value = "+1 (415) 555-0198";
    document.getElementById("b_location").value = "San Francisco, CA";
    document.getElementById("b_linkedin").value = "linkedin.com/in/jordanhayes";
    document.getElementById("b_target_job").value = "Senior Full Stack Engineer";
    document.getElementById("b_job_description").value = "Looking for a Senior Full Stack Engineer experienced in React, Node.js, Python, PostgreSQL, cloud architecture (AWS/GCP), and building high-scale distributed web applications.";
    document.getElementById("b_skills").value = "JavaScript, TypeScript, Python, React, Next.js, Node.js, Express, PostgreSQL, MongoDB, Docker, AWS, Git, CI/CD, GraphQL, Tailwind CSS";
    document.getElementById("b_certifications").value = "AWS Certified Developer Associate, Certified Kubernetes Application Developer (CKAD)";

    const expContainer = document.getElementById("experience-container");
    expContainer.innerHTML = "";
    expCount = 0;

    addExperienceRow({
        company: "Veloce Technologies",
        role: "Full Stack Engineer",
        location: "San Francisco, CA",
        start_date: "2022",
        end_date: "Present",
        description: "Built customer-facing dashboard using React and Node.js.\nRefactored legacy REST APIs into microservices, cutting database response times.\nMentored junior developers and ran weekly agile standups."
    });

    addExperienceRow({
        company: "Starlight Digital Labs",
        role: "Software Developer",
        location: "San Jose, CA",
        start_date: "2020",
        end_date: "2022",
        description: "Developed responsive web applications with TypeScript and Python.\nIntegrated third-party Stripe payment gateway and automated webhook triggers.\nAuthored unit and integration test suites with 90%+ code coverage."
    });

    const eduContainer = document.getElementById("education-container");
    eduContainer.innerHTML = "";
    eduCount = 0;

    addEducationRow({
        school: "University of California, Berkeley",
        degree: "Bachelor of Science in Computer Science",
        graduation_year: "2020",
        gpa_or_honors: "Dean's Honors List"
    });

    const projContainer = document.getElementById("projects-container");
    projContainer.innerHTML = "";
    projCount = 0;

    addProjectRow({
        name: "CloudOps Automated Deployment Engine",
        tools: "React, Python, Docker, AWS ECS",
        description: "Engineered a self-service deployment orchestration dashboard that reduced developer release times by 40%."
    });

    showToast("Sample candidate profile loaded! Click 'Generate ATS-Optimized Resume' below.", "success");
}

// Handle Generate Resume Submission
async function handleGenerateResume(event) {
    event.preventDefault();

    const fullName = document.getElementById("b_full_name").value.trim();
    const email = document.getElementById("b_email").value.trim();
    const phone = document.getElementById("b_phone").value.trim();
    const location = document.getElementById("b_location").value.trim();
    const linkedin = document.getElementById("b_linkedin").value.trim();
    const targetJob = document.getElementById("b_target_job").value.trim();
    const jobDescription = document.getElementById("b_job_description").value.trim();
    const skillsInput = document.getElementById("b_skills").value.trim();
    const certificationsRaw = document.getElementById("b_certifications").value.trim();

    if (!fullName || !email || !targetJob) {
        showToast("Please fill in Name, Email, and Target Job Title.", "error");
        return;
    }

    // Gather Experience items
    const experiences = [];
    document.querySelectorAll("#experience-container .repeater-card").forEach(card => {
        const company = card.querySelector(".exp-company").value.trim();
        const role = card.querySelector(".exp-role").value.trim();
        const loc = card.querySelector(".exp-location").value.trim();
        const start = card.querySelector(".exp-start").value.trim();
        const end = card.querySelector(".exp-end").value.trim();
        const desc = card.querySelector(".exp-desc").value.trim();

        if (company && role) {
            experiences.push({
                company, role, location: loc,
                start_date: start || "2022",
                end_date: end || "Present",
                description: desc
            });
        }
    });

    // Gather Education items
    const educations = [];
    document.querySelectorAll("#education-container .repeater-card").forEach(card => {
        const school = card.querySelector(".edu-school").value.trim();
        const degree = card.querySelector(".edu-degree").value.trim();
        const year = card.querySelector(".edu-year").value.trim();
        const honors = card.querySelector(".edu-honors").value.trim();

        if (school && degree) {
            educations.push({
                school, degree,
                graduation_year: year || "2021",
                gpa_or_honors: honors
            });
        }
    });

    // Gather Projects
    const projects = [];
    document.querySelectorAll("#projects-container .repeater-card").forEach(card => {
        const name = card.querySelector(".proj-name").value.trim();
        const tools = card.querySelector(".proj-tools").value.trim();
        const desc = card.querySelector(".proj-desc").value.trim();

        if (name) {
            projects.push({ name, tools, description: desc });
        }
    });

    const certs = certificationsRaw ? certificationsRaw.split(",").map(c => c.trim()).filter(Boolean) : [];

    const formSection = document.getElementById("builder-form-section");
    const loadingSection = document.getElementById("builder-loading");
    const resultsSection = document.getElementById("builder-results");

    formSection.style.display = "none";
    resultsSection.style.display = "none";
    loadingSection.style.display = "block";

    const loadingTitle = document.getElementById("builder-loading-title");
    const loadingSubtitle = document.getElementById("builder-loading-subtitle");
    const progressFill = document.getElementById("builder-progress-fill");
    const bStep2 = document.getElementById("b-step-2");
    const bStep3 = document.getElementById("b-step-3");

    progressFill.style.width = "25%";

    const timer1 = setTimeout(() => {
        if (loadingTitle) loadingTitle.textContent = "Applying Google XYZ impact formulas...";
        if (loadingSubtitle) loadingSubtitle.textContent = "Upgrading verbs and crafting measurable achievements for target role.";
        if (progressFill) progressFill.style.width = "60%";
        if (bStep2) bStep2.classList.add("active");
    }, 2400);

    const timer2 = setTimeout(() => {
        if (loadingTitle) loadingTitle.textContent = "Formatting ATS Single-Column Layout...";
        if (loadingSubtitle) loadingSubtitle.textContent = "Ensuring 100% parseability for automated recruitment scanners.";
        if (progressFill) progressFill.style.width = "90%";
        if (bStep3) bStep3.classList.add("active");
    }, 4800);

    try {
        const payload = {
            full_name: fullName,
            email, phone, location, linkedin,
            target_job: targetJob,
            job_description: jobDescription,
            skills_input: skillsInput,
            experiences,
            educations,
            projects,
            certifications: certs
        };

        const response = await fetch("/api/generate-resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        clearTimeout(timer1);
        clearTimeout(timer2);

        if (!response.ok) {
            let errorMsg = "Unable to generate resume right now. Please try again.";
            try {
                const errData = await response.json();
                if (errData && errData.detail) errorMsg = errData.detail;
            } catch (e) {}
            throw new Error(errorMsg);
        }

        const data = await response.json();
        currentGeneratedResume = data;

        renderGeneratedResume(data);

        loadingSection.style.display = "none";
        resultsSection.style.display = "block";
        window.scrollTo({ top: 120, behavior: "smooth" });

    } catch (err) {
        clearTimeout(timer1);
        clearTimeout(timer2);
        loadingSection.style.display = "none";
        formSection.style.display = "block";
        showToast(err.message || "Failed to generate resume.", "error");
    }
}

// Render Generated Resume into Paper Canvas
function renderGeneratedResume(data) {
    const canvas = document.getElementById("resume-canvas");
    if (!canvas) return;

    const atsScoreEl = document.getElementById("res-ats-score");
    if (atsScoreEl) atsScoreEl.textContent = `${data.ats_score_estimate || 98}/100`;

    const roleEl = document.getElementById("res-target-role");
    if (roleEl) roleEl.textContent = data.target_job;

    // Build contacts line
    const contacts = [];
    if (data.contact_info) {
        if (data.contact_info.email) contacts.push(`<span><i class="fa-solid fa-envelope"></i> ${escapeHtml(data.contact_info.email)}</span>`);
        if (data.contact_info.phone) contacts.push(`<span><i class="fa-solid fa-phone"></i> ${escapeHtml(data.contact_info.phone)}</span>`);
        if (data.contact_info.location) contacts.push(`<span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(data.contact_info.location)}</span>`);
        if (data.contact_info.linkedin) contacts.push(`<span><i class="fa-brands fa-linkedin"></i> ${escapeHtml(data.contact_info.linkedin)}</span>`);
        if (data.contact_info.github) contacts.push(`<span><i class="fa-brands fa-github"></i> ${escapeHtml(data.contact_info.github)}</span>`);
    }

    // Build experience HTML
    const expHtml = (data.experience || []).map(exp => `
        <div class="res-item">
            <div class="res-item-header">
                <div>
                    <span class="res-item-title">${escapeHtml(exp.role)}</span> &bull; 
                    <span class="res-item-company">${escapeHtml(exp.company)}</span>
                    ${exp.location ? `<span class="text-dim"> (${escapeHtml(exp.location)})</span>` : ''}
                </div>
                <div class="res-item-dates">${escapeHtml(exp.dates || '')}</div>
            </div>
            <ul class="res-bullets">
                ${(exp.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join("")}
            </ul>
        </div>
    `).join("");

    // Build education HTML
    const eduHtml = (data.education || []).map(edu => `
        <div class="res-item">
            <div class="res-item-header">
                <div>
                    <span class="res-item-title">${escapeHtml(edu.degree)}</span> &bull; 
                    <span class="res-item-company">${escapeHtml(edu.school)}</span>
                </div>
                <div class="res-item-dates">${escapeHtml(edu.year || '')}</div>
            </div>
            ${edu.details ? `<p class="text-dim" style="font-size: 9pt; margin-top: 2px;">${escapeHtml(edu.details)}</p>` : ''}
        </div>
    `).join("");

    // Build skills HTML
    const skillsHtml = (data.skills_categorized || []).map(cat => `
        <div class="res-skills-group">
            <span class="res-skills-cat-name">${escapeHtml(cat.category)}:</span>
            <span class="res-skills-list">${(cat.skills || []).map(s => escapeHtml(s)).join(", ")}</span>
        </div>
    `).join("");

    // Build projects HTML
    let projHtml = "";
    if (data.projects && data.projects.length > 0) {
        projHtml = `
            <div class="res-section">
                <div class="res-section-title">Key Technical Projects</div>
                ${data.projects.map(p => `
                    <div class="res-item">
                        <div class="res-item-header">
                            <div>
                                <span class="res-item-title">${escapeHtml(p.name)}</span>
                                ${p.tools ? `<span class="text-dim"> [${escapeHtml(p.tools)}]</span>` : ''}
                            </div>
                        </div>
                        <p class="res-summary-text" style="margin-top: 2px;">${escapeHtml(p.description)}</p>
                    </div>
                `).join("")}
            </div>
        `;
    }

    // Build Certifications HTML
    let certsHtml = "";
    if (data.certifications && data.certifications.length > 0) {
        certsHtml = `
            <div class="res-section">
                <div class="res-section-title">Certifications</div>
                <p class="res-summary-text">${data.certifications.map(c => escapeHtml(c)).join(" &bull; ")}</p>
            </div>
        `;
    }

    canvas.innerHTML = `
        <div class="res-header">
            <h1 class="res-name">${escapeHtml(data.full_name)}</h1>
            <div class="res-target-title">${escapeHtml(data.target_job)}</div>
            <div class="res-contacts">
                ${contacts.join("")}
            </div>
        </div>

        <div class="res-section">
            <div class="res-section-title">Professional Summary</div>
            <p class="res-summary-text">${escapeHtml(data.summary)}</p>
        </div>

        <div class="res-section">
            <div class="res-section-title">Professional Experience</div>
            ${expHtml}
        </div>

        <div class="res-section">
            <div class="res-section-title">Core Skills & Competencies</div>
            ${skillsHtml}
        </div>

        <div class="res-section">
            <div class="res-section-title">Education</div>
            ${eduHtml}
        </div>

        ${projHtml}
        ${certsHtml}
    `;
}

// Switch Resume Template
function switchResumeTemplate(templateClass, btn) {
    const canvas = document.getElementById("resume-canvas");
    if (!canvas) return;

    canvas.className = `resume-paper ${templateClass}`;

    document.querySelectorAll(".template-selector .tpl-btn").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
}

// Print / Download PDF
function printResumePDF() {
    window.print();
}

// Copy Plain Text Resume
function copyResumeText() {
    const canvas = document.getElementById("resume-canvas");
    if (!canvas) return;

    const text = canvas.innerText || canvas.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast("Plain text resume copied to clipboard!", "success");
    });
}

// Copy Markdown Resume
function copyResumeMarkdown() {
    if (!currentGeneratedResume) return;

    const d = currentGeneratedResume;
    const md = `# ${d.full_name}
**${d.target_job}**
${d.contact_info ? `${d.contact_info.email || ''} | ${d.contact_info.phone || ''} | ${d.contact_info.location || ''} | ${d.contact_info.linkedin || ''}` : ''}

## Professional Summary
${d.summary}

## Professional Experience
${(d.experience || []).map(e => `
### ${e.role} — ${e.company} (${e.dates || ''})
${(e.bullets || []).map(b => `- ${b}`).join("\n")}
`).join("\n")}

## Skills
${(d.skills_categorized || []).map(c => `- **${c.category}**: ${(c.skills || []).join(", ")}`).join("\n")}

## Education
${(d.education || []).map(ed => `- **${ed.degree}**, ${ed.school} (${ed.year || ''})`).join("\n")}
`;

    navigator.clipboard.writeText(md).then(() => {
        showToast("Markdown resume copied to clipboard!", "success");
    });
}

// Send Newly Generated Resume to ATS Analyzer
function sendToATSAnalyzer() {
    const canvas = document.getElementById("resume-canvas");
    const targetRole = currentGeneratedResume ? currentGeneratedResume.target_job : "Software Engineer";

    if (!canvas) return;
    const text = canvas.innerText || canvas.textContent;

    // Save in sessionStorage so /analyze can pick it up immediately
    sessionStorage.setItem("resumex_prefill_resume", text);
    sessionStorage.setItem("resumex_prefill_job", targetRole);

    window.location.href = "/analyze";
}

// Edit Builder Form
function editBuilderForm() {
    const formSection = document.getElementById("builder-form-section");
    const resultsSection = document.getElementById("builder-results");

    if (resultsSection) resultsSection.style.display = "none";
    if (formSection) formSection.style.display = "block";
    window.scrollTo({ top: 100, behavior: "smooth" });
}

// Utility: Escape HTML
function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Document Ready Handlers
document.addEventListener("DOMContentLoaded", () => {
    updateCharCount();

    // Check if pre-fill data exists in sessionStorage from Builder to Analyzer
    const prefillResume = sessionStorage.getItem("resumex_prefill_resume");
    const prefillJob = sessionStorage.getItem("resumex_prefill_job");

    if (prefillResume && document.getElementById("resume")) {
        document.getElementById("resume").value = prefillResume;
        if (prefillJob && document.getElementById("target_job")) {
            document.getElementById("target_job").value = prefillJob;
        }
        updateCharCount();
        sessionStorage.removeItem("resumex_prefill_resume");
        sessionStorage.removeItem("resumex_prefill_job");
        showToast("Generated resume loaded into ATS Analyzer!", "success");
    }
});
