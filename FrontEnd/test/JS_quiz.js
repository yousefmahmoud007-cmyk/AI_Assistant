// ==========================================
// بيانات تجريبية ثابتة لاختبار الفكرة
// ==========================================
const DUMMY_KNOWLEDGE_BANK_ID = 4;     // كود المادة المعتمدة
const DUMMY_QUESTION_ID = 1;           // رقم السؤال في جدول ExamQuestion
const DUMMY_STUDENT_ID = "01234567890"; // كود/رقم هاتف الطالب المسجل
const API_BASE_URL = "https://aiassistant-production-214a.up.railway.app";

// ==========================================
// 1. جلب السؤال تلقائياً عند فتح الصفحة
// ==========================================
window.addEventListener('DOMContentLoaded', fetchQuestion);

async function fetchQuestion() {
    const questionTextElem = document.getElementById('questionText');
    const questionTitleElem = document.getElementById('questionTitle');
    const examTitleElem = document.getElementById('examTitle');
    const maxScoreElem = document.getElementById('maxScore');

    try {
        const response = await fetch(`${API_BASE_URL}/ai/exam-question/${DUMMY_QUESTION_ID}`);
        const data = await response.json();

        if (response.ok && data.status === "success") {
            if (questionTextElem) questionTextElem.innerText = data.question_text;
            if (questionTitleElem && data.title) questionTitleElem.innerText = data.title;
            if (examTitleElem && data.exam_title) examTitleElem.innerText = data.exam_title;
            if (maxScoreElem) maxScoreElem.innerText = data.max_score;
        } else {
            if (questionTextElem) questionTextElem.innerText = "تعذر تحميل السؤال. تأكد من وجود سؤال برقم 1 في قاعدة البيانات.";
            console.error("فشل جلب السؤال:", data.detail || data.message);
        }
    } catch (error) {
        console.error("Fetch Question Error:", error);
        if (questionTextElem) questionTextElem.innerText = "حدث خطأ في الاتصال بالخادم لجلب نص السؤال.";
    }
}

// ==========================================
// 2. إرسال الإجابة للتصحيح عبر الذكاء الاصطناعي
// ==========================================
// ==========================================
// متغيرات معالجة الصور
// ==========================================
let studentImageBase64 = null;

// معاينة الصورة وحفظها بصيغة Base64
function handleImageSelected(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            studentImageBase64 = e.target.result; // حفظ الصورة
            document.getElementById('imagePreview').src = studentImageBase64;
            document.getElementById('imagePreviewContainer').style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

// حذف الصورة المختارة وتفريغ الحقل
function removeImage() {
    studentImageBase64 = null;
    document.getElementById('imageInput').value = "";
    document.getElementById('imagePreviewContainer').style.display = 'none';
}

// ==========================================
// دالة إرسال الإجابة والتصحيح بالذكاء الاصطناعي
// ==========================================
async function submitAnswer() {
    const answerText = document.getElementById('studentAnswer').value;
    const btn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const loader = document.getElementById('btnLoader');
    const resultContainer = document.getElementById('resultContainer');

    // التحقق: يسمح بالتسليم لو كتب نص أو التقط صورة
    if (answerText.trim() === '' && !studentImageBase64) {
        alert('الرجاء كتابة إجابة أو التقاط صورة لورقة الحل قبل التسليم!');
        return;
    }

    // تغيير حالة الزر لانتظار التصحيح
    btn.disabled = true;
    btnText.innerText = 'جاري تحليل الإجابة وتصحيحها عبر الذكاء الاصطناعي...';
    loader.style.display = 'block';
    resultContainer.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/ai/quiz-answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                kb_id: DUMMY_QUESTION_ID,
                student_id: DUMMY_STUDENT_ID,
                student_answer: answerText,
                image: studentImageBase64, // إرسال الصورة للسيرفر
                knowledge_bank_id: DUMMY_KNOWLEDGE_BANK_ID
            })
        });

        const data = await response.json();

        if (response.ok && data.status === "success") {
            const scoreElem = document.getElementById('aiScore');
            const maxScoreElem = document.getElementById('maxScore');
            const feedbackElem = document.getElementById('aiFeedback');

            if (scoreElem) scoreElem.innerText = data.score;
            if (maxScoreElem && data.max_score) maxScoreElem.innerText = data.max_score;
            if (feedbackElem) feedbackElem.innerText = data.feedback;

            resultContainer.style.display = 'block';
        } else {
            alert(`خطأ: ${data.message || data.detail || 'تعذر تصحيح الإجابة'}`);
        }
    } catch (error) {
        console.error("Submission Error:", error);
        alert('فشل الاتصال بالسيرفر أثناء تسليم الإجابة.');
    } finally {
        btn.disabled = false;
        btnText.innerText = 'إعادة الإرسال';
        loader.style.display = 'none';
    }
}

// ==========================================
// 3. وظائف الكاميرا ورفع الصورة
// ==========================================
function openCamera() {
    const input = document.getElementById('imageInput');
    if (input) input.click();
}

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

function removeImage() {
    const input = document.getElementById('imageInput');
    const container = document.getElementById('imagePreviewContainer');
    if (input) input.value = "";
    if (container) container.style.display = 'none';
}
