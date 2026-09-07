-- تنظيف أي جداول قديمة عشان نبدأ على نضافة --
DROP TABLE IF EXISTS student_knowledge_banks CASCADE;
DROP TABLE IF EXISTS Student_grades CASCADE;
DROP TABLE IF EXISTS Exam_questions CASCADE;
DROP TABLE IF EXISTS Exams CASCADE;
DROP TABLE IF EXISTS knowledge_banks CASCADE;
DROP TABLE IF EXISTS Units CASCADE;
DROP TABLE IF EXISTS Lessons CASCADE;
DROP TABLE IF EXISTS Lesson_parts CASCADE;
DROP TABLE IF EXISTS PERSONALITY CASCADE;
DROP TABLE IF EXISTS Students CASCADE;
DROP TABLE IF EXISTS Student_history CASCADE;

CREATE TABLE knowledge_banks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL UNIQUE,
    instructions TEXT
);

CREATE TABLE Units (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    knowledge_bank_id int,
    constraint fk_knowledge_bank foreign key(knowledge_bank_id) references knowledge_banks(id) on delete cascade
);

CREATE TABLE Lessons (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    unit_id int,
    constraint fk_unit foreign key(unit_id) references Units(id) on delete cascade
);

CREATE TABLE Lesson_parts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    lesson_content TEXT NOT NULL,
    question TEXT,
    example TEXT,
    lesson_id int,
    constraint fk_lesson foreign key(lesson_id) references Lessons(id) on delete cascade
);

-- ==========================================
-- الجداول الجديدة الخاصة بالامتحانات ونماذج الإجابة
-- ==========================================

-- 1. جدول الامتحانات (مربوط بالوحدة زي الدرس بالظبط)
CREATE TABLE Exams (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL, -- اسم الامتحان (مثال: امتحان الفصل الأول)
    unit_id INT,
    CONSTRAINT fk_exam_unit FOREIGN KEY(unit_id) REFERENCES Units(id) ON DELETE CASCADE
);

-- 2. جدول أسئلة الامتحان ونماذج الإجابة (مربوط بالامتحان زي أجزاء الدرس)
CREATE TABLE Exam_questions (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),          -- (اختياري) مثال: السؤال الأول
    question_text TEXT NOT NULL, -- نص السؤال
    model_answer TEXT NOT NULL,  -- نموذج الإجابة
    max_score INT DEFAULT 1,     -- الدرجة القصوى
    exam_id INT,
    CONSTRAINT fk_question_exam FOREIGN KEY(exam_id) REFERENCES Exams(id) ON DELETE CASCADE
);

CREATE TABLE PERSONALITY (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image_base64 TEXT,
    knowledge_bank_id int,
    CONSTRAINT fk_personality FOREIGN KEY (knowledge_bank_id) REFERENCES knowledge_banks(id) on delete cascade
);

CREATE TABLE Students (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    student_id VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

-- الجدول الوسيط الجديد للربط بين الطلاب وبنوك المعرفة (Many-to-Many)
CREATE TABLE student_knowledge_banks (
    student_id INT NOT NULL,
    knowledge_bank_id INT NOT NULL,
    PRIMARY KEY (student_id, knowledge_bank_id),
    CONSTRAINT fk_student_junction FOREIGN KEY (student_id) REFERENCES Students(id) on delete cascade,
    CONSTRAINT fk_bank_junction FOREIGN KEY (knowledge_bank_id) REFERENCES knowledge_banks(id) on delete cascade
);

-- ==========================================
-- جدول حفظ درجات وتصحيح الذكاء الاصطناعي للطلبة
-- ==========================================
CREATE TABLE Student_grades (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL, 
    exam_question_id INT NOT NULL, 
    student_answer TEXT NOT NULL, 
    ai_score FLOAT NOT NULL,        
    ai_feedback TEXT,             
    final_score FLOAT,              
    status VARCHAR(50) DEFAULT 'معتمد آلياً', 
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_grade_student FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
    CONSTRAINT fk_grade_exam_q FOREIGN KEY (exam_question_id) REFERENCES Exam_questions(id) ON DELETE CASCADE
);

CREATE TABLE Student_history (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(255),
    lesson_id INT,
    sender VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    image_base64 TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_student FOREIGN KEY (student_id) REFERENCES Students(student_id) on delete cascade,
    CONSTRAINT fk_chat_lesson FOREIGN KEY (lesson_id) REFERENCES Lessons(id) on delete cascade
);
