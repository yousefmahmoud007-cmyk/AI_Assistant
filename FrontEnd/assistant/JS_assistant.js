// ==========================================
// 0. حماية الصفحة (Auth Guard)
// ==========================================
const savedStudentId = localStorage.getItem("student_id");
const savedKbId = localStorage.getItem("knowledge_bank_id");

if (!savedStudentId || !savedKbId) {
    window.location.href = "https://ai-assistant-iota-eight.vercel.app/signup/index.html";
}

// تحديد العناصر من واجهة المستخدم
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatHistory = document.getElementById('chatHistory');
const openSidebarBtn = document.getElementById('openSidebar');
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('closeSidebar');
const newChatBtn = document.getElementById('newChatBtn');
const headerModelImage = document.getElementById('headerModelImage');

// عناصر رفع ومعاينة الصور
const uploadTriggerBtn = document.getElementById('uploadTriggerBtn');
const imageInput = document.getElementById('imageInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');

// ==========================================
// المتغيرات العامة
// ==========================================
const API_BASE_URL = "https://aiassistant-production-214a.up.railway.app";
const CURRENT_KB_ID = savedKbId;
const CURRENT_STUDENT_ID = savedStudentId;
let activeLessonId = null;
let currentImageBase64 = null;

// ==========================================
// دالة تشغيل KaTeX
// ==========================================
function renderLatexEquations(element) {
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(element, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        });
    } else {
        window.addEventListener('load', () => renderLatexEquations(element), { once: true });
    }
}

// ==========================================
// 1. نظام إضافة وعرض الرسائل
// ==========================================
function appendMessage(text, imageBase64, sender, shouldScroll = true) {
    const messageElement = document.createElement('div');
    messageElement.classList.add(sender === 'student' ? 'message-student' : 'message-ai');

    if (imageBase64) {
        const imgElement = document.createElement('img');
        imgElement.src = imageBase64;
        imgElement.classList.add('chat-image-sent');
        messageElement.appendChild(imgElement);
    }

    if (text) {
        const textElement = document.createElement('div');
        if (sender === 'ai' && typeof marked !== 'undefined') {
            textElement.innerHTML = marked.parse(text);
        } else {
            textElement.innerHTML = text.replace(/\n/g, "<br>");
        }
        renderLatexEquations(textElement);
        messageElement.appendChild(textElement);
    }

    chatHistory.appendChild(messageElement);

    if (shouldScroll) {
        if (sender === 'student') {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        } else {
            messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

// ==========================================
// 2. إرسال الطلب لـ FastAPI (تم تحديثه بإرسال knowledge_bank_id)
// ==========================================
async function sendToBackend(messageText, imageToSend = null) {
    const loadingId = "loading-" + Date.now();
    const loadingElement = document.createElement('div');
    loadingElement.id = loadingId;
    loadingElement.classList.add('message-ai', 'loading');
    loadingElement.textContent = "جاري التفكير...";
    chatHistory.appendChild(loadingElement);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    try {
        const response = await fetch(`${API_BASE_URL}/ai/ask-ai/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: messageText,
                image: imageToSend,
                lesson_id: activeLessonId,
                knowledge_bank_id: parseInt(CURRENT_KB_ID), // إرسال البنك لحمايته من تداخل المواد
                student_id: CURRENT_STUDENT_ID
            })
        });

        const data = await response.json();
        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();

        if (response.ok) {
            appendMessage(data.response, null, 'ai', true);
            loadSidebarHistory();
        } else {
            appendMessage(`خطأ من الخادم: ${data.detail || data.response}`, null, 'ai', true);
        }
    } catch (error) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        appendMessage("حدث خطأ في الاتصال. تأكد من تشغيل خادم FastAPI.", null, 'ai', true);
    }
}

// ==========================================
// 3. التعامل مع إدخال الطالب والوسائط
// ==========================================
function clearImagePreview() {
    currentImageBase64 = null;
    if (imageInput) imageInput.value = "";
    if (imagePreview) imagePreview.src = "";
    if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
}

function handleSend() {
    const messageText = chatInput.value.trim();
    if (messageText === "" && !currentImageBase64) return;

    const imageToSend = currentImageBase64;
    appendMessage(messageText, imageToSend, 'student', true);
    sendToBackend(messageText, imageToSend);

    chatInput.value = "";
    clearImagePreview();
}

if (sendBtn) sendBtn.addEventListener('click', handleSend);
if (chatInput) {
    chatInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    });
}

if (uploadTriggerBtn && imageInput) {
    uploadTriggerBtn.addEventListener('click', () => imageInput.click());
}

if (imageInput) {
    imageInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                currentImageBase64 = e.target.result;
                if (imagePreview) imagePreview.src = currentImageBase64;
                if (imagePreviewContainer) imagePreviewContainer.style.display = "block";
            };
            reader.readAsDataURL(file);
        }
    });
}

if (removeImageBtn) {
    removeImageBtn.addEventListener('click', clearImagePreview);
}

// ==========================================
// 4. أزرار الواجهة والقائمة
// ==========================================
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        chatHistory.innerHTML = '<div class="message-ai">مرحبا! كيف يمكنني مساعدتك اليوم؟</div>';
        activeLessonId = null; // ضبط القيمة كـ null ليعمل الشات على نطاق المادة ككل
        sidebar.classList.remove('active');
        clearImagePreview();
    });
}

if (openSidebarBtn) openSidebarBtn.addEventListener('click', () => sidebar.classList.add('active'));
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));

// ==========================================
// 5. جلب المحادثات والبيانات السابقة
// ==========================================
async function loadOldChat(lessonId) {
    try {
        activeLessonId = lessonId;
        chatHistory.innerHTML = '<p style="text-align:center; color:gray; margin-top: 20px;" id="loadingOldChat">جاري تحميل المحادثة...</p>';

        const response = await fetch(`${API_BASE_URL}/ai/history/chat/${CURRENT_STUDENT_ID}/${lessonId}`);
        const loadingEl = document.getElementById('loadingOldChat');
        if (loadingEl) loadingEl.remove();

        if (response.ok) {
            const data = await response.json();
            if (data.messages.length === 0) {
                chatHistory.innerHTML = '<p style="text-align:center; color:gray;">لا توجد رسائل سابقة.</p>';
                return;
            }
            chatHistory.innerHTML = '';
            data.messages.forEach(msg => {
                appendMessage(msg.message, msg.image_base64, msg.sender, false);
            });
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    } catch (error) {
        chatHistory.innerHTML = '<p style="text-align:center; color:red;">خطأ في جلب المحادثة.</p>';
    }
}

async function loadAIPersonality() {
    try {
        const response = await fetch(`${API_BASE_URL}/ai/personality/${CURRENT_KB_ID}`);
        if (response.ok) {
            const data = await response.json();
            if (data.image_base64 && headerModelImage) headerModelImage.src = data.image_base64;
            if (data.name && headerModelImage) headerModelImage.title = data.name;
        }
    } catch (error) {
        console.error("تعذر جلب بيانات المساعد الذكي:", error);
    }
}

async function loadSidebarHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/ai/history/sidebar/${CURRENT_STUDENT_ID}/${CURRENT_KB_ID}`);

        if (response.ok) {
            const data = await response.json();
            const sidebarContainer = document.getElementById('chatHistorySidebar');
            if (!sidebarContainer) return;
            sidebarContainer.innerHTML = '';

            if (data.history.length === 0) {
                sidebarContainer.innerHTML = '<p style="text-align:center; color:gray; font-size: 14px;">لا توجد محادثات سابقة</p>';
                return;
            }

            data.history.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-btn-style p-2 mb-2 bg-light rounded shadow-sm text-center cursor-pointer';
                historyItem.textContent = item.title;
                historyItem.style.cursor = 'pointer';
                historyItem.onclick = () => {
                    loadOldChat(item.lesson_id);
                    sidebar.classList.remove('active');
                };
                sidebarContainer.appendChild(historyItem);
            });
        }
    } catch (error) {
        console.error("تعذر جلب سجل المحادثات:", error);
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "../signup/index.html";
}

window.addEventListener('DOMContentLoaded', () => {
    loadAIPersonality();
    loadSidebarHistory();
    renderLatexEquations(chatHistory);
});
