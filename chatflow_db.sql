CREATE DATABASE IF NOT EXISTS chatflow_db;
CREATE DATABASE chatflow_db;
USE chatflow_db;

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    sender ENUM('self', 'other') NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    chat_id INT DEFAULT 1
);
INSERT INTO messages (content, sender) VALUES 
('Hey there! How''s it going?', 'other'),
('Pretty good! Just working on some code.', 'self'),
('That''s awesome! What are you building?', 'other'),
('A chat UI like WhatsApp using HTML, CSS, and JS!', 'self');