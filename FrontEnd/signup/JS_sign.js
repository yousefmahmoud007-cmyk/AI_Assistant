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
    
    toast.style.cssText = `background-color: ${bgColor}; color: white; padding: 14px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: sans-serif; font-size: 14px; display: flex; align-items: center; gap: 10px; opacity: 0; transform: translateX(100%); transition: all 0.4s ease;`;
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
// 2. حركة الانزلاق بين تسجيل الدخول والإنشاء
// ==========================================
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

signUpButton.addEventListener('click', () => {
    container.classList.add('right-panel-active');
});

signInButton.addEventListener('click', () => {
    container.classList.remove('right-panel-active');
});

const API_BASE_URL = "https://aiassistant-production-214a.up.railway.app";

// ==========================================
// 3. التحقق من الحقول عند مغادرتها (On Blur Validation)
// ==========================================
function validateFieldOnBlur(inputElement, errorMessage) {
    if (!inputElement) return;
    inputElement.addEventListener('blur', () => {
        if (inputElement.value.trim() === '') {
            showToast(errorMessage, "error");
            inputElement.style.borderColor = '#ef4444';
        } else {
            inputElement.style.borderColor = 'var(--border-color, #e2e8f0)';
        }
    });
    inputElement.addEventListener('input', () => {
        inputElement.style.borderColor = 'var(--primary-color, #41a7f0)';
    });
}

const signupUsername = document.getElementById('username');
const signupPhone = document.getElementById('phone');
const signupPassword = document.getElementById('password');
// تم إزالة signupKbId من التحقق الإجباري في إنشاء الحساب

validateFieldOnBlur(signupUsername, "يرجى كتابة اسم المستخدم");
validateFieldOnBlur(signupPhone, "يرجى كتابة رقم الهاتف");
validateFieldOnBlur(signupPassword, "يرجى كتابة كلمة المرور");

const loginUsername = document.getElementById('signInPhone');
const loginPassword = document.getElementById('signInPassword');
const signinKbId = document.getElementById('signinKbId');

validateFieldOnBlur(loginUsername, "رقم الهاتف مطلوب لتسجيل الدخول");
validateFieldOnBlur(loginPassword, "كلمة المرور مطلوبة");
validateFieldOnBlur(signinKbId, "يرجى إدخال كود المدرس (ID)");

// ==========================================
// 4. كود إنشاء حساب جديد (Sign Up)
// ==========================================
const signUpFormBtn = document.getElementById('signUpForm');
if(signUpFormBtn){
    signUpFormBtn.addEventListener('submit', async function(event) {
        event.preventDefault();
        const usernameEl = document.getElementById('username');
        const phoneEl = document.getElementById('phone');
        const passwordEl = document.getElementById('password');
        const kbIdEl = document.getElementById('signupKbId'); // حتى لو مش موجود في HTML مش هيعمل مشكلة
        const btn = signUpFormBtn.querySelector('button');

        const username = usernameEl ? usernameEl.value.trim() : '';
        const phone = phoneEl ? phoneEl.value.trim() : '';
        const password = passwordEl ? passwordEl.value.trim() : '';
        // جلب الـ ID لو موجود، ولو مش موجود هيكون null
        const kbId = kbIdEl && kbIdEl.value.trim() !== '' ? parseInt(kbIdEl.value.trim()) : null;

        if (!/^\d{11}$/.test(phone)) {
            showToast("رقم الهاتف يجب أن يتكون من 11 رقماً", "error");
            return;
        }

        // تم حذف كود (if (!kbId) { showToast... }) من هنا نهائياً ✔️

        const originalText = btn.innerHTML;
        btn.innerHTML = "جاري الإنشاء...";
        btn.disabled = true;

        try {
            const payload = {
                username: username,
                phone_number: phone,
                password: password,
                knowledge_bank_id: kbId 
            };
            const response = await fetch(`${API_BASE_URL}/ai/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast("تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول.", "success");
                if(usernameEl) usernameEl.value = '';
                if(phoneEl) phoneEl.value = '';
                if(passwordEl) passwordEl.value = '';
                if(kbIdEl) kbIdEl.value = '';
                container.classList.remove('right-panel-active');
            } else {
                const err = await response.json();
                showToast("حدث خطأ: " + (err.detail || "البيانات غير صحيحة أو موجودة مسبقاً"), "error");
            }
        } catch (error) {
            showToast("خطأ في الاتصال بالخادم. تحقق من الإنترنت.", "error");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}

// ==========================================
// 5. كود تسجيل الدخول (Sign In / Login)
// ==========================================
const signInFormBtn = document.getElementById('signInForm');
if(signInFormBtn){
    signInFormBtn.addEventListener('submit', async function(event) {
        event.preventDefault();
        const loginUserEl = document.getElementById('signInPhone');
        const loginPassEl = document.getElementById('signInPassword');
        const loginKbIdEl = document.getElementById('signinKbId');
        const btn = signInFormBtn.querySelector('button');

        const username = loginUserEl ? loginUserEl.value.trim() : '';
        const password = loginPassEl ? loginPassEl.value.trim() : '';
        const kbId = loginKbIdEl && loginKbIdEl.value.trim() !== '' ? parseInt(loginKbIdEl.value.trim()) : null;

        if (!/^\d{11}$/.test(username)) {
            showToast("رقم الهاتف يجب أن يتكون من 11 رقماً", "error");
            return;
        }
        
        // هنا سيبنا التحقق بتاع تسجيل الدخول عشان الطالب يقدر يدخل على مدرس معين
        if (!kbId) {
            showToast("يرجى إدخال كود المدرس (ID)", "error");
            return;
        }

        const originalText = btn.innerHTML;
        btn.innerHTML = "جاري الدخول...";
        btn.disabled = true;

        try {
            const payload = {
                phone_number: username,
                password: password,
                knowledge_bank_id: kbId
            };
            const response = await fetch(`${API_BASE_URL}/ai/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const resData = await response.json();
                showToast("تم تسجيل الدخول بنجاح!", "success");
                
                // حفظ البيانات لاستخدامها في الشات
                localStorage.setItem("student_id", resData.student_id || resData.id);
                localStorage.setItem("student_username", resData.username || "الطالب");
                localStorage.setItem("knowledge_bank_id", kbId);

                // توجيه لصفحة الشات بناءً على هيكل الملفات
                setTimeout(() => {
                    window.location.href = "../assistant/chat.html";
                }, 1000);
            } else {
                showToast("البيانات غير صحيحة، تأكد من الهاتف، كلمة المرور، أو كود المدرس", "error");
                if(loginPassEl) {
                    loginPassEl.value = '';
                    loginPassEl.focus();
                }
            }
        } catch (error) {
            showToast("خطأ في الاتصال بالخادم.", "error");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
}
