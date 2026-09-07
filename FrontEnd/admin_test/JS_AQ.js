const DUMMY_EXAM_ID = 1;
const API_BASE_URL = "https://aiassistant-production-214a.up.railway.app";

let currentRecords = []; // لتخزين بيانات الطلاب لسهولة استدعائها
let currentSelectedGrade = null; // للاحتفاظ ببيانات السجل المفتوح حالياً

document.addEventListener('DOMContentLoaded', fetchExamResults);

// 1. جلب النتائج من السيرفر
async function fetchExamResults() {
    try {
        const response = await fetch(`${API_BASE_URL}/ai/admin/exam-results/${DUMMY_EXAM_ID}`);
        const result = await response.json();
        if (result.status === "success") {
            currentRecords = result.data; // حفظ البيانات محلياً
            renderResultsTable(currentRecords);
        } else {
            console.error("فشل جلب البيانات:", result.message);
        }
    } catch (error) {
        console.error("خطأ أثناء الاتصال بالسيرفر:", error);
    }
}

// 2. بناء الجدول وإضافة الكلاس للزرار
function renderResultsTable(records) {
    const tableBody = document.getElementById('resultsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">لا توجد إجابات مسجلة بعد</td></tr>`;
        return;
    }

    records.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.student_code}</td>
            <td>${item.question_text}</td>
            <td>${item.student_answer}</td>
            <td>${item.ai_score} / ${item.max_score}</td>
            <td id="final-score-${item.grade_id}">${item.final_score}</td>
            <td id="status-${item.grade_id}">${item.status}</td>
            <td>
                <button class="btn-review-action" onclick="openReviewModal(${item.grade_id})">
                    مراجعة / تعديل
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// 3. فتح النافذة وعرض إجابة الطالب وتحديد الماكس
function openReviewModal(gradeId) {
    // البحث عن السجل المطابق في البيانات
    const record = currentRecords.find(r => r.grade_id === gradeId);
    if (!record) return;

    currentSelectedGrade = record;

    // ملء بيانات المودال
    document.getElementById('modalStudentId').innerText = record.student_code;
    
    // وضع النصوص داخل المودال (مع فحص وجود العناصر)
    const qTextEl = document.getElementById('modalQuestionText');
    const mAnswerEl = document.getElementById('modalModelAnswer');
    const sAnswerEl = document.getElementById('modalStudentAnswer');
    const aiFeedEl = document.getElementById('modalAiFeedback');

    if (qTextEl) qTextEl.innerText = record.question_text || 'لا يوجد نص للسؤال';
    if (mAnswerEl) mAnswerEl.innerText = record.model_answer || 'لا يوجد نموذج إجابة';
    if (sAnswerEl) sAnswerEl.innerText = record.student_answer || 'لم يقدم الطالب إجابة';
    if (aiFeedEl) aiFeedEl.innerText = record.ai_feedback || 'لا توجد ملاحظات';

    // ضبط حقل الدرجة وحدودها القصوى والدنيا
    const scoreInput = document.getElementById('finalScore');
    scoreInput.value = record.final_score;
    scoreInput.max = record.max_score; // قفل الماكس على درجة السؤال
    scoreInput.min = 0;

    // عرض الحد الأقصى بجانب الخانة للمدرس
    const maxScoreLabel = document.getElementById('modalMaxScoreLabel');
    if (maxScoreLabel) maxScoreLabel.innerText = `(من ${record.max_score})`;

    document.getElementById('reviewModal').style.display = 'flex';
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
    currentSelectedGrade = null;
}

// 4. التحقق من الدرجة قبل الإرسال لمنع تجاوز الماكس
async function saveGrade() {
    if (!currentSelectedGrade) return;

    const finalScoreInput = document.getElementById('finalScore');
    const finalScoreValue = Number(finalScoreInput.value);

    // التحقق من صحة الرقم وعدم تعديه الماكس
    if (isNaN(finalScoreValue) || finalScoreInput.value === '') {
        alert('الرجاء إدخال رقم صحيح للدرجة.');
        return;
    }

    if (finalScoreValue > currentSelectedGrade.max_score) {
        alert(`خطأ: الدرجة لا يمكن أن تتجاوز الدرجة القصوى (${currentSelectedGrade.max_score})!`);
        finalScoreInput.value = currentSelectedGrade.max_score;
        return;
    }

    if (finalScoreValue < 0) {
        alert('خطأ: لا يمكن إدخال درجة سالبة.');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/ai/admin/update-grade`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grade_id: currentSelectedGrade.grade_id,
                final_score: Math.round(finalScoreValue),
                status: "تم التعديل يدوياً"
            })
        });

        const data = await response.json();

        if (response.ok && data.status === "success") {
            alert('تم اعتماد الدرجة وحفظها بنجاح!');

            // تحديث البيانات محلياً وفي الجدول
            currentSelectedGrade.final_score = data.final_score;
            currentSelectedGrade.status = data.status;

            const scoreCell = document.getElementById(`final-score-${currentSelectedGrade.grade_id}`);
            const statusCell = document.getElementById(`status-${currentSelectedGrade.grade_id}`);
            if (scoreCell) scoreCell.innerText = data.final_score;
            if (statusCell) statusCell.innerText = data.status;

            closeReviewModal();
        } else {
            alert(`خطأ: ${data.message || 'تعذر حفظ التعديل'}`);
        }
    } catch (error) {
        console.error("Save Grade Error:", error);
        alert('حدث خطأ أثناء الاتصال بالسيرفر لحفظ الدرجة.');
    }
}

window.onclick = function(event) {
    const modal = document.getElementById('reviewModal');
    if (event.target === modal) {
        closeReviewModal();
    }
};
