import os
import asyncio
from collections.abc import AsyncGenerator
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.future import select
from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP, Table
from sqlalchemy.sql import func

# 1. تحميل المتغيرات وإعداد رابط الاتصال
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
        
    # --- الحل السحري الشامل لجميع إضافات Neon ---
    DATABASE_URL = DATABASE_URL.split("?")[0]

# 2. إنشاء المحرك ومدير الجلسات
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"ssl": True},
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10
)

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# 3. الفئة الأساسية
class Base(DeclarativeBase):
    pass

# =========================================================
# 4. النماذج (Models)
# =========================================================

# جدول الربط الوسيط بين الطلاب وبنوك المعرفة (Many-to-Many)
student_knowledge_bank_association = Table(
    "student_knowledge_banks",
    Base.metadata,
    Column("student_id", Integer, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True),
    Column("knowledge_bank_id", Integer, ForeignKey("knowledge_banks.id", ondelete="CASCADE"), primary_key=True)
)

class KnowledgeBank(Base):
    __tablename__ = "knowledge_banks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    password = Column(String(255), nullable=False, unique=True)
    instructions = Column(Text, nullable=True)

    units = relationship("Unit", back_populates="knowledge_bank", cascade="all, delete-orphan")
    personalities = relationship("Personality", back_populates="knowledge_bank", cascade="all, delete-orphan")
    # ربط بنك المعرفة بالطلاب من خلال الجدول الوسيط
    students = relationship("Student", secondary=student_knowledge_bank_association, back_populates="knowledge_banks")

class Unit(Base):
    __tablename__ = "units"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    knowledge_bank_id = Column(Integer, ForeignKey("knowledge_banks.id", ondelete="CASCADE"))
    
    knowledge_bank = relationship("KnowledgeBank", back_populates="units")
    lessons = relationship("Lesson", back_populates="unit", cascade="all, delete-orphan")

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id", ondelete="CASCADE"))
    
    unit = relationship("Unit", back_populates="lessons")
    lesson_parts = relationship("LessonPart", back_populates="lesson", cascade="all, delete-orphan")

class LessonPart(Base):
    __tablename__ = "lesson_parts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    lesson_content = Column(Text, nullable=False)
    question = Column(Text, nullable=True)
    example = Column(Text, nullable=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"))
    
    lesson = relationship("Lesson", back_populates="lesson_parts")

class Personality(Base):
    __tablename__ = "personality"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    image_base64 = Column(Text, nullable=True)
    knowledge_bank_id = Column(Integer, ForeignKey("knowledge_banks.id", ondelete="CASCADE"))
    
    knowledge_bank = relationship("KnowledgeBank", back_populates="personalities")

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(255), nullable=False)
    student_id = Column(String(255), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    
    # ربط الطالب ببنوك المعرفة من خلال الجدول الوسيط
    knowledge_banks = relationship("KnowledgeBank", secondary=student_knowledge_bank_association, back_populates="students")
    student_history = relationship("StudentHistory", back_populates="student", cascade="all, delete-orphan")

class StudentHistory(Base):
    __tablename__ = "student_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    # التأكد من مطابقة النوع تماماً ليكون String (VARCHAR) كما هو في قاعدة البيانات
    student_id = Column(String(255), ForeignKey("students.student_id", ondelete="CASCADE"), nullable=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"), nullable=True)
    sender = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    image_base64 = Column(Text, nullable=True)
    timestamp = Column(TIMESTAMP, server_default=func.now())
    
    student = relationship("Student", back_populates="student_history", foreign_keys=[student_id])
    lesson = relationship("Lesson")

# =========================================================
# 5. استخراج الجلسة (للاستخدام مع مسارات FastAPI)
# =========================================================
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

# =========================================================
# 6. اختبار الاتصال
# =========================================================
async def test_read_connection():
    async with async_session_maker() as session:
        try:
            result = await session.execute(select(KnowledgeBank))
            banks = result.scalars().all()
            print(f"تم الاتصال بنجاح! عدد بنوك المعرفة الحالية في القاعدة: {len(banks)}")
        except Exception as e:
            print(f"حدث خطأ في الاتصال أو قراءة الجداول: {e}")

if __name__ == "__main__":
    asyncio.run(test_read_connection())
