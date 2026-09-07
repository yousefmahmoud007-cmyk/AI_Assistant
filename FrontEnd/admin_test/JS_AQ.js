const DUMMY_EXAM_ID = 1; // معرف الامتحان المطلوب عرض نتائجه
const API_BASE_URL = "https://aiassistant-production-214a.up.railway.app"; // رابط السيرفر الذي يستضيف FastAPI

let currentSelectedGradeId = null; // متغير للاحتفاظ بـ id سجل الدرجة المراد تعديلها

// جلب النتائج تلقائياً بمجرد فتح الصفحة
document.addEventListener('DOMContentLoaded', fetchExamResults);

async function fetchExamResults() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/exam-results/${DUMMY_EXAM_ID}`);
        const result = await response.json();

        if (result.status === "success") {
            renderResultsTable(result.data);
        } else {
            console.error("فشل جلب البيانات:", result.message);
        }
    } catch (error) {
        console.error("خطأ أثناء الاتصال بالسيرفر:", error);
    }
}

// بناء صفوف الجدول ديناميكياً
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
                <button onclick="openReviewModal(${item.grade_id}, '${item.student_code}', ${item.final_score})">
                    مراجعة / تعديل
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// دوال التحكم في النافذة المنبثقة (Modal)
function openReviewModal(gradeId, studentCode, currentScore) {
    currentSelectedGradeId = gradeId; // حفظ معرّف السجل الحالي

    document.getElementById('modalStudentId').innerText = studentCode;
    document.getElementById('finalScore').value = currentScore;
    document.getElementById('reviewModal').style.display = 'flex';
}

function closeReviewModal() {
    document.getElementById('reviewModal').style.display = 'none';
    currentSelectedGradeId = null;
}

// حفظ الدرجة الجديدة وإرسالها للباك إند
async function saveGrade() {
    const finalScoreValue = document.getElementById('finalScore').value;

    if (finalScoreValue === '' || currentSelectedGradeId === null) {
        alert('الرجاء إدخال درجة صالحة');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/update-grade`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                grade_id: currentSelectedGradeId,
                final_score: parseInt(finalScoreValue),
                status: "تم التعديل يدوياً"
            })
        });

        const data = await response.json();

        if (response.ok && data.status === "success") {
            alert('تم اعتماد الدرجة وحفظها بنجاح!');

            // تحديث القيم في الجدول مباشرة دون الحاجة لإعادة تحميل الصفحة
            const scoreCell = document.getElementById(`final-score-${currentSelectedGradeId}`);
            const statusCell = document.getElementById(`status-${currentSelectedGradeId}`);
            
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

// إغلاق النافذة عند النقر خارجها
window.onclick = function(event) {
    const modal = document.getElementById('reviewModal');
    if (event.target === modal) {
        closeReviewModal();
    }
};
