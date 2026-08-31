// تحديد العناصر من واجهة المستخدم
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatHistory = document.getElementById('chatHistory');
const openSidebarBtn = document.getElementById('openSidebar');
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('closeSidebar');
const newChatBtn = document.getElementById('newChatBtn');
const uploadTriggerBtn = document.getElementById('uploadTriggerBtn');
const imageInput = document.getElementById('imageInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');
const headerModelImage = document.getElementById('headerModelImage');

// المتغيرات العامة
let currentImageBase64 = null;
let activeLessonId = 1;
const CURRENT_STUDENT_ID = 1;

// ==========================================
// 1. نظام إضافة وعرض الرسائل
// ==========================================
function appendMessage(text, imageBase64, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add(sender === 'student' ? 'message-student' : 'message-ai');

    // إضافة الصورة إذا وجدت
    if (imageBase64) {
        const imgElement = document.createElement('img');
        imgElement.src = imageBase64;
        imgElement.classList.add('chat-image-sent');
        messageElement.appendChild(imgElement);
    }

    // إضافة النص (مع استخدام marked لردود الذكاء الاصطناعي فقط)
    if (text) {
        const textElement = document.createElement('div');
        if (sender === 'ai') {
            textElement.innerHTML = marked.parse(text); // تحويل الماركداون هنا
        } else {
            textElement.innerHTML = text.replace(/\n/g, "<br>"); // نص الطالب العادي
        }
        messageElement.appendChild(textElement);
    }

    chatHistory.appendChild(messageElement);
    
    // التعديل هنا: التمرير لأسفل فقط لو الطالب هو اللي باعت
    if (sender === 'student') {
        chatHistory.scrollTop = chatHistory.scrollHeight; 
    }
}

// ==========================================
// 2. إرسال الطلب لـ FastAPI
// ==========================================
async function sendToBackend(messageText, imageBase64) {
    const loadingId = "loading-" + Date.now();
    const loadingElement = document.createElement('div');
    loadingElement.id = loadingId;
    loadingElement.classList.add('message-ai', 'loading');
    loadingElement.textContent = "جاري التفكير...";
    
    chatHistory.appendChild(loadingElement);
    
    // لو مش عايز الشات ينزل لما تظهر رسالة "جاري التفكير"، احذف أو اعمل كومنت للسطر ده:
    // chatHistory.scrollTop = chatHistory.scrollHeight; 

    try {
        const response = await fetch("https://aiassistant-production-88d9.up.railway.app/ai/ask-ai/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: messageText || "",
                image: imageBase64,
                lesson_id: activeLessonId,
                student_id: CURRENT_STUDENT_ID
            })
        });

        const data = await response.json();
        document.getElementById(loadingId).remove();

        if (response.ok) {
            appendMessage(data.response, null, 'ai');
            loadSidebarHistory(); // تحديث القائمة
        } else {
            appendMessage(`خطأ من الخادم: ${data.detail}`, null, 'ai');
        }
    } catch (error) {
        document.getElementById(loadingId).remove();
        appendMessage("حدث خطأ في الاتصال. تأكد من تشغيل خادم FastAPI.", null, 'ai');
    }
}

// ==========================================
// 3. التعامل مع إدخال الطالب
// ==========================================
function handleSend() {
    const messageText = chatInput.value.trim();
    if (messageText === "" && !currentImageBase64) return;
    
    appendMessage(messageText, currentImageBase64, 'student');
    sendToBackend(messageText, currentImageBase64);
    
    chatInput.value = "";
    if (currentImageBase64) removeImageBtn.click();
}

sendBtn.addEventListener('click', handleSend);
chatInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
    }
});

// ==========================================
// 4. أزرار الواجهة والقائمة والصور
// ==========================================
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        chatHistory.innerHTML = '<div class="message-ai">ابو عصام معاك في سؤال.\n سؤال مطروش بقى ولا في السهل منه؟</div>';
        activeLessonId = 1;
        sidebar.classList.remove('active');
    });
}

openSidebarBtn.addEventListener('click', () => sidebar.classList.add('active'));
closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('active'));

uploadTriggerBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentImageBase64 = e.target.result;
            imagePreview.src = currentImageBase64;
            imagePreviewContainer.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    }
});

removeImageBtn.addEventListener('click', () => {
    currentImageBase64 = null;
    imageInput.value = '';
    imagePreviewContainer.style.display = 'none';
});

// ==========================================
// 5. جلب المحادثات والبيانات السابقة
// ==========================================
async function loadOldChat(lessonId) {
    try {
        activeLessonId = lessonId;
        chatHistory.innerHTML = '<p style="text-align:center; color:gray; margin-top: 20px;" id="loadingOldChat">جاري تحميل المحادثة...</p>';
        const response = await fetch(`https://aiassistant-production-88d9.up.railway.app/ai/history/chat/${CURRENT_STUDENT_ID}/${lessonId}`);
        document.getElementById('loadingOldChat').remove();
        
        if (response.ok) {
            const data = await response.json();
            if (data.messages.length === 0) {
                chatHistory.innerHTML = '<p style="text-align:center; color:gray;">لا توجد رسائل سابقة.</p>';
                return;
            }
            data.messages.forEach(msg => {
                // الميزة هنا إن appendMessage هتحول الـ AI بالـ marked تلقائياً
                appendMessage(msg.message, msg.image_base64, msg.sender);
            });
        }
    } catch (error) {
        chatHistory.innerHTML = '<p style="text-align:center; color:red;">خطأ في جلب المحادثة.</p>';
    }
}

async function loadAIPersonality() {
    try {
        const response = await fetch("https://aiassistant-production-88d9.up.railway.app/ai/personality/");
        if (response.ok) {
            const data = await response.json();
            if (data.image_base64) headerModelImage.src = data.image_base64;
            if (data.name) headerModelImage.title = data.name;
        }
    } catch (error) {
        console.error("تعذر جلب بيانات المساعد الذكي:", error);
    }
}

async function loadSidebarHistory() {
    try {
        const response = await fetch(`https://aiassistant-production-88d9.up.railway.app/ai/history/sidebar/${CURRENT_STUDENT_ID}`);
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

window.addEventListener('DOMContentLoaded', () => {
    loadAIPersonality();
    loadSidebarHistory();
});
