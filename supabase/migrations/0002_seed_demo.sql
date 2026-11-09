-- Fase 1 — Seed de demostración.
-- agent_id = NULL en todas las filas por ahora (no hay Auth real en esta fase).

insert into public.properties
  (reference, address, city, price, owner_name, owner_phone, status)
values
  ('V-18', 'Calle de Alcalá 120', 'Madrid', 230000.00, 'Carlos Ruiz', '+34 611 100 200', 'disponible'),
  ('V-22', 'Calle Serrano 45', 'Madrid', 450000.00, 'Marta Gómez', '+34 611 100 201', 'disponible'),
  ('V-07', 'Calle Goya 88', 'Madrid', 310000.00, 'Javier López', '+34 611 100 202', 'reservado'),
  ('V-31', 'Avenida de América 15', 'Madrid', 275000.00, 'Lucía Fernández', '+34 611 100 203', 'disponible'),
  ('V-12', 'Calle Bravo Murillo 200', 'Madrid', 195000.00, 'Antonio Sánchez', '+34 611 100 204', 'vendido'),
  ('V-45', 'Paseo de la Castellana 300', 'Madrid', 620000.00, 'Elena Torres', '+34 611 100 205', 'disponible'),
  ('V-09', 'Calle Toledo 55', 'Madrid', 215000.00, 'Miguel Ángel Díaz', '+34 611 100 206', 'disponible'),
  ('V-27', 'Calle Princesa 33', 'Madrid', 340000.00, 'Sofía Martín', '+34 611 100 207', 'reservado');

insert into public.clients (full_name, phone, email, is_temporary)
values
  ('Ana García', '+34 612 345 678', 'ana.garcia@gmail.com', false),
  ('Pedro Molina', '+34 655 123 456', 'pedro.molina@hotmail.com', false),
  ('Laura Ortiz', '+34 699 876 543', 'laura.ortiz@yahoo.es', false),
  ('David Romero', '+34 611 222 333', null, false),
  ('Carmen Ibáñez', '+34 622 333 444', 'carmen.ibanez@gmail.com', false),
  ('Jorge Navarro', '+34 633 444 555', null, true);
