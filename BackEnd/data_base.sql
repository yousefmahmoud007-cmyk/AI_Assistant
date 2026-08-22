-- -- تنظيف أي جداول قديمة عشان نبدأ على نضافة
-- DROP TABLE IF EXISTS knowledge_banks CASCADE;
-- DROP TABLE IF EXISTS Units CASCADE;
-- DROP TABLE IF EXISTS Lessons CASCADE;
-- DROP TABLE IF EXISTS Lesson_parts CASCADE;
-- DROP TABLE IF EXISTS PERSONALITY CASCADE;
-- DROP TABLE IF EXISTS Students CASCADE;
-- DROP TABLE IF EXISTS Student_history CASCADE;
CREATE TABLE knowledge_banks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL
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
    question TEXT ,
    example TEXT ,
    lesson_id int,
    constraint fk_lesson foreign key(lesson_id) references Lessons(id) on delete cascade
);
CREATE TABLE PERSONALITY ( 
    id SERIAL PRIMARY KEY, 
    name VARCHAR(255) NOT NULL, 
    description TEXT NOT NULL, 
    image_base64 TEXT NOT NULL, 
    knowledge_bank_id int, 
    CONSTRAINT fk_personality FOREIGN KEY (knowledge_bank_id) REFERENCES knowledge_banks(id) on delete cascade
);
CREATE TABLE Students (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    knowledge_bank_id int,
    CONSTRAINT fk_student_knowledge_bank FOREIGN KEY (knowledge_bank_id) REFERENCES knowledge_banks(id) on delete cascade
);
CREATE TABLE Student_history ( 
    id SERIAL PRIMARY KEY,
    student_id INT, -- عشان نربط المحادثة بالطالب لما تفعل تسجيل الدخول
    lesson_id INT,  -- عشان نعرف المحادثة دي كانت في أي درس
    sender VARCHAR(50) NOT NULL, -- قيمته هتكون 'student' أو 'ai'
    message TEXT NOT NULL,
    image_base64 TEXT, -- لحفظ الصورة لو الطالب رفع واحدة
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_student FOREIGN KEY (student_id) REFERENCES Students(id) on delete cascade, 
    CONSTRAINT fk_chat_lesson FOREIGN KEY (lesson_id) REFERENCES Lessons(id) on delete cascade
);