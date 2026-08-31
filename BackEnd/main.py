import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn

# استدعاء المسارات (Routers) من مجلد routers
from routers.admin import admin_router
from routers.ai import ai_router

# 1. تحميل المتغيرات من ملف .env
load_dotenv()

# 2. تجهيز تطبيق FastAPI
app = FastAPI(title="منصة الذكاء الاصطناعي")

# 3. إعدادات الـ CORS
# قمنا بإضافة رابط Vercel الخاص بك صراحةً لتجنب خطأ التعارض مع allow_credentials
# 3. إعدادات الـ CORS
origins = [
    "https://ai-assistant-iota-eight.vercel.app/assistant/index.html",
    "https://ai-assistant-iota-eight.vercel.app/admin/admin.html",
    "https://ai-assistant-iota-eight.vercel.app/management/login.html"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# 4. دمج المسارات (Routers) في التطبيق الأساسي
app.include_router(admin_router)
app.include_router(ai_router)

# مسار أساسي لاختبار عمل السيرفر
@app.get("/")
async def main():
    return {"message": "Hello World. API is running!"}

# 5. تشغيل السيرفر
if __name__ == "__main__":
    # الحصول على المنفذ (Port) من منصة Railway أو استخدام 8000 عند التشغيل المحلي
    port = int(os.environ.get("PORT", 8000))
    
    # تغيير الـ Host إلى 0.0.0.0 لكي يعمل على Railway بنجاح
    # تم إزالة reload=True لأنها غير مفضلة وتسبب مشاكل في بيئة الإنتاج (Production)
    uvicorn.run("main:app", host="0.0.0.0", port=port)
