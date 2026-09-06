import os
import sys
import base64
import asyncio
import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import Optional

# حل مشكلة المسارات
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

# استدعاء الجداول المطلوبة من db.py
from db import get_session, Personality, Lesson, LessonPart, StudentHistory, Student, KnowledgeBank, Unit
from dotenv import load_dotenv

load_dotenv()
ai_router = APIRouter(prefix="/ai", tags=["AI Integration"])

# إعداد المكتبة
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ==========================================
# Pydantic Models
# ==========================================
class UserRequest(BaseModel):
    prompt: str
    lesson_id: Optional[int] = None
    student_id: str
    image: Optional[str] = None

class StudentSignupRequest(BaseModel):
    username: str
    phone_number: str
    password: str
    knowledge_bank_id: Optional[int] = None

class StudentLoginRequest(BaseModel):
    phone_number: str
    password: str
    knowledge_bank_id: Optional[int] = None

# ==========================================
# Routes (تسجيل الدخول والإنشاء)
# ==========================================
@ai_router.post("/signup")
async def student_signup(request: StudentSignupRequest, session: AsyncSession = Depends(get_session)):
    try:
        stmt_check = select(Student).where(Student.student_id == request.phone_number)
        res_check = await session.execute(stmt_check)
        if res_check.scalars().first():
            raise HTTPException(status_code=400, detail="رقم الهاتف مسجل مسبقاً")

        new_student = Student(
            student_id=request.phone_number,
            username=request.username,
            password=request.password 
        )

        if request.knowledge_bank_id:
            stmt_kb = select(KnowledgeBank).where(KnowledgeBank.id == request.knowledge_bank_id)
            res_kb = await session.execute(stmt_kb)
            kb = res_kb.scalars().first()
            
            if not kb:
                raise HTTPException(status_code=404, detail="كود المدرس (ID) غير صحيح")
            
            new_student.knowledge_banks.append(kb)

        session.add(new_student)
        await session.commit()
        return {"message": "تم إنشاء الحساب بنجاح"}
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@ai_router.post("/login")
async def student_login(request: StudentLoginRequest, session: AsyncSession = Depends(get_session)):
    try:
        stmt = select(Student).options(selectinload(Student.knowledge_banks)).where(
            Student.student_id == request.phone_number,
            Student.password == request.password
        )
        result = await session.execute(stmt)
        student = result.scalars().first()

        if not student:
            raise HTTPException(status_code=401, detail="رقم الهاتف أو كلمة المرور غير صحيحة")

        if request.knowledge_bank_id:
            stmt_kb = select(KnowledgeBank).where(KnowledgeBank.id == request.knowledge_bank_id)
            res_kb = await session.execute(stmt_kb)
            kb = res_kb.scalars().first()

            if not kb:
                raise HTTPException(status_code=404, detail="كود المدرس غير صحيح")

            if not any(b.id == kb.id for b in student.knowledge_banks):
                student.knowledge_banks.append(kb)
                await session.commit()

        return {
            "message": "تم تسجيل الدخول بنجاح",
            "student_id": student.student_id,
            "username": student.username
        }
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# Routes (الشات والمساعد الذكي)
# ==========================================
@ai_router.get("/personality/{kb_id}")
async def get_personality(kb_id: int, session: AsyncSession = Depends(get_session)):
    try:
        stmt = select(Personality).where(Personality.knowledge_bank_id == kb_id)
        result = await session.execute(stmt)
        personality = result.scalars().first()
        if personality:
            return {
                "name": personality.name,
                "description": personality.description,
                "image_base64": personality.image_base64
            }
        return {"name": "المعلم الذكي", "description": "", "image_base64": None}
    except Exception as e:
        print(f"Error:{str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal Server Error: {str(e)}")

@ai_router.get("/history/sidebar/{student_id}")
async def get_sidebar_history(student_id: str, session: AsyncSession = Depends(get_session)):
    try:
        stmt = select(Lesson).join(StudentHistory).where(StudentHistory.student_id == student_id).distinct()
        result = await session.execute(stmt)
        lessons = result.scalars().all()
        history_list = []
        for lesson in lessons:
            history_list.append({
                "lesson_id": lesson.id,
                "title": f"محادثة: {lesson.title}"
            })
        return {"history": history_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@ai_router.get("/history/chat/{student_id}/{lesson_id}")
async def get_chat_history(student_id: str, lesson_id: int, session: AsyncSession = Depends(get_session)):
    try:
        stmt = select(StudentHistory).where(
            StudentHistory.lesson_id == lesson_id,
            StudentHistory.student_id == student_id
        ).order_by(StudentHistory.id)
        result = await session.execute(stmt)
        messages = result.scalars().all()
        chat_data = []
        for msg in messages:
            chat_data.append({
                "sender": msg.sender,
                "message": msg.message,
                "image_base64": msg.image_base64
            })
        return {"messages": chat_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@ai_router.post("/ask-ai/")
async def ask_ai(request: UserRequest, session: AsyncSession = Depends(get_session)):
    try:
        base_instruction = ""
        admin_instruction = ""

        # 1. جلب التعليمات والشخصية بالكامل من قاعدة البيانات
        if request.lesson_id:
            stmt_bank = select(KnowledgeBank).join(Unit).join(Lesson).where(Lesson.id == request.lesson_id)
            result_bank = await session.execute(stmt_bank)
            bank = result_bank.scalars().first()

            if bank:
                if bank.instructions:
                    base_instruction = bank.instructions

                stmt_pers = select(Personality).where(Personality.knowledge_bank_id == bank.id)
                result_pers = await session.execute(stmt_pers)
                personality = result_pers.scalars().first()

                if personality:
                    name_part = f"اسمك هو '{personality.name}'." if personality.name else ""
                    desc_part = personality.description if personality.description else ""
                    admin_instruction = f"{name_part} {desc_part}".strip()

        final_system_instruction = f"{base_instruction}\n{admin_instruction}".strip()

        # 2. جلب محتوى الدرس وتنظيمه كمرجع مباشر دون جمل تضعف اعتماده
        context = ""
        if request.lesson_id:
            stmt = select(LessonPart).where(LessonPart.lesson_id == request.lesson_id)
            result_parts = await session.execute(stmt)
            parts = result_parts.scalars().all()

            if parts:
                context_parts = ["=== محتوى الدرس المعتمد ==="]
                for part in parts:
                    part_text = f"\n- {part.title}:\n{part.lesson_content}"
                    if part.example:
                        part_text += f"\nأمثلة: {part.example}"
                    context_parts.append(part_text)
                context_parts.append("\n========================\n\n")
                context = "\n".join(context_parts)

        # 3. بناء الـ Prompt
        full_prompt = f"{context}سؤال الطالب: {request.prompt}".strip()
        contents = [full_prompt]

        # 4. معالجة الصورة إن وُجدت
        if request.image:
            image_data_str = request.image.split(",")[1] if "," in request.image else request.image
            image_bytes = base64.b64decode(image_data_str)
            mime_type = "image/jpeg" if ("jpeg" in request.image or "jpg" in request.image) else "image/png"
            contents.append({"mime_type": mime_type, "data": image_bytes})

        # 5. استدعاء النموذج مع التبديل التلقائي عند الخطأ أو الضغط
        models_to_try = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
        response_text = None

        for model_name in models_to_try:
            try:
                custom_model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=final_system_instruction if final_system_instruction else None
                )
                response = await asyncio.wait_for(
                    custom_model.generate_content_async(contents),
                    timeout=40.0
                )
                response_text = response.text
                break
            except asyncio.TimeoutError:
                print(f"الموديل {model_name} أخذ وقتاً طويلاً (Timeout)، جاري تجربة التالي...")
                continue
            except Exception as e:
                print(f"فشل الموديل {model_name} بسبب: {e}")
                continue

        if not response_text:
            return {"response": "معلش يا بطل، فيه ضغط على السيستم حالياً. ابعت سؤالك تاني كمان شوية."}

        # 6. حفظ المحادثة في قاعدة البيانات
        student_msg = StudentHistory(
            student_id=request.student_id,
            lesson_id=request.lesson_id,
            sender="student",
            message=request.prompt,
            image_base64=request.image
        )
        session.add(student_msg)

        ai_msg = StudentHistory(
            student_id=request.student_id,
            lesson_id=request.lesson_id,
            sender="ai",
            message=response_text
        )
        session.add(ai_msg)

        await session.commit()
        return {"response": response_text}

    except Exception as e:
        await session.rollback()
        print(f"Database/Server Error: {e}")
        return {"response": f"حدث خطأ غير متوقع: {str(e)}"}
