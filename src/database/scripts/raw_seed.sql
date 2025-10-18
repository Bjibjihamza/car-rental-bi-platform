-- =========================================================================
-- Car Rental – SEED (Oracle SQL*Plus)
-- Tables attendues : Branches, Managers, Car_Categories, IoT_Devices, Cars
-- Hypothèse : base vide (pas d'idempotence avancée)
-- =========================================================================

SET DEFINE OFF
SET ECHO ON
SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE

INSERT INTO Branches (branch_name, address, city, country, phone, email, created_at)
VALUES ('Casablanca HQ', 'Bd Al Massira, Maarif', 'Casablanca', 'Morocco', '+212522000111', 'casa.hq@carrental.ma', SYSTIMESTAMP);

INSERT INTO Branches (branch_name, address, city, country, phone, email, created_at)
VALUES ('Rabat Agdal', 'Av. de France, Agdal', 'Rabat', 'Morocco', '+212537700222', 'rabat.agdal@carrental.ma', SYSTIMESTAMP);

INSERT INTO Branches (branch_name, address, city, country, phone, email, created_at)
VALUES ('Tangier Downtown', 'Ibn Batouta Center', 'Tangier', 'Morocco', '+212539330333', 'tangier.dt@carrental.ma', SYSTIMESTAMP);

INSERT INTO Branches (branch_name, address, city, country, phone, email, created_at)
VALUES ('Marrakech Gueliz', 'Rue Mohammed El Beqal, Gueliz', 'Marrakech', 'Morocco', '+212524440444', 'marrakech.gueliz@carrental.ma', SYSTIMESTAMP);

INSERT INTO Branches (branch_name, address, city, country, phone, email, created_at)
VALUES ('Fes Medina', 'Av. Hassan II, Medina', 'Fes', 'Morocco', '+212535700555', 'fes.medina@carrental.ma', SYSTIMESTAMP);

COMMIT;

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Omar','Raji','o.raji@carrental.ma','+21264782565',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Casablanca HQ'),
        DATE '2022-08-12', 19401, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Houda','Kettani','h.kettani@carrental.ma','+21264451888',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Casablanca HQ'),
        DATE '2024-11-27', 16127, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Youssef','Kettani','y.kettani@carrental.ma','+21263954329',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Casablanca HQ'),
        DATE '2023-10-01', 19826, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Hassan','Raji','h.raji@carrental.ma','+21265205048',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Rabat Agdal'),
        DATE '2023-03-09', 16941, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Rachid','Pasha','r.pasha@carrental.ma','+21262566341',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Rabat Agdal'),
        DATE '2020-02-10', 17678, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Sara','Mansouri','s.mansouri@carrental.ma','+21261188722',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Rabat Agdal'),
        DATE '2021-11-01', 16614, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Rachid','Oumari','r.oumari@carrental.ma','+21264265564',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Tangier Downtown'),
        DATE '2021-08-20', 12606, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Fatima','Kettani','f.kettani@carrental.ma','+21264655372',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Tangier Downtown'),
        DATE '2020-10-30', 18969, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Leila','Zouaki','l.zouaki@carrental.ma','+21261709006',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Tangier Downtown'),
        DATE '2020-08-07', 19680, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Rachid','Fassi','r.fassi@carrental.ma','+21264143935',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Marrakech Gueliz'),
        DATE '2024-08-31', 14932, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Rachid','Cherkaoui','r.cherkaoui@carrental.ma','+21265612275',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Marrakech Gueliz'),
        DATE '2020-07-10', 16556, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Youssef','Hadji','y.hadji@carrental.ma','+21269769025',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Marrakech Gueliz'),
        DATE '2021-12-01', 14898, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Fatima','Kadiri','f.kadiri@carrental.ma','+21267119728',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Fes Medina'),
        DATE '2024-06-07', 19145, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Youssef','Bennani','y.bennani@carrental.ma','+21269584221',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Fes Medina'),
        DATE '2023-08-30', 17096, SYSTIMESTAMP);

INSERT INTO Managers (first_name, last_name, email, phone, branch_id, hire_date, salary, created_at)
VALUES ('Mariam','Pasha','m.pasha@carrental.ma','+21261093052',
        (SELECT MIN(branch_id) FROM Branches WHERE branch_name='Fes Medina'),
        DATE '2020-01-21', 15335, SYSTIMESTAMP);

COMMIT;

UPDATE Branches b
   SET manager_id = (SELECT MIN(m.manager_id) FROM Managers m WHERE m.branch_id = b.branch_id);
COMMIT;

INSERT INTO Car_Categories (category_name, daily_rate, description) VALUES ('Economy',   220.00, 'Citadines économiques (essence/diesel)');
INSERT INTO Car_Categories (category_name, daily_rate, description) VALUES ('Compact',   280.00, 'Compactes polyvalentes');
INSERT INTO Car_Categories (category_name, daily_rate, description) VALUES ('SUV',       420.00, 'SUV urbains et routiers');
INSERT INTO Car_Categories (category_name, daily_rate, description) VALUES ('Luxury',    780.00, 'Berlines haut de gamme');
INSERT INTO Car_Categories (category_name, daily_rate, description) VALUES ('Van',       500.00, '7-9 places, usage familial/pro');
INSERT INTO Car_Categories (category_name, daily_rate, description) VALUES ('Electric',  350.00, '100% électrique');
COMMIT;

PROMPT === 4) IoT_DEVICES (50) ==============================================
-- IOT-MA-0001 .. IOT-MA-0050
INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0001','GPS','Teltonika', DATE '2023-01-10', DATE '2024-12-01','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0002','Fuel Monitor','Bosch', DATE '2023-03-05', DATE '2025-06-15','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0003','GPS','Queclink', DATE '2024-02-20', DATE '2025-07-01','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0004','GPS','Teltonika', DATE '2022-11-01', DATE '2025-05-10','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0005','Fuel Monitor','Bosch', DATE '2023-07-18', DATE '2025-08-20','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0006','GPS','Bosch', DATE '2022-10-31', DATE '2025-10-14','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0007','Fuel Monitor','Queclink', DATE '2022-10-06', DATE '2024-05-28','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0008','Fuel Monitor','Teltonika', DATE '2022-12-13', DATE '2024-06-09','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0009','GPS','Queclink', DATE '2022-10-14', DATE '2025-06-17','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0010','Fuel Monitor','Teltonika', DATE '2024-05-19', DATE '2024-01-19','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0011','Fuel Monitor','Teltonika', DATE '2024-06-10', DATE '2024-02-29','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0012','Fuel Monitor','Queclink', DATE '2022-10-10', DATE '2025-11-11','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0013','Fuel Monitor','Bosch', DATE '2022-06-22', DATE '2024-10-14','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0014','Fuel Monitor','Teltonika', DATE '2024-02-10', DATE '2025-05-08','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0015','Fuel Monitor','Teltonika', DATE '2022-09-15', DATE '2024-12-30','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0016','GPS','Teltonika', DATE '2023-06-20', DATE '2025-09-03','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0017','GPS','Teltonika', DATE '2022-09-24', DATE '2024-10-14','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0018','GPS','Teltonika', DATE '2024-01-18', DATE '2025-09-25','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0019','Fuel Monitor','Teltonika', DATE '2024-04-09', DATE '2025-10-05','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0020','GPS','Teltonika', DATE '2022-08-31', DATE '2024-12-24','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0021','GPS','Bosch', DATE '2023-04-15', DATE '2025-04-20','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0022','Fuel Monitor','Queclink', DATE '2022-05-22', DATE '2025-03-10','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0023','GPS','Teltonika', DATE '2024-07-08', DATE '2025-12-05','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0024','Fuel Monitor','Bosch', DATE '2023-09-12', DATE '2024-11-18','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0025','GPS','Queclink', DATE '2022-12-05', DATE '2025-01-15','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0026','Fuel Monitor','Teltonika', DATE '2024-03-20', DATE '2025-07-25','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0027','GPS','Bosch', DATE '2023-11-30', DATE '2024-09-10','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0028','Fuel Monitor','Queclink', DATE '2022-07-14', DATE '2025-02-28','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0029','GPS','Teltonika', DATE '2024-05-05', DATE '2025-08-12','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0030','Fuel Monitor','Bosch', DATE '2023-02-18', DATE '2024-10-22','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0031','GPS','Queclink', DATE '2022-08-25', DATE '2025-05-30','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0032','Fuel Monitor','Teltonika', DATE '2024-01-12', DATE '2025-06-08','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0033','GPS','Bosch', DATE '2023-10-03', DATE '2024-12-15','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0034','Fuel Monitor','Queclink', DATE '2022-04-28', DATE '2025-03-22','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0035','GPS','Teltonika', DATE '2024-09-17', DATE '2025-11-05','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0036','Fuel Monitor','Bosch', DATE '2023-06-09', DATE '2024-07-20','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0037','GPS','Queclink', DATE '2022-11-11', DATE '2025-04-18','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0038','Fuel Monitor','Teltonika', DATE '2024-08-04', DATE '2025-10-12','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0039','GPS','Bosch', DATE '2023-05-26', DATE '2024-08-30','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0040','Fuel Monitor','Queclink', DATE '2022-03-19', DATE '2025-01-25','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0041','GPS','Teltonika', DATE '2024-02-14', DATE '2025-07-03','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0042','Fuel Monitor','Bosch', DATE '2023-12-07', DATE '2024-11-14','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0043','GPS','Queclink', DATE '2022-09-30', DATE '2025-06-20','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0044','Fuel Monitor','Teltonika', DATE '2024-07-21', DATE '2025-09-28','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0045','GPS','Bosch', DATE '2023-01-16', DATE '2024-10-05','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0046','Fuel Monitor','Queclink', DATE '2022-06-23', DATE '2025-02-12','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0047','GPS','Teltonika', DATE '2024-04-29', DATE '2025-08-17','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0048','Fuel Monitor','Bosch', DATE '2023-08-13', DATE '2024-12-24','Maintenance', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0049','GPS','Queclink', DATE '2022-10-27', DATE '2025-05-09','Active', SYSTIMESTAMP);

INSERT INTO IoT_Devices (device_serial, device_type, manufacturer, installation_date, last_maintenance, status, created_at)
VALUES ('IOT-MA-0050','Fuel Monitor','Teltonika', DATE '2024-06-02', DATE '2025-10-31','Active', SYSTIMESTAMP);

COMMIT;

PROMPT === 5) CARS (50) =====================================================
-- Règles attendues par le schéma :
-- fuel_type IN ('Essence','Diesel','Electrique','Hybride')
-- transmission IN ('Manuelle','Automatique')
-- status IN ('Disponible','Loué','Maintenance','Hors Service')

-- Casablanca HQ (CMA-001..010 / IOT-MA-0001..0010)
INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('CMA-001','Kia','Sportage',2020,'Gris',25462,'Hybride','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='SUV'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Casablanca HQ'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0001'),
        'Hors Service', DATE '2023-12-12', DATE '2024-04-29', DATE '2026-10-14', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('CMA-002','Volkswagen','Caddy',2022,'Vert',72821,'Diesel','Manuelle',7,
        (SELECT category_id FROM Car_Categories WHERE category_name='Van'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Casablanca HQ'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0002'),
        'Loué', DATE '2019-09-18', DATE '2024-11-30', DATE '2026-11-14', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('CMA-003','Mercedes','E200',2018,'Blanc',55508,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Luxury'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Casablanca HQ'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0003'),
        'Hors Service', DATE '2024-01-29', DATE '2024-10-15', DATE '2026-09-11', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('CMA-004','Tesla','Model 3',2024,'Vert',110441,'Electrique','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Electric'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Casablanca HQ'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0004'),
        'Disponible', DATE '2020-12-02', DATE '2024-01-18', DATE '2026-08-16', 648.12);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('CMA-005','Peugeot','208',2019,'Argent',28436,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Economy'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Casablanca HQ'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0005'),
        'Maintenance', DATE '2022-07-14', DATE '2024-03-18', DATE '2026-08-08', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('CMA-006','Volkswagen','Polo',2018,'Bleu',25042,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Casablanca HQ'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0006'),
        'Hors Service', DATE '2022-10-23', DATE '2024-12-22', DATE '2026-12-15', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('CMA-007','Audi','A4',2022,'Noir',85642,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Luxury'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Casablanca HQ'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0007'),
        'Maintenance', DATE '2021-05-14', DATE '2024-07-03', DATE '2026-10-02', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('CMA-008','Kia','Sportage',2023,'Rouge',74894,'Hybride','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='SUV'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Casablanca HQ'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0008'),
        'Loué', DATE '2024-08-24', DATE '2024-05-24', DATE '2026-07-18', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('CMA-009','Lexus','ES',2023,'Gris',28042,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Luxury'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Casablanca HQ'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0009'),
        'Loué', DATE '2021-10-22', DATE '2024-07-31', DATE '2026-10-01', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('CMA-010','Ford','Transit',2020,'Noir',117724,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Van'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Casablanca HQ'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0010'),
        'Hors Service', DATE '2020-08-28', DATE '2024-10-30', DATE '2026-07-18', NULL);

-- Rabat Agdal (RBA-101..110 / IOT-MA-0011..0020)
INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('RBA-101','Volkswagen','Polo',2020,'Argent',33644,'Diesel','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Rabat Agdal'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0011'),
        'Loué', DATE '2020-02-17', DATE '2024-01-17', DATE '2026-09-23', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('RBA-102','Lexus','ES',2018,'Noir',78657,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Luxury'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Rabat Agdal'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0012'),
        'Disponible', DATE '2024-01-16', DATE '2024-07-22', DATE '2026-07-02', 514.26);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('RBA-103','Kia','Sportage',2023,'Vert',106071,'Hybride','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='SUV'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Rabat Agdal'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0013'),
        'Hors Service', DATE '2024-03-24', DATE '2024-11-10', DATE '2026-10-26', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('RBA-104','Citroen','Berlingo',2024,'Argent',5809,'Essence','Manuelle',7,
        (SELECT category_id FROM Car_Categories WHERE category_name='Van'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Rabat Agdal'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0014'),
        'Loué', DATE '2023-04-05', DATE '2024-02-22', DATE '2026-10-22', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('RBA-105','Hyundai','i20',2021,'Vert',76915,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Rabat Agdal'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0015'),
        'Loué', DATE '2020-05-10', DATE '2024-11-02', DATE '2026-07-05', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('RBA-106','Audi','A4',2022,'Gris',74929,'Diesel','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Luxury'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Rabat Agdal'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0016'),
        'Maintenance', DATE '2020-05-01', DATE '2024-03-17', DATE '2026-12-31', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('RBA-107','Kia','Sportage',2024,'Argent',34122,'Hybride','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='SUV'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Rabat Agdal'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0017'),
        'Hors Service', DATE '2024-01-15', DATE '2024-08-08', DATE '2026-07-19', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('RBA-108','Renault','Twingo',2025,'Bleu',7556,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Economy'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Rabat Agdal'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0018'),
        'Disponible', DATE '2023-05-12', DATE '2024-08-07', DATE '2026-08-15', 713.25);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('RBA-109','Tesla','Model 3',2025,'Rouge',28018,'Electrique','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Electric'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Rabat Agdal'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0019'),
        'Hors Service', DATE '2020-05-21', DATE '2024-06-01', DATE '2026-09-07', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('RBA-110','Renault','Twingo',2025,'Blanc',100902,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Economy'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Rabat Agdal'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0020'),
        'Disponible', DATE '2021-08-06', DATE '2024-08-24', DATE '2026-12-12', 549.68);

-- Tangier Downtown (TNG-201..210 / IOT-MA-0021..0030)
INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('TNG-201','Volkswagen','Polo',2019,'Gris',41381,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Tangier Downtown'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0021'),
        'Hors Service', DATE '2022-11-16', DATE '2024-05-02', DATE '2026-08-06', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('TNG-202','Hyundai','Kona',2021,'Rouge',116815,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='SUV'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Tangier Downtown'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0022'),
        'Disponible', DATE '2020-12-14', DATE '2024-11-04', DATE '2026-12-07', 215.03);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('TNG-203','Hyundai','Kona',2018,'Blanc',85431,'Hybride','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='SUV'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Tangier Downtown'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0023'),
        'Loué', DATE '2023-04-29', DATE '2024-04-25', DATE '2026-10-28', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('TNG-204','Ford','Transit',2022,'Argent',95410,'Diesel','Automatique',7,
        (SELECT category_id FROM Car_Categories WHERE category_name='Van'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Tangier Downtown'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0024'),
        'Loué', DATE '2022-08-16', DATE '2024-02-09', DATE '2026-12-05', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('TNG-205','Hyundai','Kona',2022,'Rouge',86695,'Hybride','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='SUV'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Tangier Downtown'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0025'),
        'Maintenance', DATE '2021-12-31', DATE '2024-06-24', DATE '2026-07-23', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('TNG-206','Renault','Twingo',2025,'Gris',51149,'Diesel','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Economy'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Tangier Downtown'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0026'),
        'Maintenance', DATE '2020-02-24', DATE '2024-05-16', DATE '2026-07-27', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('TNG-207','Tesla','Model 3',2021,'Gris',5825,'Electrique','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Electric'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Tangier Downtown'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0027'),
        'Disponible', DATE '2019-04-19', DATE '2024-07-18', DATE '2026-09-15', 355.77);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('TNG-208','Volkswagen','Caddy',2019,'Blanc',38595,'Diesel','Manuelle',7,
        (SELECT category_id FROM Car_Categories WHERE category_name='Van'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Tangier Downtown'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0028'),
        'Disponible', DATE '2022-02-02', DATE '2024-09-22', DATE '2026-10-06', 274.91);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('TNG-209','Ford','Fiesta',2024,'Gris',89576,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Tangier Downtown'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0029'),
        'Loué', DATE '2021-07-04', DATE '2024-03-16', DATE '2026-07-12', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('TNG-210','Nissan','Leaf',2020,'Gris',113267,'Electrique','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Electric'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Tangier Downtown'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0030'),
        'Loué', DATE '2023-02-15', DATE '2024-11-23', DATE '2026-11-22', NULL);

-- Marrakech Gueliz (MRK-301..310 / IOT-MA-0031..0040)
INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('MRK-301','Citroen','Berlingo',2020,'Gris',24781,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Van'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Marrakech Gueliz'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0031'),
        'Hors Service', DATE '2021-08-19', DATE '2024-06-11', DATE '2026-07-16', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('MRK-302','Renault','Clio',2022,'Rouge',52679,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Marrakech Gueliz'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0032'),
        'Disponible', DATE '2021-10-07', DATE '2024-01-30', DATE '2026-09-13', 722.91);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('MRK-303','Renault','Zoe',2021,'Noir',30751,'Electrique','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Electric'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Marrakech Gueliz'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0033'),
        'Maintenance', DATE '2022-03-16', DATE '2024-12-12', DATE '2026-11-14', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('MRK-304','Renault','Clio',2022,'Blanc',99580,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Marrakech Gueliz'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0034'),
        'Loué', DATE '2020-11-24', DATE '2024-05-04', DATE '2026-10-16', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('MRK-305','Renault','Clio',2023,'Argent',58481,'Essence','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Marrakech Gueliz'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0035'),
        'Loué', DATE '2023-07-26', DATE '2024-11-17', DATE '2026-09-09', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('MRK-306','Hyundai','i20',2021,'Argent',56095,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Marrakech Gueliz'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0036'),
        'Hors Service', DATE '2019-05-26', DATE '2024-02-10', DATE '2026-11-03', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('MRK-307','Peugeot','208',2023,'Rouge',48058,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Economy'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Marrakech Gueliz'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0037'),
        'Disponible', DATE '2022-08-13', DATE '2024-05-08', DATE '2026-08-02', 705.93);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('MRK-308','Kia','Sportage',2022,'Rouge',10968,'Hybride','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='SUV'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Marrakech Gueliz'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0038'),
        'Loué', DATE '2021-02-12', DATE '2024-06-27', DATE '2026-08-17', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('MRK-309','Renault','Zoe',2019,'Bleu',101460,'Electrique','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Electric'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Marrakech Gueliz'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0039'),
        'Disponible', DATE '2019-08-10', DATE '2024-11-24', DATE '2026-10-18', 841.86);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('MRK-310','Ford','Transit',2025,'Argent',29733,'Diesel','Automatique',7,
        (SELECT category_id FROM Car_Categories WHERE category_name='Van'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Marrakech Gueliz'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0040'),
        'Disponible', DATE '2019-10-14', DATE '2024-07-01', DATE '2026-09-09', 277.56);

-- Fes Medina (FES-401..410 / IOT-MA-0041..0050)
INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('FES-401','Ford','Fiesta',2024,'Vert',63105,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Fes Medina'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0041'),
        'Loué', DATE '2021-06-28', DATE '2024-06-13', DATE '2026-10-20', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('FES-402','Volkswagen','Caddy',2020,'Blanc',76817,'Essence','Automatique',7,
        (SELECT category_id FROM Car_Categories WHERE category_name='Van'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Fes Medina'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0042'),
        'Disponible', DATE '2020-03-01', DATE '2024-02-11', DATE '2026-08-23', 334.02);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('FES-403','Renault','Clio',2023,'Noir',57653,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Compact'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Fes Medina'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0043'),
        'Hors Service', DATE '2020-12-06', DATE '2024-01-23', DATE '2026-11-30', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('FES-404','Lexus','ES',2021,'Bleu',72440,'Essence','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Luxury'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Fes Medina'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0044'),
        'Maintenance', DATE '2021-02-28', DATE '2024-10-30', DATE '2026-09-29', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('FES-405','Ford','Transit',2018,'Gris',68107,'Essence','Automatique',7,
        (SELECT category_id FROM Car_Categories WHERE category_name='Van'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Fes Medina'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0045'),
        'Disponible', DATE '2024-12-11', DATE '2024-06-19', DATE '2026-09-22', 779.5);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('FES-406','Lexus','ES',2020,'Argent',86556,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Luxury'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Fes Medina'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0046'),
        'Disponible', DATE '2022-10-28', DATE '2024-03-17', DATE '2026-07-10', 269.7);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('FES-407','Tesla','Model 3',2020,'Argent',83389,'Electrique','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Electric'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Fes Medina'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0047'),
        'Disponible', DATE '2019-02-22', DATE '2024-04-20', DATE '2026-09-04', 511.03);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('FES-408','Fiat','Panda',2020,'Gris',66004,'Diesel','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Economy'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Fes Medina'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0048'),
        'Hors Service', DATE '2022-04-09', DATE '2024-11-08', DATE '2026-07-21', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('FES-409','Nissan','Qashqai',2025,'Vert',42714,'Essence','Automatique',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='SUV'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Fes Medina'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0049'),
        'Maintenance', DATE '2023-08-24', DATE '2024-05-13', DATE '2026-07-05', NULL);

INSERT INTO Cars (license_plate, brand, model, year, color, mileage, fuel_type, transmission, seats,
                  category_id, branch_id, iot_device_id, status, purchase_date, last_service_date, next_service_due, daily_rate)
VALUES ('FES-410','BMW','320i',2023,'Blanc',78479,'Essence','Manuelle',5,
        (SELECT category_id FROM Car_Categories WHERE category_name='Luxury'),
        (SELECT branch_id   FROM Branches        WHERE branch_name='Fes Medina'),
        (SELECT device_id FROM IoT_Devices WHERE device_serial='IOT-MA-0050'),
        'Hors Service', DATE '2022-05-23', DATE '2024-04-28', DATE '2026-09-02', NULL);

COMMIT;