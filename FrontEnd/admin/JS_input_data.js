// ==========================================
// 1. متغيرات التتبع وحالة الصفحة
// ==========================================
let unitCount = 0;
let lessonCounters = {};
let partCounters = {};
let examCounters = {};
let questionCounters = {};

let isEditMode = false;
let currentModelImageBase64 = null;
let currentKnowledgeBankId = null;

const BASE_API = "https://aiassistant-production-214a.up.railway.app";

// ==========================================
// 2. جلب البيانات عند تحميل الصفحة
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    const adminId = localStorage.getItem("admin_id");
    if (!adminId) {
        alert("يرجى تسجيل الدخول أولاً!");
        window.location.href = "login.html";
        return;
    }

    // جلب إعدادات الشخصية
    try {
        const aiResponse = await fetch(`${BASE_API}/ai/personality/${adminId}`);
        if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const modelNameEl = document.getElementById('modelName');
            const modelPersonalityEl = document.getElementById('modelPersonality');
            if (modelNameEl) modelNameEl.value = aiData.name || "";
            if (modelPersonalityEl) modelPersonalityEl.value = aiData.description || "";
            if (aiData.image_base64) {
                currentModelImageBase64 = aiData.image_base64;
                const imgPreview = document.getElementById('modelImagePreview');
                const cameraIcon = document.getElementById('cameraIcon');
                if (imgPreview) {
                    imgPreview.src = currentModelImageBase64;
                    imgPreview.style.display = 'block';
                }
                if (cameraIcon) cameraIcon.style.display = 'none';
            }
        }
    } catch (error) {
        console.error("خطأ في جلب الشخصية:", error);
    }

    // جلب بيانات المنهج والامتحانات
    try {
        const adminResponse = await fetch(`${BASE_API}/admin/knowledge-bank/${adminId}`);
        if (adminResponse.ok) {
            const adminData = await adminResponse.json();
            if (adminData.message === "لا توجد بيانات محفوظة بعد") {
                togglePageMode(true);
                return;
            }

            if (adminData.id) currentKnowledgeBankId = adminData.id;

            const subjectNameEl = document.getElementById('subjectName');
            if (subjectNameEl && adminData.knowledge_bank_title) {
                subjectNameEl.value = adminData.knowledge_bank_title;
            }

            const unitsContainer = document.getElementById('unitsContainer');
            if (unitsContainer) {
                unitsContainer.innerHTML = '';
                unitCount = 0;
                lessonCounters = {};
                partCounters = {};
                examCounters = {};
                questionCounters = {};

                if (adminData.units && adminData.units.length > 0) {
                    adminData.units.forEach((unitData) => {
                        renderUnit(unitData);
                    });
                }
            }
        }
    } catch (error) {
        console.error("خطأ في جلب المنهج:", error);
    }

    togglePageMode(false);
});

// ==========================================
// 3. دوال بناء عناصر الواجهة (DOM Rendering)
// ==========================================

function renderUnit(unitData = null) {
    unitCount++;
    const currentUnitId = unitCount;
    lessonCounters[currentUnitId] = 0;
    examCounters[currentUnitId] = 0;

    const uId = unitData?.id || '';
    const uTitle = unitData?.title || '';

    const unitHTML = `
        <div class="unit-box shadow-sm p-3 mb-4 bg-white rounded" id="unit_${currentUnitId}" data-id="${uId}">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-end w-100 me-3">
                    <button class="btn btn-sm btn-light toggle-arrow ms-3 mb-2" onclick="toggleContent('unitContent_${currentUnitId}', 'arrowUnit_${currentUnitId}')" id="arrowUnit_${currentUnitId}">▼</button>
                    <div class="w-100">
                        <label class="form-label fw-bold fs-5 text-dark">اسم الباب / الوحدة</label>
                        <input type="text" class="form-control unit-title border-dark" placeholder="اسم الباب..." value="${uTitle}">
                    </div>
                </div>
                <button class="btn btn-danger mt-4 action-btn-dynamic" onclick="removeBlock('unit_${currentUnitId}')">حذف الباب</button>
            </div>

            <div id="unitContent_${currentUnitId}">
                <!-- قسم الدروس -->
                <div class="mb-4">
                    <h6 class="fw-bold text-primary mb-3">📚 الدروس التعليمية والشرح</h6>
                    <div id="lessonsContainer_${currentUnitId}"></div>
                    <button class="btn btn-outline-primary w-100 mt-2 py-2 fw-bold action-btn-dynamic" onclick="addLesson(${currentUnitId})">
                        + إضافة درس جديد لهذه الوحدة
                    </button>
                </div>

                <!-- قسم الامتحانات ونماذج الإجابة -->
                <div class="exams-wrapper rounded p-3 mt-3">
                    <h6 class="fw-bold text-dark mb-3">📝 الامتحانات ونماذج الإجابة (للتصحيح الذكي)</h6>
                    <div id="examsContainer_${currentUnitId}"></div>
                    <button class="btn btn-outline-exam w-100 mt-2 py-2 fw-bold action-btn-dynamic" onclick="addExam(${currentUnitId})">
                        + إضافة امتحان ونماذج إجابة لهذا الباب
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('unitsContainer').insertAdjacentHTML('beforeend', unitHTML);

    // ملء الدروس القديمة
    if (unitData?.lessons?.length > 0) {
        unitData.lessons.forEach(lesson => renderLesson(currentUnitId, lesson));
    }

    // ملء الامتحانات القديمة
    if (unitData?.exams?.length > 0) {
        unitData.exams.forEach(exam => renderExam(currentUnitId, exam));
    }
}

function renderLesson(unitId, lessonData = null) {
    lessonCounters[unitId]++;
    const lessonIndex = lessonCounters[unitId];
    const uniqueLessonId = `${unitId}_${lessonIndex}`;
    partCounters[uniqueLessonId] = 0;

    const lId = lessonData?.id || '';
    const lTitle = lessonData?.title || '';

    const lessonHTML = `
        <div class="lesson-box shadow-sm p-3 mb-3 bg-light rounded border" id="lesson_${uniqueLessonId}" data-id="${lId}">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-end w-100 me-3">
                    <button class="btn btn-sm btn-light toggle-arrow ms-3 mb-2" onclick="toggleContent('lessonContent_${uniqueLessonId}', 'arrowLesson_${uniqueLessonId}')" id="arrowLesson_${uniqueLessonId}">▼</button>
                    <div class="w-100">
                        <label class="form-label fw-bold text-primary">اسم الدرس</label>
                        <input type="text" class="form-control lesson-title border-primary" placeholder="اسم الدرس..." value="${lTitle}">
                    </div>
                </div>
                <button class="btn btn-outline-danger btn-sm mt-4 action-btn-dynamic" onclick="removeBlock('lesson_${uniqueLessonId}')">حذف الدرس</button>
            </div>
            <div id="lessonContent_${uniqueLessonId}">
                <div id="partsContainer_${uniqueLessonId}"></div>
                <button class="btn btn-outline-secondary w-100 mt-2 fw-bold action-btn-dynamic" onclick="addPart('${uniqueLessonId}')">
                    + إضافة جزء جديد للدرس
                </button>
            </div>
        </div>
    `;

    document.getElementById(`lessonsContainer_${unitId}`).insertAdjacentHTML('beforeend', lessonHTML);

    if (lessonData?.parts?.length > 0) {
        lessonData.parts.forEach(part => renderPart(uniqueLessonId, part));
    }
}

function renderPart(uniqueLessonId, partData = null) {
    partCounters[uniqueLessonId]++;
    const partIndex = partCounters[uniqueLessonId];
    const partElementId = `part_${uniqueLessonId}_${partIndex}`;

    const pId = partData?.id || '';
    const pTitle = partData?.title || '';
    const pContent = partData?.lesson_content || '';
    const pExample = partData?.example || '';
    const pQuestion = partData?.question || '';

    const partHTML = `
        <div class="part-box p-3 mb-2 bg-white rounded border border-secondary" id="${partElementId}" data-id="${pId}">
            <div class="d-flex justify-content-end mb-2">
                <button class="btn btn-sm text-danger fw-bold action-btn-dynamic" onclick="removeBlock('${partElementId}')">✖ حذف الجزء</button>
            </div>
            <div class="row align-items-stretch">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label fw-bold">اسم الجزء</label>
                        <input type="text" class="form-control part-title" placeholder="اسم الفقرة..." value="${pTitle}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-bold text-success">أمثلة</label>
                        <textarea class="form-control part-example" rows="2" placeholder="أمثلة...">${pExample}</textarea>
                    </div>
                    <div>
                        <label class="form-label fw-bold text-danger">أسئلة</label>
                        <textarea class="form-control part-question" rows="2" placeholder="أسئلة...">${pQuestion}</textarea>
                    </div>
                </div>
                <div class="col-md-6 d-flex flex-column mb-3">
                    <label class="form-label fw-bold text-primary">الشرح</label>
                    <textarea class="form-control explanation-area part-lesson-content flex-grow-1" placeholder="الشرح التفصيلي...">${pContent}</textarea>
                </div>
            </div>
        </div>
    `;

    document.getElementById(`partsContainer_${uniqueLessonId}`).insertAdjacentHTML('beforeend', partHTML);
}

// بناء مكونات الامتحانات
function renderExam(unitId, examData = null) {
    examCounters[unitId]++;
    const examIndex = examCounters[unitId];
    const uniqueExamId = `${unitId}_${examIndex}`;
    questionCounters[uniqueExamId] = 0;

    const eId = examData?.id || '';
    const eTitle = examData?.title || '';

    const examHTML = `
        <div class="exam-box shadow-sm p-3 mb-3 bg-white rounded border" id="exam_${uniqueExamId}" data-id="${eId}">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-end w-100 me-3">
                    <button class="btn btn-sm btn-light toggle-arrow ms-3 mb-2" onclick="toggleContent('examContent_${uniqueExamId}', 'arrowExam_${uniqueExamId}')" id="arrowExam_${uniqueExamId}">▼</button>
                    <div class="w-100">
                        <label class="form-label fw-bold text-exam" style="color: var(--color-exam);">عنوان الامتحان المقالي</label>
                        <input type="text" class="form-control exam-title border-secondary" placeholder="مثال: امتحان مقالي على قوانين كيرشوف" value="${eTitle}">
                    </div>
                </div>
                <button class="btn btn-outline-danger btn-sm mt-4 action-btn-dynamic" onclick="removeBlock('exam_${uniqueExamId}')">حذف الامتحان</button>
            </div>
            <div id="examContent_${uniqueExamId}">
                <div id="questionsContainer_${uniqueExamId}"></div>
                <button class="btn btn-sm btn-exam w-100 mt-2 py-2 fw-bold action-btn-dynamic" onclick="addExamQuestion('${uniqueExamId}')">
                    + إضافة سؤال مقالي ونموذج تصحيح
                </button>
            </div>
        </div>
    `;

    document.getElementById(`examsContainer_${unitId}`).insertAdjacentHTML('beforeend', examHTML);

    if (examData?.questions?.length > 0) {
        examData.questions.forEach(q => renderExamQuestion(uniqueExamId, q));
    }
}

function renderExamQuestion(uniqueExamId, qData = null) {
    questionCounters[uniqueExamId]++;
    const qIndex = questionCounters[uniqueExamId];
    const qElementId = `question_${uniqueExamId}_${qIndex}`;

    const qId = qData?.id || '';
    const qTitle = qData?.title || '';
    const qText = qData?.question_text || '';
    const qAnswer = qData?.model_answer || '';
    const qScore = qData?.max_score || 1;

    const questionHTML = `
        <div class="exam-question-box p-3 mb-3 bg-white rounded border" id="${qElementId}" data-id="${qId}">
            <div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                <span class="fw-bold" style="color: var(--color-exam);">سؤال مقالي ونموذج الإجابة المعتمد</span>
                <button class="btn btn-sm text-danger fw-bold action-btn-dynamic" onclick="removeBlock('${qElementId}')">✖ حذف السؤال</button>
            </div>
            <div class="row g-2 mb-2">
                <div class="col-md-9">
                    <label class="form-label small fw-bold">عنوان أو رقم السؤال</label>
                    <input type="text" class="form-control q-title" placeholder="مثال: علل لما يأتي..." value="${qTitle}">
                </div>
                <div class="col-md-3">
                    <label class="form-label small fw-bold">الدرجة القصوى</label>
                    <input type="number" class="form-control q-max-score" min="1" value="${qScore}">
                </div>
            </div>
            <div class="mb-2">
                <label class="form-label small fw-bold text-dark">نص السؤال المقالي:</label>
                <textarea class="form-control q-text" rows="2" placeholder="اكتب السؤال المقالي كاملاً كما يظهر للطالب...">${qText}</textarea>
            </div>
            <div>
                <label class="form-label small fw-bold text-success">نموذج الإجابة المعتمد (دليل التصحيح لـ Gemini):</label>
                <textarea class="form-control model-answer-area q-model-answer" rows="3" placeholder="اكتب هنا الإجابة النموذجية والمصطلحات الأساسية اللازمة لمنح الدرجة...">${qAnswer}</textarea>
            </div>
        </div>
    `;

    document.getElementById(`questionsContainer_${uniqueExamId}`).insertAdjacentHTML('beforeend', questionHTML);
}

// دوال مساعدة للإضافة اليدوية أثناء وضع التعديل
function addLesson(unitId) {
    renderLesson(unitId);
    renderPart(`${unitId}_${lessonCounters[unitId]}`);
}

function addPart(uniqueLessonId) {
    renderPart(uniqueLessonId);
}

function addExam(unitId) {
    renderExam(unitId);
    renderExamQuestion(`${unitId}_${examCounters[unitId]}`);
}

function addExamQuestion(uniqueExamId) {
    renderExamQuestion(uniqueExamId);
}

// ==========================================
// 4. التحكم في وضع التعديل والعرض
// ==========================================
const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const addUnitBtn = document.getElementById('addUnitBtn');
const imageUploadTrigger = document.getElementById('imageUploadTrigger');
const modelImageInput = document.getElementById('modelImageInput');

function togglePageMode(editMode) {
    isEditMode = editMode;

    if (isEditMode) {
        if (editBtn) editBtn.classList.add('d-none');
        if (saveBtn) saveBtn.classList.remove('d-none');
        if (addUnitBtn) addUnitBtn.style.display = 'block';
        if (imageUploadTrigger) imageUploadTrigger.classList.remove('disabled-mode');
    } else {
        if (saveBtn) saveBtn.classList.add('d-none');
        if (editBtn) editBtn.classList.remove('d-none');
        if (addUnitBtn) addUnitBtn.style.display = 'none';
        if (imageUploadTrigger) imageUploadTrigger.classList.add('disabled-mode');
    }

    document.querySelectorAll('input, textarea').forEach(field => {
        if (isEditMode) field.removeAttribute('disabled');
        else field.setAttribute('disabled', 'true');
    });

    document.querySelectorAll('.action-btn-dynamic').forEach(btn => {
        btn.style.display = isEditMode ? 'inline-block' : 'none';
    });
}

if (editBtn) editBtn.addEventListener('click', () => togglePageMode(true));
if (saveBtn) saveBtn.addEventListener('click', () => togglePageMode(false));

if (addUnitBtn) {
    addUnitBtn.addEventListener('click', () => {
        renderUnit();
        addLesson(unitCount);
    });
}

// رفع صورة الموديل
if (imageUploadTrigger) {
    imageUploadTrigger.addEventListener('click', () => {
        if (isEditMode && modelImageInput) modelImageInput.click();
    });
}

if (modelImageInput) {
    modelImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                currentModelImageBase64 = e.target.result;
                const imgPreview = document.getElementById('modelImagePreview');
                const cameraIcon = document.getElementById('cameraIcon');
                if (imgPreview) {
                    imgPreview.src = currentModelImageBase64;
                    imgPreview.style.display = 'block';
                }
                if (cameraIcon) cameraIcon.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });
}

function toggleContent(contentId, arrowId) {
    const content = document.getElementById(contentId);
    const arrow = document.getElementById(arrowId);
    if (content && arrow) {
        if (content.style.display !== "none") {
            content.style.display = "none";
            arrow.textContent = "◀";
        } else {
            content.style.display = "block";
            arrow.textContent = "▼";
        }
    }
}

function removeBlock(elementId) {
    if (isEditMode) {
        const element = document.getElementById(elementId);
        if (element) element.remove();
    }
}

// ==========================================
// 5. تجميع البيانات وحفظها (Bulk Upload)
// ==========================================
if (document.getElementById('exportJsonBtn')) {
    document.getElementById('exportJsonBtn').addEventListener('click', async () => {
        const subjectNameEl = document.getElementById('subjectName');
        const modelNameEl = document.getElementById('modelName');
        const modelPersonalityEl = document.getElementById('modelPersonality');

        const subjectName = subjectNameEl ? subjectNameEl.value.trim() : "";
        const modelName = modelNameEl ? modelNameEl.value.trim() : "";
        const modelDescription = modelPersonalityEl ? modelPersonalityEl.value.trim() : "";

        if (!subjectName) {
            alert("يرجى إدخال اسم المادة أولاً!");
            return;
        }

        let finalData = {
            bank_id: currentKnowledgeBankId,
            model_settings: {
                name: modelName || "المعلم الذكي",
                description: modelDescription,
                image_base64: currentModelImageBase64
            },
            knowledge_bank_title: subjectName,
            units: []
        };

        // جمع الوحدات
        document.querySelectorAll('.unit-box').forEach(unitBlock => {
            const unitTitle = unitBlock.querySelector('.unit-title').value.trim();
            if (!unitTitle) return;

            const unitId = unitBlock.getAttribute('data-id');
            const unitData = {
                id: unitId ? parseInt(unitId) : null,
                title: unitTitle,
                lessons: [],
                exams: []
            };

            // تجميع الدروس
            unitBlock.querySelectorAll('.lesson-box').forEach(lessonBlock => {
                const lessonTitle = lessonBlock.querySelector('.lesson-title').value.trim();
                if (!lessonTitle) return;

                const lessonId = lessonBlock.getAttribute('data-id');
                const lessonData = {
                    id: lessonId ? parseInt(lessonId) : null,
                    title: lessonTitle,
                    parts: []
                };

                lessonBlock.querySelectorAll('.part-box').forEach(partBlock => {
                    const partTitle = partBlock.querySelector('.part-title').value.trim();
                    if (!partTitle) return;

                    const partId = partBlock.getAttribute('data-id');
                    lessonData.parts.push({
                        id: partId ? parseInt(partId) : null,
                        title: partTitle,
                        lesson_content: partBlock.querySelector('.part-lesson-content').value.trim(),
                        example: partBlock.querySelector('.part-example').value.trim(),
                        question: partBlock.querySelector('.part-question').value.trim()
                    });
                });

                unitData.lessons.push(lessonData);
            });

            // تجميع الامتحانات ونماذج الإجابة
            unitBlock.querySelectorAll('.exam-box').forEach(examBlock => {
                const examTitle = examBlock.querySelector('.exam-title').value.trim();
                if (!examTitle) return;

                const examId = examBlock.getAttribute('data-id');
                const examData = {
                    id: examId ? parseInt(examId) : null,
                    title: examTitle,
                    questions: []
                };

                examBlock.querySelectorAll('.exam-question-box').forEach(qBlock => {
                    const qText = qBlock.querySelector('.q-text').value.trim();
                    const qAnswer = qBlock.querySelector('.q-model-answer').value.trim();
                    if (!qText || !qAnswer) return;

                    const qId = qBlock.getAttribute('data-id');
                    examData.questions.push({
                        id: qId ? parseInt(qId) : null,
                        title: qBlock.querySelector('.q-title').value.trim(),
                        question_text: qText,
                        model_answer: qAnswer,
                        max_score: parseInt(qBlock.querySelector('.q-max-score').value) || 1
                    });
                });

                unitData.exams.push(examData);
            });

            finalData.units.push(unitData);
        });

        const btn = document.getElementById('exportJsonBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = "جاري الحفظ والتحديث...";
        btn.disabled = true;

        try {
            const response = await fetch(`${BASE_API}/admin/bulk-upload/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalData)
            });

            if (response.ok) {
                const resData = await response.json();
                if (resData.bank_id) currentKnowledgeBankId = resData.bank_id;
                alert("تم حفظ المنهج ونماذج الإجابة بنجاح!");
                window.location.reload();
            } else {
                const err = await response.json();
                alert("حدث خطأ: " + (err.detail || err.message));
            }
        } catch (error) {
            console.error("Save Error:", error);
            alert("خطأ في الاتصال بالخادم.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}
