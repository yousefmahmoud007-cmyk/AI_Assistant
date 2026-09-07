// ==========================================
// بيانات تجريبية ثابتة لاختبار الفكرة
// ==========================================
const DUMMY_KNOWLEDGE_BANK_ID = 4;     // كود بنك المعرفة (المادة الخاصة بالمدرس)
const DUMMY_QUESTION_ID = 1;           // رقم السؤال في جدول ExamQuestion
const DUMMY_STUDENT_ID = "01012345678"; // كود/رقم هاتف الطالب المسجل
const API_BASE_URL = "https://aiassistant-production-214a.up.railway.app"; // رابط سيرفر Railway

// ==========================================
// دالة إرسال الإجابة والتصحيح بالذكاء الاصطناعي
// ==========================================
async function submitAnswer() {
    const answerText = document.getElementById('studentAnswer').value;
    const btn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const loader = document.getElementById('btnLoader');
    const resultContainer = document.getElementById('resultContainer');

    // التأكد من أن الطالب كتب إجابة
    if (answerText.trim() === '') {
        alert('الرجاء كتابة إجابة قبل التسليم!');
        return;
    }

    // تغيير حالة الزر لانتظار الرد
    btn.disabled = true;
    btnText.innerText = 'جاري تحليل الإجابة وتصحيحها عبر الذكاء الاصطناعي...';
    loader.style.display = 'block';
    resultContainer.style.display = 'none';

    try {
        // تم إضافة /ai لأن مسار الـ router في الباك إند هو: prefix="/ai"
        const response = await fetch(`${API_BASE_URL}/ai/quiz-answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                kb_id: DUMMY_QUESTION_ID,
                student_id: DUMMY_STUDENT_ID,
                student_answer: answerText,
                knowledge_bank_id: DUMMY_KNOWLEDGE_BANK_ID
            })
        });

        const data = await response.json();

        if (response.ok && data.status === "success") {
            // عرض الدرجة وتعليق الذكاء الاصطناعي في الواجهة
            const scoreElem = document.getElementById('aiScore');
            const feedbackElem = document.getElementById('aiFeedback');

            if (scoreElem) scoreElem.innerText = data.score;
            if (feedbackElem) feedbackElem.innerText = data.feedback;

            resultContainer.style.display = 'block';
        } else {
            alert(`خطأ: ${data.message || data.detail || 'تعذر تصحيح الإجابة'}`);
        }
    } catch (error) {
        console.error("Submission Error:", error);
        alert('فشل الاتصال بالسيرفر، تأكد من أن السيرفر يعمل بشكل صحيح.');
    } finally {
        btn.disabled = false;
        btnText.innerText = 'إعادة الإرسال';
        loader.style.display = 'none';
    }
}

// ==========================================
// وظائف الكاميرا ورفع الصورة
// ==========================================

// فتح كاميرا الهاتف مباشرة أو نافذة الملفات
function openCamera() {
    const input = document.getElementById('imageInput');
    if (input) input.click();
}

// معاينة الصورة المختارة قبل الإرسال
function handleImageSelected(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('imagePreview');
            const container = document.getElementById('imagePreviewContainer');
            if (preview) preview.src = e.target.result;
            if (container) container.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

// إلغاء الصورة المختارة
function removeImage() {
    const input = document.getElementById('imageInput');
    const container = document.getElementById('imagePreviewContainer');
    if (input) input.value = "";
    if (container) container.style.display = 'none';
}
