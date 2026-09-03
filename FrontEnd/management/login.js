const API_BASE_URL = "aiassistant-production-214a.up.railway.app";

// ==========================================
// 1. نظام الإشعارات (Toast Notifications)
// ==========================================
function showToast(message, type = 'error') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 12px;";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColor = type === 'error' ? '#ef4444' : '#10b981';
    const icon = type === 'error' ? '❌' : '✅';
    
    toast.style.cssText = `background-color: ${bgColor}; color: white; padding: 14px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: 'Tajawal', sans-serif; font-size: 14px; display: flex; align-items: center; gap: 10px; opacity: 0; transform: translateX(100%); transition: all 0.4s ease;`;
    toast.innerHTML = `<span>${icon}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ==========================================
// 2. التحقق من الحقول عند مغادرتها (On Blur)
// ==========================================
function validateFieldOnBlur(inputElement, errorMessage) {
    if (!inputElement) return;

    inputElement.addEventListener('blur', () => {
        if (inputElement.value.trim() === '') {
            showToast(errorMessage, "error");
            inputElement.style.borderColor = '#ef4444';
        } else {
            inputElement.style.borderColor = '#e2e8f0'; 
        }
    });

    inputElement.addEventListener('input', () => {
        inputElement.style.borderColor = '#41a7f0';
    });
}

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

validateFieldOnBlur(usernameInput, "يرجى إدخال اسم المستخدم (ID)");
validateFieldOnBlur(passwordInput, "يرجى إدخال كلمة المرور");

// ==========================================
// 3. إرسال بيانات الدخول للـ Backend
// ==========================================
const loginForm = document.getElementById('loginForm');

if(loginForm) {
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        const btn = loginForm.querySelector('button');

        if (!username || !password) {
            showToast("يرجى إدخال اسم المستخدم وكلمة المرور", "error");
            return;
        }

        const originalText = btn.innerHTML;
        btn.innerHTML = "جاري الدخول...";
        btn.disabled = true;

        try {
            const payload = {
                username: username,
                password: password
            };

            // يرجى تعديل '/admin/login' لتتطابق مع مسار لوحة التحكم في السيرفر الخاص بك
            const response = await fetch(`${API_BASE_URL}/admin/login`, { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const resData = await response.json();
                showToast("تم تسجيل الدخول كمسؤول بنجاح!", "success");
                
                // تخزين التوكن أو بيانات الإدمن
                localStorage.setItem("admin_id", resData.id || username);
                
                // التوجيه لصفحة رفع المنهج (Bulk Upload)
                setTimeout(() => {
                    window.location.href = "https://ai-assistant-iota-eight.vercel.app/admin/admin.html"; // ضع رابط صفحة التحكم هنا
                }, 1000);

            } else {
                showToast("بيانات الدخول غير صحيحة", "error");
                passwordInput.value = '';
                passwordInput.focus();
            }
        } catch (error) {
            showToast("خطأ في الاتصال بالخادم.", "error");
            console.error(error);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}
