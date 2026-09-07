// بيانات تجريبية ثابتة لاختبار الفكرة
const DUMMY_QUESTION_ID = 1;        // رقم السؤال (kb_id) في جدول ExamQuestion
const DUMMY_STUDENT_ID = "01012345678"; // كود/رقم هاتف الطالب المسجل
const API_BASE_URL = "https://aiassistant-production-214a.up.railway.app"; // رابط السيرفر الذي يستضيف FastAPI

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
        const response = await fetch(`${API_BASE_URL}/quiz-answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                kb_id: DUMMY_QUESTION_ID,
                student_id: DUMMY_STUDENT_ID,
                student_answer: answerText
            })
        });

        const data = await response.json();

        if (response.ok && data.status === "success") {
            // عرض النتيجة وتقييم الـ AI داخل الحاوية
            // (تأكد من وجود عناصر بالـ IDs دي أو عدلها حسب تصميم HTML عندك)
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
        alert('فشل الاتصال بالسيرفر، تأكد من تشغيل FastAPI.');
    } finally {
        btn.disabled = false;
        btnText.innerText = 'إعادة الإرسال';
        loader.style.display = 'none';
    }
}
// فتح كاميرا الهاتف مباشرة أو نافذة الملفات
function openCamera() {
    document.getElementById('imageInput').click();
}

// معاينة الصورة المختارة قبل الإرسال
function handleImageSelected(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreviewContainer').style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
}

// إلغاء الصورة
function removeImage() {
    document.getElementById('imageInput').value = "";
    document.getElementById('imagePreviewContainer').style.display = 'none';
}
