const DUMMY_EXAM_ID = 1;
const API_BASE_URL = "https://aiassistant-production-214a.up.railway.app";

let currentRecords = [];
let activeRecord = null;
let currentSelectedGradeId = null; // دعم للمتغير القديم لمنع أي تعارض

document.addEventListener('DOMContentLoaded', fetchExamResults);

// 1. جلب النتائج من السيرفر
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

// 2. تحديث كروت الإحصائيات العلوية
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

// 3. بناء جدول الإجابات
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

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="student-code">${item.student_code}</td>
            <td class="truncate-cell" title="${item.question_text}">${item.question_text}</td>
            <td class="truncate-cell" title="${item.student_answer}">${item.student_answer}</td>
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

// 4. فتح المودال مع فحص أمان وجود العناصر في الـ HTML
function openReviewModal(gradeId) {
    activeRecord = currentRecords.find(r => r.grade_id == gradeId);
    currentSelectedGradeId = gradeId;

    if (!activeRecord) {
        console.error("لم يتم العثور على السجل بالمعرف:", gradeId);
        return;
    }

    // تعبئة البيانات مع التحقق من عدم كون العنصر null
    const studentEl = document.getElementById('modalStudentId');
    const qEl = document.getElementById('modalQuestionText');
    const mEl = document.getElementById('modalModelAnswer');
    const sEl = document.getElementById('modalStudentAnswer');
    const fbEl = document.getElementById('modalAiFeedback');
    const scoreInput = document.getElementById('finalScore');
    const maxHintEl = document.getElementById('modalMaxScoreLabel');

    if (studentEl) studentEl.innerText = activeRecord.student_code;
    if (qEl) qEl.innerText = activeRecord.question_text || 'لا يوجد نص';
    if (mEl) mEl.innerText = activeRecord.model_answer || 'لا يوجد نموذج إجابة';
    if (sEl) sEl.innerText = activeRecord.student_answer || 'لا توجد إجابة';
    if (fbEl) fbEl.innerText = activeRecord.ai_feedback || 'لا توجد ملاحظات';

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

// 5. حفظ الدرجة مع معالجة الاستجابة وحماية التحقق
async function saveGrade() {
    // محاولة إيجاد السجل سواء عبر activeRecord أو عبر currentSelectedGradeId
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

    // التحقق من المدخلات
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grade_id: activeRecord.grade_id,
                final_score: Math.round(newScore),
                status: "تم التعديل يدوياً"
            })
        });

        const data = await response.json();

        // قبول النجاح سواء رجع بـ status="success" أو أرجع رسالة نجاح
        const isSuccess = response.ok && (data.status === "success" || (data.message && data.message.includes("بنجاح")));

        if (isSuccess) {
            alert('تم اعتماد الدرجة وحفظها بنجاح!');

            const updatedStatus = data.record_status || data.status || "تم التعديل يدوياً";
            activeRecord.final_score = data.final_score;
            activeRecord.status = updatedStatus;

            // تحديث الجدول مباشرة في الواجهة
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

// إغلاق النافذة عند النقر خارجها
window.onclick = function(event) {
    const modal = document.getElementById('reviewModal');
    if (event.target === modal) {
        closeReviewModal();
    }
};
