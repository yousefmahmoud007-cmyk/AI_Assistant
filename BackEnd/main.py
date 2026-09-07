import os
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# استدعاء المسارات (Routers) من مجلد routers
from routers.admin import admin_router
from routers.ai import ai_router
from routers.prompts import prompts_router

# 1. تحميل متغيرات البيئة
load_dotenv()

# 2. إنشاء التطبيق
app = FastAPI(title="منصة الذكاء الاصطناعي")

# 3. إعدادات الـ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. دمج الـ Routers
app.include_router(admin_router)
app.include_router(ai_router)
app.include_router(prompts_router)

# 5. مسار اختبار السيرفر
@app.get("/")
async def main():
    return {"message": "Hello World. API is running!"}

# 6. تشغيل السيرفر
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
