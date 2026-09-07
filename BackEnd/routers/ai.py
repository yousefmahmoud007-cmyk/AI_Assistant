import json
import os
import sys
import base64
import asyncio
from typing import Optional

from routers.prompts import build_grading_prompt
import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from dotenv import load_dotenv

# حل مشكلة المسارات
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

# استدعاء الجداول المطلوبة من db.py (متضمنة جداول الامتحانات والدرجات الجديدة)
from db import (
    get_session, Personality, Lesson, LessonPart, StudentHistory, 
    Student, KnowledgeBank, Unit, Exam, ExamQuestion, StudentGrade,
)

load_dotenv()
ai_router = APIRouter(prefix="/ai", tags=["AI Integration"])

# إعداد مكتبة الذكاء الاصطناعي
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# ==========================================
# Pydantic Models
# ==========================================
class UserRequest(BaseModel):
    prompt: str
    image: Optional[str] = None
    lesson_id: Optional[int] = None
    knowledge_bank_id: int 
    student_id: str

class UpdateGradeRequest(BaseModel):
    grade_id: int
    final_score: int
    status: Optional[str] = "تم التعديل يدوياً"

class StudentSignupRequest(BaseModel):
    username: str
    phone_number: str
    password: str
    knowledge_bank_id: Optional[int] = None

class StudentLoginRequest(BaseModel):
    phone_number: str
    password: str
    knowledge_bank_id: Optional[int] = None

class StudentAnswerSchema(BaseModel):
    kb_id: int # كود السؤال من جدول ExamQuestion
    student_id: str # كود الطالب
    student_answer: str # الإجابة اللي الطالب كتبها

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
        stmt = (
            select(Student)
            .options(selectinload(Student.knowledge_banks))
            .where(
                Student.student_id == request.phone_number,
                Student.password == request.password
            )
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
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@ai_router.get("/history/sidebar/{student_id}/{kb_id}")
async def get_sidebar_history(student_id: str, kb_id: int, session: AsyncSession = Depends(get_session)):
    try:
        stmt = (
            select(Lesson)
            .join(StudentHistory, StudentHistory.lesson_id == Lesson.id)
            .join(Unit, Lesson.unit_id == Unit.id)
            .where(
                StudentHistory.student_id == student_id,
                Unit.knowledge_bank_id == kb_id
            )
            .distinct()
        )
        result = await session.execute(stmt)
        lessons = result.scalars().all()
        history_list = [
            {"lesson_id": lesson.id, "title": f"محادثة: {lesson.title}"}
            for lesson in lessons
        ]
        return {"history": history_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@ai_router.get("/history/chat/{student_id}/{lesson_id}")
async def get_chat_history(student_id: str, lesson_id: int, session: AsyncSession = Depends(get_session)):
    try:
        stmt = (
            select(StudentHistory)
            .where(
                StudentHistory.lesson_id == lesson_id,
                StudentHistory.student_id == student_id
            )
            .order_by(StudentHistory.id)
        )
        result = await session.execute(stmt)
        messages = result.scalars().all()
        chat_data = [
            {
                "sender": msg.sender,
                "message": msg.message,
                "image_base64": msg.image_base64
            }
            for msg in messages
        ]
        return {"messages": chat_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@ai_router.post("/ask-ai/")
async def ask_ai(request: UserRequest, session: AsyncSession = Depends(get_session)):
    try:
        base_instruction = ""
        admin_instruction = ""
        
        stmt_bank = select(KnowledgeBank).where(KnowledgeBank.id == request.knowledge_bank_id)
        result_bank = await session.execute(stmt_bank)
        bank = result_bank.scalars().first()
        
        if not bank:
            return {"response": "خطأ: مادة غير صالحة أو غير مسجلة."}
            
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
        context = ""
        
        if request.lesson_id:
            stmt = (
                select(LessonPart)
                .join(Lesson, LessonPart.lesson_id == Lesson.id)
                .join(Unit, Lesson.unit_id == Unit.id)
                .where(
                    LessonPart.lesson_id == request.lesson_id,
                    Unit.knowledge_bank_id == request.knowledge_bank_id
                )
            )
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
                
        full_prompt = f"{context}سؤال الطالب: {request.prompt}".strip()
        contents = [full_prompt]
        
        if request.image:
            image_data_str = request.image.split(",")[1] if "," in request.image else request.image
            image_bytes = base64.b64decode(image_data_str)
            mime_type = "image/jpeg" if ("jpeg" in request.image or "jpg" in request.image) else "image/png"
            contents.append({"mime_type": mime_type, "data": image_bytes})
            
        # استخدام الإصدارات المطلوبة بالترتيب
        models_to_try = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'] 
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
            except Exception as e:
                print(f"فشل الموديل {model_name}: {e}")
                continue
                
        if not response_text:
            return {"response": "معلش يا بطل، فيه ضغط على السيستم حالياً. ابعت سؤالك تاني كمان شوية."}
            
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

# ==========================================
# Routes (نظام تصحيح الامتحانات)
# ==========================================
@ai_router.post("/quiz-answer")
async def grade_student_answer(
    request: StudentAnswerSchema, 
    session: AsyncSession = Depends(get_session)
): 
    try: 
        # 1. الاستعلام من جدول الأسئلة الخاص بالامتحانات
        stmt_q = select(ExamQuestion).where(ExamQuestion.id == request.kb_id) 
        res_q = await session.execute(stmt_q) 
        question_record = res_q.scalar_one_or_none()
        
        if not question_record:
            return {"status": "error", "message": "السؤال غير موجود"}

        # 2. الاستعلام عن الطالب لجلب الـ ID الداخلي الخاص به
        stmt_student = select(Student).where(Student.student_id == request.student_id)
        res_student = await session.execute(stmt_student)
        student_record = res_student.scalar_one_or_none()

        if not student_record:
             return {"status": "error", "message": "بيانات الطالب غير صحيحة"}

        # 3. تجهيز الـ Prompt للذكاء الاصطناعي
        prompt = build_grading_prompt( 
            question_text=question_record.question_text, 
            model_answer=question_record.model_answer, 
            student_answer=request.student_answer, 
            max_score=question_record.max_score
        ) 
        
        # 4. إرسال الطلب لـ Gemini باستخدام أحدث موديل تم تحديده
        model = genai.GenerativeModel('gemini-3.7-flash')
        response = await model.generate_content_async(prompt)
        ai_response = response.text
        
        # 5. تنظيف الرد المستلم
        cleaned_response = ai_response.replace("```json", "").replace("```", "").strip() 
        grading_result = json.loads(cleaned_response) 
        
        # 6. حفظ الدرجة في الداتا بيز عشان الأدمن يقدر يشوفها
        new_grade = StudentGrade(
            student_id=student_record.id,
            exam_question_id=question_record.id,
            student_answer=request.student_answer,
            ai_score=grading_result["score"],
            ai_feedback=grading_result["feedback"]
        )
        session.add(new_grade)
        await session.commit()

        # 7. إرسال النتيجة للفرونت إند
        return { 
            "status": "success", 
            "score": grading_result["score"], 
            "feedback": grading_result["feedback"] 
        } 

    except Exception as e: 
        await session.rollback() 
        print(f"Database/Server Error: {e}") 
        return {"status": "error", "message": f"حدث خطأ غير متوقع: {str(e)}"}

@ai_router.get("/admin/exam-results/{exam_id}")
async def get_exam_results(
    exam_id: int, 
    session: AsyncSession = Depends(get_session)
):
    try:
        # الاستعلام: هنجيب الدرجات، ونربطها بجدول الأسئلة وجدول الطلاب
        stmt = (
            select(StudentGrade)
            .join(ExamQuestion, StudentGrade.exam_question_id == ExamQuestion.id)
            .join(Student, StudentGrade.student_id == Student.id)
            .where(ExamQuestion.exam_id == exam_id)
            .options(
                selectinload(StudentGrade.student),
                selectinload(StudentGrade.exam_question)
            )
        )
        
        result = await session.execute(stmt)
        grades = result.scalars().all()
        
        if not grades:
            return {
                "status": "success", 
                "message": "لا يوجد إجابات لهذا الامتحان حتى الآن", 
                "data": []
            }
        
        dashboard_data = []
        for grade in grades:
            dashboard_data.append({
                "grade_id": grade.id,
                "student_code": grade.student.student_id,    # كود الطالب 
                "question_text": grade.exam_question.question_text, 
                "model_answer": grade.exam_question.model_answer,   
                "student_answer": grade.student_answer,      
                "max_score": grade.exam_question.max_score,  
                "ai_score": grade.ai_score,                  
                "ai_feedback": grade.ai_feedback,            
                "final_score": grade.final_score if grade.final_score is not None else grade.ai_score,
                "status": grade.status
            })
            
        return {
            "status": "success", 
            "data": dashboard_data
        }
        
    except Exception as e:
        print(f"Database/Server Error: {e}")
        return {"status": "error", "message": f"حدث خطأ داخلي: {str(e)}"}
@ai_router.put("/admin/update-grade")
async def update_student_grade(
    request: UpdateGradeRequest, 
    session: AsyncSession = Depends(get_session)
):
    try:
        # 1. البحث عن سجل الدرجة المطلوب تعديله
        stmt = select(StudentGrade).where(StudentGrade.id == request.grade_id)
        result = await session.execute(stmt)
        grade_record = result.scalar_one_or_none()

        if not grade_record:
            return {"status": "error", "message": "سجل الدرجة غير موجود"}

        # 2. تحديث الدرجة النهائية وحالة الاعتماد
        grade_record.final_score = request.final_score
        grade_record.status = request.status

        # 3. حفظ التعديل في قاعدة البيانات
        await session.commit()
        await session.refresh(grade_record)

        return {
            "status": "success",
            "message": "تم تعديل الدرجة بنجاح",
            "grade_id": grade_record.id,
            "final_score": grade_record.final_score,
            "status": grade_record.status
        }

    except Exception as e:
        await session.rollback()
        print(f"Database/Server Error: {e}")
        return {"status": "error", "message": f"حدث خطأ داخلي: {str(e)}"}
