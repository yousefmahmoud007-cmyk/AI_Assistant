import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from db import (
    get_session, KnowledgeBank, Unit, Lesson, LessonPart, Personality,
    Exam, ExamQuestion
)

admin_router = APIRouter(prefix="/admin", tags=["Admin Panel"])

# ==========================================
# 1. قوالب البيانات (Pydantic Models)
# ==========================================
class LoginRequest(BaseModel):
    username: str
    password: str

class PartCreate(BaseModel):
    id: Optional[int] = None
    title: str
    lesson_content: str
    example: Optional[str] = ""
    question: Optional[str] = ""

class LessonCreateBulk(BaseModel):
    id: Optional[int] = None
    title: str
    parts: List[PartCreate] = []

# [جديد] قوالب أسئلة الامتحان ونموذج الإجابة
class ExamQuestionCreate(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = None
    question_text: str
    model_answer: str
    max_score: Optional[int] = 1

class ExamCreateBulk(BaseModel):
    id: Optional[int] = None
    title: str
    questions: List[ExamQuestionCreate] = []

class UnitCreateBulk(BaseModel):
    id: Optional[int] = None
    title: str
    lessons: List[LessonCreateBulk] = []
    exams: Optional[List[ExamCreateBulk]] = []  # دعم الامتحانات داخل الوحدة

class ModelSettingsCreate(BaseModel):
    name: str
    description: str
    image_base64: Optional[str] = None

class BulkUploadRequest(BaseModel):
    bank_id: Optional[int] = None
    model_settings: ModelSettingsCreate
    knowledge_bank_title: str
    units: List[UnitCreateBulk]

# ==========================================
# 2. مسار تسجيل الدخول
# ==========================================
@admin_router.post("/login")
async def login(request: LoginRequest, session: AsyncSession = Depends(get_session)):
    try:
        kb_id = int(request.username)
    except ValueError:
        raise HTTPException(status_code=401, detail="ID غير صحيح")

    stmt = select(KnowledgeBank).where(
        KnowledgeBank.id == kb_id,
        KnowledgeBank.password == request.password
    )
    result = await session.execute(stmt)
    bank = result.scalars().first()

    if not bank:
        raise HTTPException(status_code=401, detail="ID أو كلمة المرور غير صحيحة")

    return {"message": "تم تسجيل الدخول بنجاح", "id": bank.id}

# ==========================================
# 3. مسار رفع المنهج والامتحانات (Bulk Upload)
# ==========================================
@admin_router.post("/bulk-upload/")
async def upload_full_subject(payload: BulkUploadRequest, session: AsyncSession = Depends(get_session)):
    try:
        existing_bank = None
        if payload.bank_id:
            bank_stmt = select(KnowledgeBank).options(
                selectinload(KnowledgeBank.units).selectinload(Unit.lessons).selectinload(Lesson.lesson_parts),
                selectinload(KnowledgeBank.units).selectinload(Unit.exams).selectinload(Exam.questions),
                selectinload(KnowledgeBank.personalities)
            ).where(KnowledgeBank.id == payload.bank_id)
            result = await session.execute(bank_stmt)
            existing_bank = result.scalars().first()

        if existing_bank:
            existing_bank.title = payload.knowledge_bank_title

            # --- تحديث الشخصية ---
            if existing_bank.personalities:
                p = existing_bank.personalities[0]
                p.name = payload.model_settings.name
                p.description = payload.model_settings.description
                if payload.model_settings.image_base64:
                    p.image_base64 = payload.model_settings.image_base64
            else:
                new_p = Personality(
                    name=payload.model_settings.name,
                    description=payload.model_settings.description,
                    image_base64=payload.model_settings.image_base64,
                    knowledge_bank_id=existing_bank.id
                )
                session.add(new_p)

            # --- مزامنة الوحدات ---
            incoming_unit_ids = [u.id for u in payload.units if u.id]
            for old_unit in list(existing_bank.units):
                if old_unit.id not in incoming_unit_ids:
                    await session.delete(old_unit)

            for unit_data in payload.units:
                if unit_data.id:
                    current_unit = next((u for u in existing_bank.units if u.id == unit_data.id), None)
                    if current_unit:
                        current_unit.title = unit_data.title
                        await session.flush()

                        # 1. تحديث الدروس والأجزاء
                        incoming_lesson_ids = [l.id for l in unit_data.lessons if l.id]
                        for old_lesson in list(current_unit.lessons):
                            if old_lesson.id not in incoming_lesson_ids:
                                await session.delete(old_lesson)

                        for lesson_data in unit_data.lessons:
                            if lesson_data.id:
                                current_lesson = next((l for l in current_unit.lessons if l.id == lesson_data.id), None)
                                if current_lesson:
                                    current_lesson.title = lesson_data.title
                                    await session.flush()

                                    incoming_part_ids = [p.id for p in lesson_data.parts if p.id]
                                    for old_part in list(current_lesson.lesson_parts):
                                        if old_part.id not in incoming_part_ids:
                                            await session.delete(old_part)

                                    for part_data in lesson_data.parts:
                                        if part_data.id:
                                            current_part = next((p for p in current_lesson.lesson_parts if p.id == part_data.id), None)
                                            if current_part:
                                                current_part.title = part_data.title
                                                current_part.lesson_content = part_data.lesson_content
                                                current_part.example = part_data.example
                                                current_part.question = part_data.question
                                        else:
                                            new_part = LessonPart(
                                                title=part_data.title,
                                                lesson_content=part_data.lesson_content,
                                                example=part_data.example,
                                                question=part_data.question,
                                                lesson_id=current_lesson.id
                                            )
                                            session.add(new_part)
                            else:
                                new_lesson = Lesson(title=lesson_data.title, unit_id=current_unit.id)
                                session.add(new_lesson)
                                await session.flush()
                                for part_data in lesson_data.parts:
                                    new_part = LessonPart(
                                        title=part_data.title,
                                        lesson_content=part_data.lesson_content,
                                        example=part_data.example,
                                        question=part_data.question,
                                        lesson_id=new_lesson.id
                                    )
                                    session.add(new_part)

                        # 2. تحديث الامتحانات ونماذج الإجابة
                        incoming_exam_ids = [e.id for e in (unit_data.exams or []) if e.id]
                        for old_exam in list(current_unit.exams):
                            if old_exam.id not in incoming_exam_ids:
                                await session.delete(old_exam)

                        for exam_data in (unit_data.exams or []):
                            if exam_data.id:
                                current_exam = next((e for e in current_unit.exams if e.id == exam_data.id), None)
                                if current_exam:
                                    current_exam.title = exam_data.title
                                    await session.flush()

                                    incoming_q_ids = [q.id for q in exam_data.questions if q.id]
                                    for old_q in list(current_exam.questions):
                                        if old_q.id not in incoming_q_ids:
                                            await session.delete(old_q)

                                    for q_data in exam_data.questions:
                                        if q_data.id:
                                            current_q = next((q for q in current_exam.questions if q.id == q_data.id), None)
                                            if current_q:
                                                current_q.title = q_data.title
                                                current_q.question_text = q_data.question_text
                                                current_q.model_answer = q_data.model_answer
                                                current_q.max_score = q_data.max_score or 1
                                        else:
                                            new_q = ExamQuestion(
                                                title=q_data.title,
                                                question_text=q_data.question_text,
                                                model_answer=q_data.model_answer,
                                                max_score=q_data.max_score or 1,
                                                exam_id=current_exam.id
                                            )
                                            session.add(new_q)
                            else:
                                new_exam = Exam(title=exam_data.title, unit_id=current_unit.id)
                                session.add(new_exam)
                                await session.flush()
                                for q_data in exam_data.questions:
                                    new_q = ExamQuestion(
                                        title=q_data.title,
                                        question_text=q_data.question_text,
                                        model_answer=q_data.model_answer,
                                        max_score=q_data.max_score or 1,
                                        exam_id=new_exam.id
                                    )
                                    session.add(new_q)
                else:
                    new_unit = Unit(title=unit_data.title, knowledge_bank_id=existing_bank.id)
                    session.add(new_unit)
                    await session.flush()

                    for lesson_data in unit_data.lessons:
                        new_lesson = Lesson(title=lesson_data.title, unit_id=new_unit.id)
                        session.add(new_lesson)
                        await session.flush()
                        for part_data in lesson_data.parts:
                            new_part = LessonPart(
                                title=part_data.title,
                                lesson_content=part_data.lesson_content,
                                example=part_data.example,
                                question=part_data.question,
                                lesson_id=new_lesson.id
                            )
                            session.add(new_part)

                    for exam_data in (unit_data.exams or []):
                        new_exam = Exam(title=exam_data.title, unit_id=new_unit.id)
                        session.add(new_exam)
                        await session.flush()
                        for q_data in exam_data.questions:
                            new_q = ExamQuestion(
                                title=q_data.title,
                                question_text=q_data.question_text,
                                model_answer=q_data.model_answer,
                                max_score=q_data.max_score or 1,
                                exam_id=new_exam.id
                            )
                            session.add(new_q)

            await session.commit()
            return {"message": "تم حفظ وتحديث المادة والامتحانات بنجاح!", "bank_id": existing_bank.id}

        else:
            # إنشاء بنك معرفة جديد بالكامل
            random_pass = str(uuid.uuid4())[:8]
            new_bank = KnowledgeBank(title=payload.knowledge_bank_title, password=random_pass)
            session.add(new_bank)
            await session.flush()

            new_personality = Personality(
                name=payload.model_settings.name,
                description=payload.model_settings.description,
                image_base64=payload.model_settings.image_base64,
                knowledge_bank_id=new_bank.id
            )
            session.add(new_personality)

            for unit_data in payload.units:
                new_unit = Unit(title=unit_data.title, knowledge_bank_id=new_bank.id)
                session.add(new_unit)
                await session.flush()

                for lesson_data in unit_data.lessons:
                    new_lesson = Lesson(title=lesson_data.title, unit_id=new_unit.id)
                    session.add(new_lesson)
                    await session.flush()
                    for part_data in lesson_data.parts:
                        new_part = LessonPart(
                            title=part_data.title,
                            lesson_content=part_data.lesson_content,
                            example=part_data.example,
                            question=part_data.question,
                            lesson_id=new_lesson.id
                        )
                        session.add(new_part)

                for exam_data in (unit_data.exams or []):
                    new_exam = Exam(title=exam_data.title, unit_id=new_unit.id)
                    session.add(new_exam)
                    await session.flush()
                    for q_data in exam_data.questions:
                        new_q = ExamQuestion(
                            title=q_data.title,
                            question_text=q_data.question_text,
                            model_answer=q_data.model_answer,
                            max_score=q_data.max_score or 1,
                            exam_id=new_exam.id
                        )
                        session.add(new_q)

            await session.commit()
            return {"message": "تم إنشاء وحفظ المادة والامتحانات بنجاح!", "bank_id": new_bank.id, "generated_password": random_pass}

    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"حدث خطأ أثناء حفظ البيانات: {str(e)}")

# ==========================================
# 4. مسار جلب المنهج والامتحانات
# ==========================================
@admin_router.get("/knowledge-bank/{kb_id}")
async def get_full_knowledge_bank(kb_id: int, session: AsyncSession = Depends(get_session)):
    try:
        bank_stmt = select(KnowledgeBank).options(
            selectinload(KnowledgeBank.units).selectinload(Unit.lessons).selectinload(Lesson.lesson_parts),
            selectinload(KnowledgeBank.units).selectinload(Unit.exams).selectinload(Exam.questions),
            selectinload(KnowledgeBank.personalities)
        ).where(KnowledgeBank.id == kb_id)

        bank_result = await session.execute(bank_stmt)
        knowledge_bank = bank_result.scalars().first()

        if not knowledge_bank:
            return {"message": "لا توجد بيانات محفوظة بعد"}

        personality = knowledge_bank.personalities[0] if knowledge_bank.personalities else None
        response_data = {
            "id": knowledge_bank.id,
            "knowledge_bank_title": knowledge_bank.title,
            "model_settings": {
                "name": personality.name if personality else "المعلم الذكي",
                "description": personality.description if personality else "",
                "image_base64": personality.image_base64 if personality else None
            },
            "units": []
        }

        for unit in knowledge_bank.units:
            unit_data = {
                "id": unit.id,
                "title": unit.title,
                "lessons": [],
                "exams": []
            }

            # جلب الدروس
            for lesson in unit.lessons:
                lesson_data = {
                    "id": lesson.id,
                    "title": lesson.title,
                    "parts": []
                }
                for part in lesson.lesson_parts:
                    lesson_data["parts"].append({
                        "id": part.id,
                        "title": part.title,
                        "lesson_content": part.lesson_content,
                        "example": part.example,
                        "question": part.question
                    })
                unit_data["lessons"].append(lesson_data)

            # جلب الامتحانات مع نموذج الإجابة
            for exam in unit.exams:
                exam_data = {
                    "id": exam.id,
                    "title": exam.title,
                    "questions": []
                }
                for q in exam.questions:
                    exam_data["questions"].append({
                        "id": q.id,
                        "title": q.title,
                        "question_text": q.question_text,
                        "model_answer": q.model_answer,
                        "max_score": q.max_score
                    })
                unit_data["exams"].append(exam_data)

            response_data["units"].append(unit_data)

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"حدث خطأ أثناء استرجاع البيانات: {str(e)}")
