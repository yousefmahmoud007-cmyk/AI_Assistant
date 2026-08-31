import os
import sys
import base64
import asyncio
import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

# حل مشكلة المسارات
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

from db import get_session, Personality, Lesson, LessonPart, StudentHistory
from dotenv import load_dotenv

load_dotenv()

ai_router = APIRouter(prefix="/ai", tags=["AI Integration"])

# إعداد المكتبة المستقرة
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class UserRequest(BaseModel):
    prompt: str
    lesson_id: Optional[int] = None
    student_id: str  # تم تعديلها من int إلى str لتتطابق مع قاعدة البيانات
    image: Optional[str] = None


@ai_router.get("/personality/{kb_id}")
async def get_personality(kb_id: int, session: AsyncSession = Depends(get_session)):
    try:
        # البحث عن شخصية المدرس صاحب هذا الـ ID فقط
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Server Error: {str(e)}"
        )

@ai_router.get("/history/sidebar/{student_id}")
async def get_sidebar_history(student_id: str, session: AsyncSession = Depends(get_session)):  # تم تعديل student_id إلى str
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
async def get_chat_history(student_id: str, lesson_id: int, session: AsyncSession = Depends(get_session)):  # تم تعديل student_id إلى str
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
                # ==========================================
        # 1. إعداد التعليمات (النظام + الآدمن)
        # ==========================================
        base_instruction = (
            "لو طالب قال مفهمش اشرح السؤال أو الجزء اللي مفهمهوش بس مش الدرس كله. "
            "نوع في الأسلوب بس متخرجش عن الأساس. "
            "أنت معلم ذكي ومحترف لطلاب الثانوية العامة. "
            "يجب عليك دائماً تقديم إجابات دقيقة ومبسطة تتناسب مع عقلية الطالب. "
            "ممنوع منعاً باتاً أن تذكر أنك نموذج ذكاء اصطناعي من جوجل أو أنك برنامج. "
            "تعليمات صارمة جداً بخصوص الرياضيات: "
            "1. ممنوع تماماً استخدام أكواد LaTeX الرياضية أو علامات ($) أو (\\) أو الكسور المعقدة. "
            "2. اكتب جميع المعادلات الرياضية والكسور كنص عربي عادي (Plain Text) في سطر واحد. "
            "3. استخدم الرموز العربية فقط (س، ص، جا، جتا، ظا، قا، نها، تكامل). "
            "4. تحذير هام بخصوص الكسور: ممنوع استخدام علامة المائل (/) لأنها تظهر معكوسة للطلاب. "
            "استخدم دائماً كلمة (على) أو علامة (÷) للتعبير عن الكسور والقسمة. "
            "مثال صحيح للكسور: (1 على أ) قا(أ س) أو (1 ÷ أ) قا(أ س). "
            "مثال صحيح للتكامل: تكامل (3س) دس = (3 على 2) س^2 + ث "
            "مثال صحيح للدوال: نها (جا س على س) لما س تؤول لصفر = 1 "
        )
        
        admin_instruction = ""
        
        # معرفة الطالب تبع أي مدرس (بنك معرفة)
        stmt_student = select(Student).where(Student.student_id == request.student_id)
        result_student = await session.execute(stmt_student)
        student = result_student.scalars().first()

        if student and student.knowledge_bank_id:
            # جلب شخصية المدرس الخاص بهذا الطالب
            stmt_pers = select(Personality).where(Personality.knowledge_bank_id == student.knowledge_bank_id)
            result_pers = await session.execute(stmt_pers)
            personality = result_pers.scalars().first()
            
            if personality:
                name_part = f"اسمك هو '{personality.name}'." if personality.name else ""
                desc_part = personality.description if personality.description else ""
                admin_instruction = f"{name_part} {desc_part}"
            
        final_system_instruction = f"{base_instruction}\n{admin_instruction}"

        # ==========================================
        # 2. جلب السياق (محتوى الدرس)
        # ==========================================
        context = ""
        if request.lesson_id:
            stmt = select(LessonPart).where(LessonPart.lesson_id == request.lesson_id)
            result_parts = await session.execute(stmt)
            parts = result_parts.scalars().all()
            if parts:
                context = "إليك محتوى الدرس (استخدمه للإجابة إن لزم الأمر):\n\n"
                for part in parts:
                    context += f"- {part.title}:\n{part.lesson_content}\n"
                    if part.example:
                        context += f"أمثلة: {part.example}\n"

        # ==========================================
        # 3. دمج السياق ومعالجة الصورة (تجهيز الطلب)
        # ==========================================
        full_prompt = f"{context}\n\nسؤال الطالب: {request.prompt}"
        contents = [full_prompt]

        if request.image:
            image_data_str = request.image.split(",")[1] if "," in request.image else request.image
            image_bytes = base64.b64decode(image_data_str)
            mime_type = "image/jpeg" if "jpeg" in request.image or "jpg" in request.image else "image/png"
            contents.append({"mime_type": mime_type, "data": image_bytes})

        # ==========================================
        # 4. الـ Model Fallbacks (التنفيذ بشكل Async مع توقيت)
        # ==========================================
        models_to_try = [
            'gemini-1.5-flash',
            'gemini-1.5-pro',
        ]
        
        response_text = None
        for model_name in models_to_try:
            try:
                custom_model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=final_system_instruction
                )
                response = await asyncio.wait_for(
                    custom_model.generate_content_async(contents),
                    timeout=40.0
                )
                response_text = response.text
                break
            except asyncio.TimeoutError:
                print(f"الموديل {model_name} أخذ وقت طويل (Timeout)، نجرب التالي...")
                continue
            except Exception as e:
                print(f"فشل الموديل {model_name} بسبب: {e}")
                continue

        if not response_text:
            return {"response": "معلش يا بطل فيه ضغط على السيستم حالياً، ابعت سؤالك تاني كمان شوية"}

        # ==========================================
        # 5. حفظ المحادثة في قاعدة البيانات
        # ==========================================
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
