// ==========================================
// 1. متغيرات التتبع وحالة الصفحة
// ==========================================
let unitCount = 0;
let lessonCounters = {};
let partCounters = {};
let isEditMode = false;
let currentModelImageBase64 = null;
let currentKnowledgeBankId = null;

// ==========================================
// 2. جلب البيانات عند تحميل الصفحة
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    
    // 1. جلب الـ ID بتاع الـ Admin من التخزين المحلي (اللي اتسجل وقت الدخول)
    const adminId = localStorage.getItem("admin_id");

    // 2. لو مفيش ID، يبقى الإدمن ده مدخلش من صفحة الـ Login، نرجعه ليها فوراً
    if (!adminId) {
        alert("يرجى تسجيل الدخول أولاً!");
        window.location.href = "login.html"; // تأكد إن ده اسم صفحة الدخول بتاعتك
        return;
    }

    console.log("جاري جلب بيانات المدرس رقم:", adminId);

    // جلب بيانات الشخصية
    try {
        // ضفنا الـ adminId في آخر الرابط عشان السيرفر يعرف شخصية مين اللي هترجع
        const aiResponse = await fetch(`https://aiassistant-production-88d9.up.railway.app/ai/personality/${adminId}`);
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

    // جلب بيانات المنهج
    try {
        // ضفنا الـ adminId في آخر الرابط عشان السيرفر يرجع منهج المدرس ده بس
        const adminResponse = await fetch(`https://aiassistant-production-88d9.up.railway.app/admin/knowledge-bank/${adminId}`);
        if (adminResponse.ok) {
            const adminData = await adminResponse.json();
            
            if (adminData.message === "لا توجد بيانات محفوظة بعد") {
                togglePageMode(false);
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
                
                if (adminData.units && adminData.units.length > 0) {
                    adminData.units.forEach((unitData) => {
                        unitCount++;
                        lessonCounters[unitCount] = 0;
                        
                        // زرع الـ ID في الوحدة
                        const unitHTML = `
                        <div class="unit-box shadow-sm p-3 mb-4 bg-white rounded" id="unit_${unitCount}" data-id="${unitData.id || ''}">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div class="d-flex align-items-end w-100 me-3">
                                    <button class="btn btn-sm btn-light toggle-arrow ms-3 mb-2" onclick="toggleContent('unitContent_${unitCount}', 'arrowUnit_${unitCount}')" id="arrowUnit_${unitCount}">▼</button>
                                    <div class="w-100">
                                        <label class="form-label fw-bold fs-5 text-dark">اسم الباب / الوحدة</label>
                                        <input type="text" class="form-control unit-title border-dark" value="${unitData.title}">
                                    </div>
                                </div>
                                <button class="btn btn-danger mt-4 action-btn-dynamic" onclick="removeBlock('unit_${unitCount}')">حذف الباب</button>
                            </div>
                            <div id="unitContent_${unitCount}">
                                <div id="lessonsContainer_${unitCount}"></div>
                                <button class="btn btn-outline-primary w-100 mt-3 py-2 fw-bold action-btn-dynamic" onclick="addLesson(${unitCount})">
                                    + إضافة درس لهذه الوحدة
                                </button>
                            </div>
                        </div>
                        `;
                        unitsContainer.insertAdjacentHTML('beforeend', unitHTML);
                        
                        if (unitData.lessons && unitData.lessons.length > 0) {
                            unitData.lessons.forEach((lessonData) => {
                                lessonCounters[unitCount]++;
                                const lessonId = lessonCounters[unitCount];
                                const uniqueLessonId = `${unitCount}_${lessonId}`;
                                partCounters[uniqueLessonId] = 0;
                                
                                // زرع الـ ID في الدرس
                                const lessonHTML = `
                                <div class="lesson-box shadow-sm p-3 mb-3 bg-light rounded border" id="lesson_${uniqueLessonId}" data-id="${lessonData.id || ''}">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <div class="d-flex align-items-end w-100 me-3">
                                            <button class="btn btn-sm btn-light toggle-arrow ms-3 mb-2" onclick="toggleContent('lessonContent_${uniqueLessonId}', 'arrowLesson_${uniqueLessonId}')" id="arrowLesson_${uniqueLessonId}">▼</button>
                                            <div class="w-100">
                                                <label class="form-label fw-bold text-primary">اسم الدرس</label>
                                                <input type="text" class="form-control lesson-title border-primary" value="${lessonData.title}">
                                            </div>
                                        </div>
                                        <button class="btn btn-outline-danger btn-sm mt-4 action-btn-dynamic" onclick="removeBlock('lesson_${uniqueLessonId}')">حذف الدرس</button>
                                    </div>
                                    <div id="lessonContent_${uniqueLessonId}">
                                        <div id="partsContainer_${uniqueLessonId}"></div>
                                        <button class="btn btn-outline-secondary w-100 mt-3 fw-bold action-btn-dynamic" onclick="addPart('${uniqueLessonId}')">
                                            + إضافة جزء جديد
                                        </button>
                                    </div>
                                </div>
                                `;
                                document.getElementById(`lessonsContainer_${unitCount}`).insertAdjacentHTML('beforeend', lessonHTML);
                                
                                if (lessonData.parts && lessonData.parts.length > 0) {
                                    lessonData.parts.forEach((partData) => {
                                        partCounters[uniqueLessonId]++;
                                        const partId = partCounters[uniqueLessonId];
                                        const partElementId = `part_${uniqueLessonId}_${partId}`;
                                        
                                        // زرع الـ ID في الجزء
                                        const partHTML = `
                                        <div class="part-box p-3 mb-2 bg-white rounded border border-secondary" id="${partElementId}" data-id="${partData.id || ''}">
                                            <div class="d-flex justify-content-end mb-2">
                                                <button class="btn btn-sm text-danger fw-bold action-btn-dynamic" onclick="removeBlock('${partElementId}')">✖ حذف الجزء</button>
                                            </div>
                                            <div class="row align-items-stretch">
                                                <div class="col-md-6">
                                                    <div class="mb-3">
                                                        <label class="form-label fw-bold">اسم الجزء</label>
                                                        <input type="text" class="form-control part-title" value="${partData.title}">
                                                    </div>
                                                    <div class="mb-3">
                                                        <label class="form-label fw-bold text-success">أمثلة</label>
                                                        <textarea class="form-control part-example" rows="2">${partData.example || ''}</textarea>
                                                    </div>
                                                    <div>
                                                        <label class="form-label fw-bold text-danger">أسئلة</label>
                                                        <textarea class="form-control part-question" rows="2">${partData.question || ''}</textarea>
                                                    </div>
                                                </div>
                                                <div class="col-md-6 d-flex flex-column mb-3">
                                                    <label class="form-label fw-bold text-primary">الشرح</label>
                                                    <textarea class="form-control explanation-area part-lesson-content flex-grow-1">${partData.lesson_content || ''}</textarea>
                                                </div>
                                            </div>
                                        </div>
                                        `;
                                        document.getElementById(`partsContainer_${uniqueLessonId}`).insertAdjacentHTML('beforeend', partHTML);
                                    });
                                }
                            });
                        }
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
// 3. التحكم في وضع التعديل والقراءة
// ==========================================
const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const addUnitBtn = document.getElementById('addUnitBtn');
const imageUploadTrigger = document.getElementById('imageUploadTrigger');
const modelImageInput = document.getElementById('modelImageInput');

function togglePageMode(editMode) {
    isEditMode = editMode;
    if (isEditMode) {
        if(editBtn) editBtn.classList.add('d-none');
        if(saveBtn) saveBtn.classList.remove('d-none');
        if(addUnitBtn) addUnitBtn.classList.remove('d-none');
        if(imageUploadTrigger) imageUploadTrigger.classList.remove('disabled-mode');
    } else {
        if(saveBtn) saveBtn.classList.add('d-none');
        if(editBtn) editBtn.classList.remove('d-none');
        if(addUnitBtn) addUnitBtn.classList.add('d-none');
        if(imageUploadTrigger) imageUploadTrigger.classList.add('disabled-mode');
    }
    document.querySelectorAll('input, textarea').forEach(field => {
        if (isEditMode) field.removeAttribute('disabled');
        else field.setAttribute('disabled', 'true');
    });
    document.querySelectorAll('.action-btn-dynamic').forEach(btn => {
        btn.style.display = isEditMode ? 'inline-block' : 'none';
    });
}

if(editBtn) editBtn.addEventListener('click', () => togglePageMode(true));
if(saveBtn) saveBtn.addEventListener('click', () => togglePageMode(false));

// ==========================================
// 4. برمجة رفع وعرض صورة الموديل
// ==========================================
if(imageUploadTrigger) {
    imageUploadTrigger.addEventListener('click', () => {
        if (isEditMode && modelImageInput) modelImageInput.click();
    });
}
if(modelImageInput) {
    modelImageInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
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

// ==========================================
// 5. إنشاء العناصر الديناميكية يدوياً
// ==========================================
if(document.getElementById('addUnitBtn')) {
    document.getElementById('addUnitBtn').addEventListener('click', function() {
        unitCount++;
        lessonCounters[unitCount] = 0;
        const unitHTML = `
            <div class="unit-box shadow-sm p-3 mb-4 bg-white rounded" id="unit_${unitCount}" data-id="">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="d-flex align-items-end w-100 me-3">
                        <button class="btn btn-sm btn-light toggle-arrow ms-3 mb-2" onclick="toggleContent('unitContent_${unitCount}', 'arrowUnit_${unitCount}')" id="arrowUnit_${unitCount}">▼</button>
                        <div class="w-100">
                            <label class="form-label fw-bold fs-5 text-dark">اسم الباب / الوحدة</label>
                            <input type="text" class="form-control unit-title border-dark" placeholder="مثال: الباب الأول - الكهربية التيارية">
                        </div>
                    </div>
                    <button class="btn btn-danger mt-4 action-btn-dynamic" onclick="removeBlock('unit_${unitCount}')">حذف الباب</button>
                </div>
                <div id="unitContent_${unitCount}">
                    <div id="lessonsContainer_${unitCount}"></div>
                    <button class="btn btn-outline-primary w-100 mt-3 py-2 fw-bold action-btn-dynamic" onclick="addLesson(${unitCount})">
                        + إضافة درس لهذه الوحدة
                    </button>
                </div>
            </div>
        `;
        document.getElementById('unitsContainer').insertAdjacentHTML('beforeend', unitHTML);
        addLesson(unitCount);
    });
}

function addLesson(unitId) {
    lessonCounters[unitId]++;
    const lessonId = lessonCounters[unitId];
    const uniqueLessonId = `${unitId}_${lessonId}`;
    partCounters[uniqueLessonId] = 0;
    const lessonHTML = `
        <div class="lesson-box shadow-sm p-3 mb-3 bg-light rounded border" id="lesson_${uniqueLessonId}" data-id="">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-end w-100 me-3">
                    <button class="btn btn-sm btn-light toggle-arrow ms-3 mb-2" onclick="toggleContent('lessonContent_${uniqueLessonId}', 'arrowLesson_${uniqueLessonId}')" id="arrowLesson_${uniqueLessonId}">▼</button>
                    <div class="w-100">
                        <label class="form-label fw-bold text-primary">اسم الدرس</label>
                        <input type="text" class="form-control lesson-title border-primary" placeholder="اسم الدرس هنا...">
                    </div>
                </div>
                <button class="btn btn-outline-danger btn-sm mt-4 action-btn-dynamic" onclick="removeBlock('lesson_${uniqueLessonId}')">حذف الدرس</button>
            </div>
            <div id="lessonContent_${uniqueLessonId}">
                <div id="partsContainer_${uniqueLessonId}"></div>
                <button class="btn btn-outline-secondary w-100 mt-3 fw-bold action-btn-dynamic" onclick="addPart('${uniqueLessonId}')">
                    + إضافة جزء جديد
                </button>
            </div>
        </div>
    `;
    document.getElementById(`lessonsContainer_${unitId}`).insertAdjacentHTML('beforeend', lessonHTML);
    addPart(uniqueLessonId);
}

function addPart(uniqueLessonId) {
    partCounters[uniqueLessonId]++;
    const partId = partCounters[uniqueLessonId];
    const partElementId = `part_${uniqueLessonId}_${partId}`;
    const partHTML = `
        <div class="part-box p-3 mb-2 bg-white rounded border border-secondary" id="${partElementId}" data-id="">
            <div class="d-flex justify-content-end mb-2">
                <button class="btn btn-sm text-danger fw-bold action-btn-dynamic" onclick="removeBlock('${partElementId}')">✖ حذف الجزء</button>
            </div>
            <div class="row align-items-stretch">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label fw-bold">اسم الجزء</label>
                        <input type="text" class="form-control part-title" placeholder="اسم الجزء...">
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-bold text-success">أمثلة</label>
                        <textarea class="form-control part-example" rows="2" placeholder="اكتب الأمثلة هنا..."></textarea>
                    </div>
                    <div>
                        <label class="form-label fw-bold text-danger">أسئلة</label>
                        <textarea class="form-control part-question" rows="2" placeholder="اكتب الأسئلة هنا..."></textarea>
                    </div>
                </div>
                <div class="col-md-6 d-flex flex-column mb-3">
                    <label class="form-label fw-bold text-primary">الشرح</label>
                    <textarea class="form-control explanation-area part-lesson-content flex-grow-1" placeholder="اكتب الشرح التفصيلي هنا..."></textarea>
                </div>
            </div>
        </div>
    `;
    document.getElementById(`partsContainer_${uniqueLessonId}`).insertAdjacentHTML('beforeend', partHTML);
}

// ==========================================
// 6. وظائف مساعدة
// ==========================================
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
    if(isEditMode) {
        const element = document.getElementById(elementId);
        if (element) element.remove();
    }
}

// ==========================================
// 7. تجميع البيانات وإرسالها
// ==========================================
if(document.getElementById('exportJsonBtn')) {
    document.getElementById('exportJsonBtn').addEventListener('click', async function() {
        const subjectNameEl = document.getElementById('subjectName');
        const modelNameEl = document.getElementById('modelName');
        const modelPersonalityEl = document.getElementById('modelPersonality');
        
        const subjectName = subjectNameEl ? subjectNameEl.value.trim() : "";
        const modelName = modelNameEl ? modelNameEl.value.trim() : "";
        const modelDescription = modelPersonalityEl ? modelPersonalityEl.value.trim() : "";
        
        if(!subjectName) {
            alert("يرجى إدخال اسم المادة أولاً");
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

        document.querySelectorAll('.unit-box').forEach(unitBlock => {
            let unitTitle = unitBlock.querySelector('.unit-title').value.trim();
            if(!unitTitle) return;
            
            let unitId = unitBlock.getAttribute('data-id');
            let unitData = { 
                id: unitId ? parseInt(unitId) : null,
                title: unitTitle, 
                lessons: [] 
            };
            
            unitBlock.querySelectorAll('.lesson-box').forEach(lessonBlock => {
                let lessonTitle = lessonBlock.querySelector('.lesson-title').value.trim();
                if(!lessonTitle) return;
                
                let lessonId = lessonBlock.getAttribute('data-id');
                let lessonData = { 
                    id: lessonId ? parseInt(lessonId) : null,
                    title: lessonTitle, 
                    parts: [] 
                };
                
                lessonBlock.querySelectorAll('.part-box').forEach(partBlock => {
                    let partTitle = partBlock.querySelector('.part-title').value.trim();
                    if(!partTitle) return;
                    
                    let partId = partBlock.getAttribute('data-id');
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
            finalData.units.push(unitData);
        });

        const btn = document.getElementById('exportJsonBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = "جاري الحفظ...";
        btn.disabled = true;
        
        try {
            const response = await fetch("https://aiassistant-production-88d9.up.railway.app/admin/bulk-upload/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalData)
            });
            if (response.ok) {
                const resData = await response.json();
                if(resData.bank_id) {
                    currentKnowledgeBankId = resData.bank_id;
                }
                alert("تم حفظ وتحديث المنهج بنجاح!");
                // إعادة تحميل الصفحة لرسم الـ IDs الجديدة لو تم إضافة عناصر جديدة
                window.location.reload(); 
            } else {
                const err = await response.json();
                alert("حدث خطأ: " + err.detail);
                console.error("Server Error:", err);
            }
        } catch (error) {
            alert("خطأ في الاتصال بالخادم.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}
