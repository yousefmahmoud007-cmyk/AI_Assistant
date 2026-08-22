import os
import google.generativeai as genai
from dotenv import load_dotenv

# تحميل المتغيرات
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ المشكلة هنا: الكود مش قادر يقرأ المفتاح السري! تأكد من وجود ملف .env واسم المتغير.")
else:
    print("✅ المفتاح مقروء بنجاح. جاري الاتصال بخوادم جوجل...")
    genai.configure(api_key=api_key)
    
    try:
        print("\n🚀 النماذج المتاحة للمفتاح بتاعك هي:")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                # طباعة اسم النموذج اللي المفروض تستخدمه
                print(f"- {m.name.replace('models/', '')}")
    except Exception as e:
        print(f"\n❌ حدث خطأ أثناء الاتصال: {e}")
