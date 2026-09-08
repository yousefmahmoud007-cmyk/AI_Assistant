const DUMMY_EXAM_ID = 1;
const API_BASE_URL = "https://aiassistant-production-214a.up.railway.app";

let currentRecords = [];
let activeRecord = null;
let currentSelectedGradeId = null;

document.addEventListener('DOMContentLoaded', fetchExamResults);

// ==========================================
// 1. جلب النتائج من السيرفر
// ==========================================
async function fetchExamResults() {
    try {
        const response = await fetch(`${API_BASE_URL}/ai/admin/exam-results/${DUMMY_EXAM_ID}`);
        const result = await response.json();

        if (result.status === "success") {
            currentRecords = result.data || [];
            updateDashboardStats(currentRecords);
            renderResultsTable(currentRecords);
        } else {
            console.error("فشل جلب البيانات:", result.message);
        }
    } catch (error) {
        console.error("خطأ أثناء الاتصال بالسيرفر:", error);
    }
}

// ==========================================
// 2. تحديث كروت الإحصائيات العلوية
// ==========================================
function updateDashboardStats(records) {
    const totalCount = records.length;
    const aiGraded = records.filter(r => r.status && r.status.includes('آلياً')).length;
    const manualReview = records.filter(r => r.status && !r.status.includes('آلياً')).length;

    const elTotal = document.getElementById('totalAnswersCount');
    const elAi = document.getElementById('aiGradedCount');
    const elManual = document.getElementById('manualReviewCount');

    if (elTotal) elTotal.innerText = totalCount;
    if (elAi) elAi.innerText = aiGraded;
    if (elManual) elManual.innerText = manualReview;
}

// ==========================================
// 3. بناء جدول الإجابات
// ==========================================
function renderResultsTable(records) {
    const tableBody = document.getElementById('resultsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 25px;">لا توجد إجابات مسجلة بعد</td></tr>`;
        return;
    }

    records.forEach(item => {
        const isAiGraded = item.status && item.status.includes('آلياً');
        const statusClass = isAiGraded ? 'status-ai' : 'status-manual';
        
        // التحقق مما إذا كانت الإجابة صورة Base64 حتى لا يتم عرض كود التشفير الطويل داخل الجدول
        const isImage = item.student_answer && item.student_answer.startsWith('data:image');
        const answerPreview = isImage ? '📷 [إجابة ورقية مصورة]' : item.student_answer;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="student-code">${item.student_code}</td>
            <td class="truncate-cell" title="${item.question_text}">${item.question_text}</td>
            <td class="truncate-cell" title="${isImage ? 'ورقة إجابة مصورة' : item.student_answer}">
                ${answerPreview}
            </td>
            <td><strong>${item.ai_score}</strong> / ${item.max_score}</td>
            <td id="final-score-${item.grade_id}"><strong>${item.final_score}</strong></td>
            <td><span class="status-badge ${statusClass}" id="status-${item.grade_id}">${item.status}</span></td>
            <td>
                <button class="review-btn" onclick="openReviewModal(${item.grade_id})">مراجعة / تعديل</button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// ==========================================
// 4. فتح نافذة المراجعة (مع دعم عرض الصورة أو النص)
// ==========================================
function openReviewModal(gradeId) {
    activeRecord = currentRecords.find(r => r.grade_id == gradeId);
    currentSelectedGradeId = gradeId;

    if (!activeRecord) {
        console.error("لم يتم العثور على السجل بالمعرف:", gradeId);
        return;
    }

    const studentEl = document.getElementById('modalStudentId');
    const qEl = document.getElementById('modalQuestionText');
    const mEl = document.getElementById('modalModelAnswer');
    const sEl = document.getElementById('modalStudentAnswer');
    const fbEl = document.getElementById('modalAiFeedback');
    const scoreInput = document.getElementById('finalScore');
    const maxHintEl = document.getElementById('modalMaxScoreLabel');

    const imgContainer = document.getElementById('modalImageContainer');
    const imgEl = document.getElementById('modalStudentImage');

    if (studentEl) studentEl.innerText = activeRecord.student_code;
    if (qEl) qEl.innerText = activeRecord.question_text || 'لا يوجد نص';
    if (mEl) mEl.innerText = activeRecord.model_answer || 'لا يوجد نموذج إجابة';
    if (fbEl) fbEl.innerText = activeRecord.ai_feedback || 'لا توجد ملاحظات';

    // فحص نوع الإجابة (صورة Base64 أم نص مكتوب)
    const isImageAnswer = activeRecord.student_answer && activeRecord.student_answer.startsWith('data:image');

    if (isImageAnswer) {
        if (sEl) sEl.style.display = 'none';
        if (imgEl) imgEl.src = activeRecord.student_answer;
        if (imgContainer) imgContainer.style.display = 'block';
    } else {
        if (imgContainer) imgContainer.style.display = 'none';
        if (imgEl) imgEl.src = '';
        if (sEl) {
            sEl.innerText = activeRecord.student_answer || 'لا توجد إجابة مسجلة';
            sEl.style.display = 'block';
        }
    }

    if (scoreInput) {
        scoreInput.value = activeRecord.final_score;
        scoreInput.max = activeRecord.max_score;
        scoreInput.min = 0;
    }

    if (maxHintEl) {
        maxHintEl.innerText = `(الدرجة القصوى: ${activeRecord.max_score})`;
    }

    const modal = document.getElementById('reviewModal');
    if (modal) modal.style.display = 'flex';
}

function closeReviewModal() {
    const modal = document.getElementById('reviewModal');
    if (modal) modal.style.display = 'none';
}

// ==========================================
// 5. حفظ واعتماد الدرجة النهائية
// ==========================================
async function saveGrade() {
    if (!activeRecord && currentSelectedGradeId) {
        activeRecord = currentRecords.find(r => r.grade_id == currentSelectedGradeId);
    }

    if (!activeRecord) {
        alert('حدث خطأ: لم يتم تحديد سجل المراجعة، يرجى إعادة فتح النافذة.');
        return;
    }

    const scoreInput = document.getElementById('finalScore');
    if (!scoreInput) return;

    const newScore = parseFloat(scoreInput.value);

    if (isNaN(newScore) || scoreInput.value.trim() === '') {
        alert('الرجاء إدخال رقم صحيح للدرجة.');
        return;
    }

    if (newScore > activeRecord.max_score) {
        alert(`خطأ: الدرجة المدخلة (${newScore}) تتجاوز الحد الأقصى للسؤال (${activeRecord.max_score})!`);
        scoreInput.value = activeRecord.max_score;
        return;
    }

    if (newScore < 0) {
        alert('خطأ: الدرجة لا يمكن أن تكون سالبة.');
        scoreInput.value = 0;
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/ai/admin/update-grade`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                grade_id: activeRecord.grade_id,
                final_score: parseFloat(newScore.toFixed(1)),
                status: "تم التعديل يدوياً"
            })
        });

        const data = await response.json();
        const isSuccess = response.ok && (data.status === "success" || (data.message && data.message.includes("بنجاح")));

        if (isSuccess) {
            alert('تم اعتماد الدرجة وحفظها بنجاح!');

            const updatedStatus = data.record_status || data.status || "تم التعديل يدوياً";
            activeRecord.final_score = data.final_score;
            activeRecord.status = updatedStatus;

            // تحديث قيم الجدول والبادج فوراً
            const scoreEl = document.getElementById(`final-score-${activeRecord.grade_id}`);
            const statusEl = document.getElementById(`status-${activeRecord.grade_id}`);

            if (scoreEl) scoreEl.innerHTML = `<strong>${data.final_score}</strong>`;
            if (statusEl) {
                statusEl.innerText = updatedStatus;
                statusEl.className = 'status-badge status-manual';
            }

            updateDashboardStats(currentRecords);
            closeReviewModal();
        } else {
            alert(`خطأ: ${data.message || 'تعذر حفظ التعديل'}`);
        }
    } catch (error) {
        console.error("Save Error:", error);
        alert('حدث خطأ أثناء الاتصال بالسيرفر لحفظ الدرجة.');
    }
}

// إغلاق النافذة المنبثقة عند النقر خارجها
window.onclick = function(event) {
    const modal = document.getElementById('reviewModal');
    if (event.target === modal) {
        closeReviewModal();
    }
};
