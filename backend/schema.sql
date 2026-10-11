CREATE DATABASE IF NOT EXISTS hyundai_rdv_clean
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hyundai_rdv_clean;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL DEFAULT 'KEYCLOAK_USER',
  role ENUM('client', 'admin') NOT NULL DEFAULT 'client',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  car_model VARCHAR(150) NOT NULL,
  service_type VARCHAR(150) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  plate_number VARCHAR(80) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_appointments_user_id (user_id),
  INDEX idx_appointments_status (status),
  CONSTRAINT fk_appointments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user_id (user_id),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_email_code (email, code),
  INDEX idx_otp_expires_at (expires_at)
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
  currency VARCHAR(8) NOT NULL DEFAULT 'TND',
  method ENUM('card', 'mobile', 'cash') NOT NULL DEFAULT 'cash',
  status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
  transaction_ref VARCHAR(80) NOT NULL UNIQUE,
  card_last4 VARCHAR(4) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_appointment_id (appointment_id),
  INDEX idx_payments_user_id (user_id),
  CONSTRAINT fk_payments_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  price VARCHAR(80) NOT NULL DEFAULT 'Sur devis',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  day VARCHAR(20) NOT NULL,
  time TIME NOT NULL,
  status ENUM('available', 'busy', 'closed') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_slot_day_time (day, time)
);

INSERT IGNORE INTO services (name, price, active) VALUES
  ('Entretien general', '85 - 150 TND', 1),
  ('Changement pneus', '60 - 120 TND', 1),
  ('Diagnostic electronique', '50 TND', 1),
  ('Revision complete', '200 - 350 TND', 1),
  ('Carrosserie / Peinture', 'Sur devis', 0);

INSERT IGNORE INTO slots (day, time, status) VALUES
  ('Lundi', '08:00:00', 'available'),
  ('Lundi', '09:00:00', 'available'),
  ('Mardi', '10:00:00', 'available'),
  ('Mercredi', '14:00:00', 'available'),
  ('Vendredi', '15:00:00', 'closed');
