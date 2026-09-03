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
# 3. إعدادات الـ CORS
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app",  # بيسمح لأي رابط ينتهي بـ vercel.app
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
    # كده الكود هياخد البورت من Railway أوتوماتيك
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
