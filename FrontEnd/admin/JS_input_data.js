// ==========================================
// 1. متغيرات التتبع وحالة الصفحة
// ==========================================
let unitCount = 1;
let lessonCounters = { 1: 1 };
let partCounters = { "1_1": 1 };
let examCounters = { 1: 1 };
let questionCounters = { "1_1": 1 };

let isEditMode = false;
let currentModelImageBase64 = null;
let currentKnowledgeBankId = null;

const BASE_API = "https://aiassistant-production-214a.up.railway.app";

// ==========================================
// 2. التهيئة وجلب البيانات
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    const adminId = localStorage.getItem("admin_id");
    if (!adminId) {
        alert("يرجى تسجيل الدخول أولاً!");
        window.location.href = "login.html";
        return;
    }

    // 1. جلب إعدادات الموديل
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

    // 2. جلب المنهج والامتحانات إن وُجدت
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

            // لو راجع بيانات، نقوم بتفريغ الهيكل وإعادة بنائه بالبيانات الفعلية
            if (adminData.units && adminData.units.length > 0) {
                const container = document.getElementById('unitsContainer');
                container.innerHTML = '';
                unitCount = 0;
                lessonCounters = {};
                partCounters = {};
                examCounters = {};
                questionCounters = {};

                adminData.units.forEach(unit => renderUnit(unit));
            }
        }
    } catch (error) {
        console.error("خطأ في جلب المنهج:", error);
    }

    togglePageMode(false);
});

// ==========================================
// 3. دوال توليد العناصر ديناميكياً
// ==========================================

function renderUnit(unitData = null) {
    unitCount++;
    const uIndex = unitCount;
    lessonCounters[uIndex] = 0;
    examCounters[uIndex] = 0;

    const unitHTML = `
        <div class="unit-box shadow-sm p-3 mb-4 bg-white rounded" id="unit_${uIndex}" data-id="${unitData?.id || ''}">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-end w-100 me-3">
                    <button type="button" class="btn btn-sm btn-light toggle-arrow ms-3 mb-2" onclick="toggleContent('unitContent_${uIndex}', 'arrowUnit_${uIndex}')" id="arrowUnit_${uIndex}">▼</button>
                    <div class="w-100">
                        <label class="form-label fw-bold fs-5 text-dark">اسم الباب / الوحدة</label>
                        <input type="text" class="form-control unit-title border-dark" placeholder="اسم الباب..." value="${unitData?.title || ''}">
                    </div>
                </div>
                <button type="button" class="btn btn-danger mt-4 action-btn-dynamic" onclick="removeBlock('unit_${uIndex}')">حذف الباب</button>
            </div>

            <div id="unitContent_${uIndex}">
                <div id="lessonsContainer_${uIndex}"></div>
                <div id="examsContainer_${uIndex}"></div>

                <div class="row g-2 mt-3 action-btn-dynamic">
                    <div class="col-md-6">
                        <button type="button" class="btn btn-primary w-100 py-2 fw-bold" onclick="addLesson(${uIndex})">
                            + إضافة درس لهذه الوحدة
                        </button>
                    </div>
                    <div class="col-md-6">
                        <button type="button" class="btn btn-purple w-100 py-2 fw-bold" onclick="addExam(${uIndex})">
                            + إضافة امتحان ونموذج إجابة
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('unitsContainer').insertAdjacentHTML('beforeend', unitHTML);

    if (unitData?.lessons && unitData.lessons.length > 0) {
        unitData.lessons.forEach(l => renderLesson(uIndex, l));
    }
    if (unitData?.exams && unitData.exams.length > 0) {
        unitData.exams.forEach(e => renderExam(uIndex, e));
    }
}

function renderLesson(unitId, lessonData = null) {
    lessonCounters[unitId] = (lessonCounters[unitId] || 0) + 1;
    const lIndex = lessonCounters[unitId];
    const uniqueLessonId = `${unitId}_${lIndex}`;
    partCounters[uniqueLessonId] = 0;

    const lessonHTML = `
        <div class="lesson-box shadow-sm p-3 mb-3 bg-light rounded border" id="lesson_${uniqueLessonId}" data-id="${lessonData?.id || ''}">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-end w-100 me-3">
                    <button type="button" class="btn btn-sm btn-light toggle-arrow ms-3 mb-2" onclick="toggleContent('lessonContent_${uniqueLessonId}', 'arrowLesson_${uniqueLessonId}')" id="arrowLesson_${uniqueLessonId}">▼</button>
                    <div class="w-100">
                        <label class="form-label fw-bold text-primary">اسم الدرس</label>
                        <input type="text" class="form-control lesson-title border-primary" placeholder="اسم الدرس..." value="${lessonData?.title || ''}">
                    </div>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm mt-4 action-btn-dynamic" onclick="removeBlock('lesson_${uniqueLessonId}')">حذف الدرس</button>
            </div>
            <div id="lessonContent_${uniqueLessonId}">
                <div id="partsContainer_${uniqueLessonId}"></div>
                <button type="button" class="btn btn-outline-secondary w-100 mt-2 fw-bold action-btn-dynamic" onclick="addPart('${uniqueLessonId}')">
                    + إضافة جزء جديد
                </button>
            </div>
        </div>
    `;

    document.getElementById(`lessonsContainer_${unitId}`).insertAdjacentHTML('beforeend', lessonHTML);

    if (lessonData?.parts && lessonData.parts.length > 0) {
        lessonData.parts.forEach(p => renderPart(uniqueLessonId, p));
    }
}

function renderPart(uniqueLessonId, partData = null) {
    partCounters[uniqueLessonId] = (partCounters[uniqueLessonId] || 0) + 1;
    const pIndex = partCounters[uniqueLessonId];
    const pElementId = `part_${uniqueLessonId}_${pIndex}`;

    const partHTML = `
        <div class="part-box p-3 mb-2 bg-white rounded border border-secondary" id="${pElementId}" data-id="${partData?.id || ''}">
            <div class="d-flex justify-content-end mb-2">
                <button type="button" class="btn btn-sm text-danger fw-bold action-btn-dynamic" onclick="removeBlock('${pElementId}')">✖ حذف الجزء</button>
            </div>
            <div class="row align-items-stretch">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label fw-bold">اسم الجزء</label>
                        <input type="text" class="form-control part-title" placeholder="اسم الجزء..." value="${partData?.title || ''}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-bold text-success">أمثلة</label>
                        <textarea class="form-control part-example" rows="2" placeholder="اكتب الأمثلة هنا...">${partData?.example || ''}</textarea>
                    </div>
                    <div>
                        <label class="form-label fw-bold text-danger">أسئلة</label>
                        <textarea class="form-control part-question" rows="2" placeholder="اكتب الأسئلة هنا...">${partData?.question || ''}</textarea>
                    </div>
                </div>
                <div class="col-md-6 d-flex flex-column mb-3">
                    <label class="form-label fw-bold text-primary">الشرح</label>
                    <textarea class="form-control explanation-area part-lesson-content flex-grow-1" placeholder="اكتب الشرح التفصيلي هنا...">${partData?.lesson_content || ''}</textarea>
                </div>
            </div>
        </div>
    `;

    document.getElementById(`partsContainer_${uniqueLessonId}`).insertAdjacentHTML('beforeend', partHTML);
}

function renderExam(unitId, examData = null) {
    examCounters[unitId] = (examCounters[unitId] || 0) + 1;
    const eIndex = examCounters[unitId];
    const uniqueExamId = `${unitId}_${eIndex}`;
    questionCounters[uniqueExamId] = 0;

    const examHTML = `
        <div class="exam-box shadow-sm p-3 mb-3 bg-white rounded border" id="exam_${uniqueExamId}" data-id="${examData?.id || ''}">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-end w-100 me-3">
                    <button type="button" class="btn btn-sm btn-light toggle-arrow ms-3 mb-2" onclick="toggleContent('examContent_${uniqueExamId}', 'arrowExam_${uniqueExamId}')" id="arrowExam_${uniqueExamId}">▼</button>
                    <div class="w-100">
                        <label class="form-label fw-bold text-purple">عنوان الامتحان المقالي</label>
                        <input type="text" class="form-control exam-title border-purple" placeholder="عنوان الامتحان..." value="${examData?.title || ''}">
                    </div>
                </div>
                <button type="button" class="btn btn-outline-danger btn-sm mt-4 action-btn-dynamic" onclick="removeBlock('exam_${uniqueExamId}')">حذف الامتحان</button>
            </div>
            <div id="examContent_${uniqueExamId}">
                <div id="questionsContainer_${uniqueExamId}"></div>
                <button type="button" class="btn btn-outline-purple w-100 mt-2 fw-bold action-btn-dynamic" onclick="addExamQuestion('${uniqueExamId}')">
                    + إضافة سؤال جديد للامتحان
                </button>
            </div>
        </div>
    `;

    document.getElementById(`examsContainer_${unitId}`).insertAdjacentHTML('beforeend', examHTML);

    if (examData?.questions && examData.questions.length > 0) {
        examData.questions.forEach(q => renderExamQuestion(uniqueExamId, q));
    }
}

function renderExamQuestion(uniqueExamId, qData = null) {
    questionCounters[uniqueExamId] = (questionCounters[uniqueExamId] || 0) + 1;
    const qIndex = questionCounters[uniqueExamId];
    const qElementId = `question_${uniqueExamId}_${qIndex}`;

    const questionHTML = `
        <div class="exam-question-box p-3 mb-2 bg-white rounded border border-secondary" id="${qElementId}" data-id="${qData?.id || ''}">
            <div class="d-flex justify-content-end mb-2">
                <button type="button" class="btn btn-sm text-danger fw-bold action-btn-dynamic" onclick="removeBlock('${qElementId}')">✖ حذف السؤال</button>
            </div>
            <div class="row align-items-stretch">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label fw-bold text-purple">عنوان أو رقم السؤال</label>
                        <input type="text" class="form-control q-title" placeholder="مثال: السؤال الأول..." value="${qData?.title || ''}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-bold text-dark">الدرجة القصوى</label>
                        <input type="number" class="form-control q-max-score" min="1" value="${qData?.max_score || 1}">
                    </div>
                    <div>
                        <label class="form-label fw-bold text-dark">نص السؤال المقالي</label>
                        <textarea class="form-control q-text" rows="3" placeholder="اكتب نص السؤال المقالي...">${qData?.question_text || ''}</textarea>
                    </div>
                </div>
                <div class="col-md-6 d-flex flex-column mb-3">
                    <label class="form-label fw-bold text-success">نقاط الإجابة النموذجية (مرجع تصحيح الذكاء الاصطناعي)</label>
                    <textarea class="form-control model-answer-area q-model-answer flex-grow-1" placeholder="اكتب هنا عناصر الإجابة النموذجية والمصطلحات الأساسية...">${qData?.model_answer || ''}</textarea>
                </div>
            </div>
        </div>
    `;

    document.getElementById(`questionsContainer_${uniqueExamId}`).insertAdjacentHTML('beforeend', questionHTML);
}

// أزرار الاستدعاء عند الضغط
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
// 4. التحكم في وضع التعديل والمعاينة
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
        btn.style.display = isEditMode ? '' : 'none';
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
// 5. استخراج البيانات وحفظها بالسيرفر
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

            // تجميع الامتحانات والأسئلة المقالية
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
                alert("تم حفظ وتحديث المنهج والامتحانات بنجاح!");
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
