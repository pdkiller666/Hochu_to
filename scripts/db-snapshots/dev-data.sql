--
-- PostgreSQL database dump
--

\restrict pl3UfXhsshTI9Nmk2PooT7oOvanNssHe8N5sPPhIjGgaUfZ5gXdwnGkvQJNwq4X

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users VALUES (3, 'Дмитрий Захаров', 'dmitry@example.com', '$2b$10$boFxyBz.mxuxt.cLJp1ZcOXZo0FXH.IYBViktGCGlKvOSc4A7Acny', 'owner', '+7 (343) 555-44-33', NULL, 'Сдаю спортивное снаряжение и товары для отдыха на природе.', NULL, NULL, 71, 0, false, NULL, '2026-04-23 15:06:02.848668');
INSERT INTO public.users VALUES (4, 'Ирина Новикова', 'irina@example.com', '$2b$10$uVmDwuwm5G5wlUNHNIA.AO2ldddMHaE2aHPyXuNkC26bR21sfypvW', 'renter', '+7 (963) 111-22-33', NULL, NULL, NULL, NULL, 1, 0, false, NULL, '2026-04-23 15:06:03.166003');
INSERT INTO public.users VALUES (5, 'Сергей Волков', 'sergey@example.com', '$2b$10$jNxhibTenj0QlvLR5B.Ex.TZjQojOMw23tgBoDYbC/khxSJOi0uwy', 'renter', '+7 (921) 444-55-66', NULL, NULL, NULL, NULL, 2, 0, false, NULL, '2026-04-23 15:06:03.166003');
INSERT INTO public.users VALUES (7, 'Администратор', 'admin@test.ru', '$2b$10$zG8j1wDT18n17u.3oPMbfutQSMPcllsDz.7rxiFOqa68Q4MGECa46', 'admin', '+7 (000) 000-00-00', NULL, NULL, NULL, NULL, 1, 0, false, NULL, '2026-04-23 15:06:03.166003');
INSERT INTO public.users VALUES (2, 'Мария Соколова', 'maria@example.com', '$2b$10$BN7hWmFwCflPxNRTHSBI7.KEnMJAHh4ADHctySdNSKcE/Ar1yPOze', 'owner', '+7 (812) 987-65-43', NULL, 'Фотограф. Сдаю профессиональное оборудование для съёмок.', '@maria_photo', NULL, 2, 1, false, 'Тест бана', '2026-04-23 15:06:02.766712');
INSERT INTO public.users VALUES (1, 'Алексей Петров', 'alexey@example.com', '$2b$10$Jt/DNGYGGi.qBh18S.Y7lOrvQcueIiaREdejTiA2UjbVcV0/y9qVG', 'owner', '+7 (916) 123-45-67', NULL, 'Сдаю технику и инструменты уже 3 года. Всё в отличном состоянии.', '@alexey_rents', NULL, 1, 2, false, NULL, '2026-04-23 15:06:02.682791');
INSERT INTO public.users VALUES (6, 'Анна Козлова-Тест', 'anna@example.com', '$2b$10$ayi44cN3suJCDmBtD8qUG.a/iw8VBivStF1kCFXPiRkhgnX/bYok2', 'renter', '+7 (383) 777-88-99', NULL, 'Арендую вещи для дачи и путешествий.', 'anna_test', NULL, 1, 1, false, NULL, '2026-04-23 15:06:03.166003');


--
-- Data for Name: admin_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.admin_audit_log VALUES (1, 7, 'platform_settings', 1, 'update', '["serviceFeePercent","taxFeePercent","freeListingsEnabled","contactLifetimeDays"]', '2026-04-23 17:17:57.753338');
INSERT INTO public.admin_audit_log VALUES (2, 7, 'user', 2, 'ban_user', 'Changed: isBanned, banReason. Reason: Тест бана', '2026-04-23 17:18:30.519095');
INSERT INTO public.admin_audit_log VALUES (3, 7, 'user', 2, 'unban_user', 'Changed: isBanned', '2026-04-23 17:18:30.674013');
INSERT INTO public.admin_audit_log VALUES (4, 7, 'listing', 15, 'edit_listing', 'Changed: isAvailable', '2026-04-23 17:19:21.311743');
INSERT INTO public.admin_audit_log VALUES (5, 7, 'listing', 15, 'edit_listing', 'Changed: isAvailable', '2026-04-23 17:19:21.435216');
INSERT INTO public.admin_audit_log VALUES (6, 7, 'platform_settings', 1, 'update', '["serviceFeePercent","taxFeePercent","contactPriceSingle"]', '2026-04-23 18:54:24.231548');


--
-- Data for Name: auth_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.auth_sessions VALUES (1, 2, 'be74c553806600e1c7c7d494aeb00bd49f371896f56f86b0452dda51a3bc2f97', '2026-05-23 17:05:58.678', NULL, '2026-04-23 17:05:58.67889');
INSERT INTO public.auth_sessions VALUES (2, 1, 'f3d02dfec7c54ed496dac300db8424a571fe1527d40dc05cb74bcb359cb960bd', '2026-05-23 17:05:59.393', NULL, '2026-04-23 17:05:59.393953');
INSERT INTO public.auth_sessions VALUES (3, 7, 'e9614952b3a8c3b1ae055c71ab0f9310d017fbc8258bb59dd9ebef1e70a52bf7', '2026-05-23 17:05:59.518', NULL, '2026-04-23 17:05:59.519214');
INSERT INTO public.auth_sessions VALUES (4, 2, 'e4bf103ea65dabbd697d60dee4120c9045f993495fce7b041f47e862ad5da656', '2026-05-23 17:06:09.389', NULL, '2026-04-23 17:06:09.390194');
INSERT INTO public.auth_sessions VALUES (5, 1, '680b40b61b464dd658dfaa7bffc2b6063713facac6a4a4454107898dcd9f17f9', '2026-05-23 17:06:09.534', NULL, '2026-04-23 17:06:09.534915');
INSERT INTO public.auth_sessions VALUES (6, 7, '75a99b7126815751e991c7d4aefabc079ac5b6514d60de782d7120d12ac0b3aa', '2026-05-23 17:06:09.684', NULL, '2026-04-23 17:06:09.684312');
INSERT INTO public.auth_sessions VALUES (7, 1, 'b9d7cd8a84517e19fbba46afb7f1b77b262de6a2efc478c62c0a3c31d66c82d4', '2026-05-23 17:38:43.731', NULL, '2026-04-23 17:38:43.732337');
INSERT INTO public.auth_sessions VALUES (8, 1, '63e321eba78c128ebb35671a28b90bb0806c3999d996c2624dd871c015499980', '2026-05-23 17:38:50.325', NULL, '2026-04-23 17:38:50.326368');
INSERT INTO public.auth_sessions VALUES (9, 1, '196747f2ef25fe7b46f8cf24a43a65735c5496e2e4bc1de95c0cda5b6a07fb58', '2026-05-23 18:27:33.919', NULL, '2026-04-23 18:27:33.920859');
INSERT INTO public.auth_sessions VALUES (10, 7, 'bf174fd6d757f358a3454e7848824afcaa51cf109fc65f1d8c946ff10b0c1f64', '2026-05-23 18:27:35.516', NULL, '2026-04-23 18:27:35.517279');
INSERT INTO public.auth_sessions VALUES (11, 1, 'c8c8bf6ffefc80190def9752f87ac15b09881ffd5911c61a275b76b82dac08d7', '2026-05-23 18:27:43.523', NULL, '2026-04-23 18:27:43.524423');
INSERT INTO public.auth_sessions VALUES (12, 7, '9f932f565b976391e37cf51d35aeba8f57ed93b80ece471880254872009e6e15', '2026-05-23 18:27:45.752', NULL, '2026-04-23 18:27:45.753045');
INSERT INTO public.auth_sessions VALUES (13, 7, '367578bb4346836d7cffc521b0a38cdc8bf7fd7bc8e38ce1f37de922a797d7ff', '2026-05-23 18:31:54.751', NULL, '2026-04-23 18:31:54.752203');
INSERT INTO public.auth_sessions VALUES (14, 7, '3221f1b8335b2dc3e3d91a47ea8686894f0a504c79a9dcd942c0f1cf66a2b658', '2026-05-23 18:34:12.689', NULL, '2026-04-23 18:34:12.689979');
INSERT INTO public.auth_sessions VALUES (15, 7, '78e4a8e386c36e433f560582edf4e37e5be5799fc016093b8a90de3d608fab3a', '2026-05-23 18:36:37.58', NULL, '2026-04-23 18:36:37.581524');
INSERT INTO public.auth_sessions VALUES (16, 7, '97945515507fdbe31d187ec005af4027419129c6bca103b17b1bd90840aa18b0', '2026-05-23 18:49:05.095', NULL, '2026-04-23 18:49:05.096002');
INSERT INTO public.auth_sessions VALUES (17, 1, '394d063ec123a184730f03eb25b6c3f341d254533691e24727c36900f49670f9', '2026-05-23 18:49:05.265', NULL, '2026-04-23 18:49:05.265418');
INSERT INTO public.auth_sessions VALUES (18, 2, '885044893ac261f1bb8a3f57af3ca03fc5e59a2970a0edd4ae5b7de1c70f4f49', '2026-05-23 18:49:05.412', NULL, '2026-04-23 18:49:05.412625');
INSERT INTO public.auth_sessions VALUES (19, 7, '48728258b660e52586562ace9fe34180e4106af56dc9054f164aafce81bbec32', '2026-05-23 18:49:18.416', NULL, '2026-04-23 18:49:18.416543');
INSERT INTO public.auth_sessions VALUES (20, 1, '1293e222f5e46f5a70fe9b8d955e6385af243257b600eeb06d74690b121581d4', '2026-05-23 18:49:18.558', NULL, '2026-04-23 18:49:18.558913');
INSERT INTO public.auth_sessions VALUES (21, 2, '7221ee7cee74d58ecbfccb7032cd75e68fec44f189cb8516d7324241fc281d5a', '2026-05-23 18:49:18.701', NULL, '2026-04-23 18:49:18.702126');
INSERT INTO public.auth_sessions VALUES (22, 7, 'ee186d529e8e30bcdea6839308cd24ece556abe56d6a0075ba71201ccc7df998', '2026-05-23 18:51:13.597', NULL, '2026-04-23 18:51:13.598295');
INSERT INTO public.auth_sessions VALUES (23, 4, 'ae0d263588a84b08613e761a0eabfb6eade146c56ee4a60ece102d62c10409df', '2026-05-23 18:51:13.911', NULL, '2026-04-23 18:51:13.911653');
INSERT INTO public.auth_sessions VALUES (24, 1, '41707aacc9d1606f2d307f97c3ab2d12ee1ee74de4a3818b266831ea0be1655b', '2026-05-23 18:51:13.911', NULL, '2026-04-23 18:51:13.91208');
INSERT INTO public.auth_sessions VALUES (25, 6, '23ff2d9e3064633c8d8fd580aec944c002d05d4100f25921a7be991615caa1ff', '2026-05-23 18:51:13.912', NULL, '2026-04-23 18:51:13.91236');
INSERT INTO public.auth_sessions VALUES (26, 5, '44cec33c92bd048d12aea52002a2642acc01fb9590e7ec0c01ffbd55a03d3eaf', '2026-05-23 18:51:13.912', NULL, '2026-04-23 18:51:13.912661');
INSERT INTO public.auth_sessions VALUES (27, 3, '9fefbf96cd6822764e7f51e656c968e21abbbdbb3c2ccfc8195d94900d9ad8b9', '2026-05-23 18:51:42.204', NULL, '2026-04-23 18:51:42.204697');
INSERT INTO public.auth_sessions VALUES (28, 7, 'ecdc648c08fcc56eab24481f6b14203e75b1eed93701b27453515e2b08f87b63', '2026-05-23 19:00:56.909', NULL, '2026-04-23 19:00:56.910156');
INSERT INTO public.auth_sessions VALUES (29, 1, '3cb2ab2bd084eca367c9a687749691efe9b6d1aa4c76c714472496b052e2601c', '2026-05-23 19:00:57.005', NULL, '2026-04-23 19:00:57.005796');
INSERT INTO public.auth_sessions VALUES (30, 6, 'a9f67585cac1992f3f70a5c8b9a66d15648cfb8e04af1ae3ce21bb8fb566b0c8', '2026-05-23 19:00:57.093', NULL, '2026-04-23 19:00:57.093536');
INSERT INTO public.auth_sessions VALUES (31, 4, 'fccc068a9176fbc7cfa05c068829b537c4dbbf08651992b9d4a467118e101d7f', '2026-05-23 19:00:57.192', NULL, '2026-04-23 19:00:57.192708');


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.bookings VALUES (1, 'ХТ-2026-000001', 2, 2, 1, '2026-05-10', '2026-05-15', 5, 15750.00, 15000.00, 1500.00, 900.00, 750.00, 750.00, 120000.00, 11850.00, true, true, 'pending', 'none', 'Тестовое бронирование', NULL, '2026-04-23 17:07:35.096421', NULL, NULL);
INSERT INTO public.bookings VALUES (2, 'ХТ-2026-000002', 2, 2, 1, '2026-06-01', '2026-06-05', 4, 12600.00, 12000.00, 1200.00, 720.00, 600.00, 600.00, 120000.00, 9480.00, true, true, 'completed', 'none', 'Тест фикса уведомлений', NULL, '2026-04-23 17:08:51.919341', NULL, NULL);
INSERT INTO public.bookings VALUES (3, 'ХТ-2026-000003', 18, 6, 1, '2026-05-03', '2026-05-05', 2, 49.00, 900.00, 0.00, 0.00, 0.00, NULL, 0.00, NULL, false, false, 'confirmed', 'none', NULL, NULL, '2026-04-23 18:52:02.264795', NULL, NULL);
INSERT INTO public.bookings VALUES (5, 'ХТ-2026-000005', 21, 4, 3, '2026-05-20', '2026-05-22', 2, 49.00, 2400.00, 0.00, 0.00, 0.00, NULL, 0.00, NULL, false, false, 'confirmed', 'none', NULL, NULL, '2026-04-23 18:52:02.299643', NULL, NULL);
INSERT INTO public.bookings VALUES (6, 'ХТ-2026-000006', 20, 5, 1, '2026-06-01', '2026-06-07', 6, 4095.00, 3900.00, 390.00, 0.00, 195.00, 195.00, 1500.00, 3315.00, true, true, 'pending', 'none', NULL, NULL, '2026-04-23 18:52:02.314625', NULL, NULL);
INSERT INTO public.bookings VALUES (7, 'ХТ-2026-000007', 22, 4, 3, '2026-07-15', '2026-07-17', 2, 7350.00, 7000.00, 700.00, 0.00, 350.00, 350.00, 7000.00, 5950.00, true, true, 'pending', 'none', NULL, NULL, '2026-04-23 18:52:02.330366', NULL, NULL);
INSERT INTO public.bookings VALUES (4, 'ХТ-2026-000004', 19, 6, 1, '2026-05-10', '2026-05-12', 2, 660.00, 560.00, 56.00, 0.00, 100.00, 100.00, 1500.00, 404.00, true, true, 'completed', 'none', NULL, NULL, '2026-04-23 18:52:02.283982', NULL, NULL);


--
-- Data for Name: booking_events; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.booking_events VALUES (1, 1, 'ХТ-2026-000001', 2, 'renter', 'created', NULL, 'pending', 'Тестовое бронирование', '2026-04-23 17:07:35.103131');
INSERT INTO public.booking_events VALUES (2, 2, 'ХТ-2026-000002', 2, 'renter', 'created', NULL, 'pending', 'Тест фикса уведомлений', '2026-04-23 17:08:51.959913');
INSERT INTO public.booking_events VALUES (3, 2, 'ХТ-2026-000002', 1, 'owner', 'status_changed', 'pending', 'confirmed', NULL, '2026-04-23 17:10:16.852142');
INSERT INTO public.booking_events VALUES (4, 2, 'ХТ-2026-000002', 1, 'owner', 'status_changed', 'confirmed', 'active', NULL, '2026-04-23 17:10:17.042051');
INSERT INTO public.booking_events VALUES (5, 2, 'ХТ-2026-000002', 1, 'owner', 'status_changed', 'active', 'return_pending', NULL, '2026-04-23 17:10:17.235535');
INSERT INTO public.booking_events VALUES (6, 2, 'ХТ-2026-000002', 1, 'owner', 'status_changed', 'return_pending', 'completed', NULL, '2026-04-23 17:10:17.433737');
INSERT INTO public.booking_events VALUES (7, 3, 'ХТ-2026-000003', 6, 'renter', 'direct_contact_opened', NULL, 'confirmed', 'Прямой расчёт: оплачено 49 ₽ за открытие контактов', '2026-04-23 18:52:02.271269');
INSERT INTO public.booking_events VALUES (8, 4, 'ХТ-2026-000004', 6, 'renter', 'created', NULL, 'pending', NULL, '2026-04-23 18:52:02.289752');
INSERT INTO public.booking_events VALUES (9, 5, 'ХТ-2026-000005', 4, 'renter', 'direct_contact_opened', NULL, 'confirmed', 'Прямой расчёт: оплачено 49 ₽ за открытие контактов', '2026-04-23 18:52:02.30455');
INSERT INTO public.booking_events VALUES (10, 6, 'ХТ-2026-000006', 5, 'renter', 'created', NULL, 'pending', NULL, '2026-04-23 18:52:02.319509');
INSERT INTO public.booking_events VALUES (11, 7, 'ХТ-2026-000007', 4, 'renter', 'created', NULL, 'pending', NULL, '2026-04-23 18:52:02.335584');
INSERT INTO public.booking_events VALUES (12, 4, 'ХТ-2026-000004', 1, 'owner', 'status_changed', 'pending', 'confirmed', NULL, '2026-04-23 18:52:02.356605');
INSERT INTO public.booking_events VALUES (13, 4, 'ХТ-2026-000004', 1, 'owner', 'status_changed', 'confirmed', 'active', NULL, '2026-04-23 18:53:09.434897');
INSERT INTO public.booking_events VALUES (14, 4, 'ХТ-2026-000004', 6, 'renter', 'status_changed', 'active', 'return_pending', NULL, '2026-04-23 18:53:09.449993');
INSERT INTO public.booking_events VALUES (15, 4, 'ХТ-2026-000004', 1, 'owner', 'status_changed', 'return_pending', 'completed', NULL, '2026-04-23 18:53:09.475297');


--
-- Data for Name: booking_messages; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.booking_messages VALUES (1, 2, 2, 'Привет, подтвердите пожалуйста бронирование!', false, '2026-04-23 17:10:43.493203');
INSERT INTO public.booking_messages VALUES (2, 2, 2, 'Добрый день, когда забрать?', false, '2026-04-23 17:20:37.167341');
INSERT INTO public.booking_messages VALUES (3, 4, 6, 'Привет! Когда можно забрать шуруповёрт?', false, '2026-04-23 18:52:38.782658');
INSERT INTO public.booking_messages VALUES (4, 4, 1, 'Добрый день! В любой день с 10 до 18. Звоните за час.', true, '2026-04-23 18:52:38.818247');


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.categories VALUES (1, 'Стройка и ремонт', 'construction', '🔨');
INSERT INTO public.categories VALUES (2, 'Туризм и спорт', 'tourism', '⛺');
INSERT INTO public.categories VALUES (3, 'Сад и огород', 'garden', '🌱');
INSERT INTO public.categories VALUES (4, 'Праздники', 'holidays', '🎉');
INSERT INTO public.categories VALUES (5, 'Детские товары', 'children', '👶');
INSERT INTO public.categories VALUES (6, 'Электроника', 'electronics', '💻');
INSERT INTO public.categories VALUES (7, 'Авто и мото', 'auto', '🚗');
INSERT INTO public.categories VALUES (8, 'Одежда и обувь', 'clothing', '👗');
INSERT INTO public.categories VALUES (9, 'Фото и видео', 'photo', '📷');
INSERT INTO public.categories VALUES (10, 'Книги и учёба', 'books', '📚');


--
-- Data for Name: claims; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.claims VALUES (1, 4, 1, 'damage', 'pending', 'Царапина на корпусе шуруповёрта после аренды.', NULL, NULL, NULL, NULL, NULL, '2026-04-23 18:56:04.601726', '2026-04-23 18:56:04.601726');


--
-- Data for Name: contact_balances; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.contact_balances VALUES (1, 2, 2, NULL, true, '2026-04-23 17:15:43.903');
INSERT INTO public.contact_balances VALUES (2, 6, 2, NULL, true, '2026-04-23 18:53:23.954962');


--
-- Data for Name: contact_purchases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.contact_purchases VALUES (1, 2, 'bonus', 0, 2, NULL, NULL, NULL, '2026-04-23 17:07:35.017462');
INSERT INTO public.contact_purchases VALUES (2, 2, 'single', 49, 1, NULL, 'stub', NULL, '2026-04-23 17:12:59.496696');
INSERT INTO public.contact_purchases VALUES (3, 6, 'bonus', 0, 2, NULL, NULL, NULL, '2026-04-23 18:53:23.957987');


--
-- Data for Name: listings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.listings VALUES (1, NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', 'Квадрокоптер DJI Mini 3 Pro с камерой 4K/60fps. В комплекте 3 аккумулятора, зарядная станция, кейс. Идеален для путешествий и съёмки мероприятий.', 2500.00, 15000.00, 150000.00, 6, NULL, NULL, false, 1, 'Москва', NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (2, NULL, 'MacBook Pro 16" M3 — ноутбук для работы', 'Apple MacBook Pro 16", чип M3 Pro, 36 ГБ RAM, 1 ТБ SSD. Для разработки, видеомонтажа, дизайна.', 3000.00, 120000.00, 1200000.00, 6, NULL, NULL, false, 1, 'Москва', NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (3, NULL, 'Проектор Epson + экран 120"', 'Проектор 3600 люмен, HDMI + USB, экран 120" в комплекте. Для конференций и домашнего кино.', 1500.00, 10000.00, 100000.00, 6, NULL, NULL, false, 1, 'Москва', NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (4, NULL, 'Sony A7 IV + объектив 24-70mm f/2.8', 'Полнокадровая беззеркалка 33 МП. Объектив Sony 24-70mm f/2.8, 2 акб, зарядка, сумка.', 3500.00, 80000.00, 800000.00, 9, NULL, NULL, false, 2, 'Санкт-Петербург', NULL, NULL, NULL, 2, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (5, NULL, 'Студийный свет — 3 моноблока 400 Вт', 'Студийный комплект: 3 моноблока, стойки, зонты, октабокс 80×80, синхронизатор.', 2000.00, 20000.00, 200000.00, 9, NULL, NULL, false, 2, 'Санкт-Петербург', NULL, NULL, NULL, 2, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (6, NULL, 'Стабилизатор DJI RS 3 для камеры', '3-осевой гимбал, нагрузка до 3 кг, Bluetooth, для любых камер.', 800.00, 12000.00, 120000.00, 9, NULL, NULL, false, 2, 'Санкт-Петербург', NULL, NULL, NULL, 2, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (7, NULL, 'Горные лыжи Rossignol + ботинки (р. 43-44)', 'Лыжи Rossignol 170 см с креплениями Look SPX 12. Ботинки р.43-44. Состояние хорошее.', 700.00, 8000.00, 80000.00, 2, NULL, NULL, false, 71, 'Екатеринбург', NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (8, NULL, 'Туристическая палатка на 4 человека', 'MSR Habitude 4, вес 3,5 кг, водостойкость 3000 мм. Трёхсезонная.', 600.00, 5000.00, 50000.00, 2, NULL, NULL, false, 71, 'Екатеринбург', NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (9, NULL, 'SUP-доска надувная 11 футов', 'Доска для сапсёрфинга с веслом, насосом и рюкзаком. Для рек, озёр, водохранилищ.', 900.00, 6000.00, 60000.00, 2, NULL, NULL, false, 71, 'Екатеринбург', NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (10, NULL, 'Перфоратор Bosch GBH 2-28 F', 'Мощный перфоратор 880 Вт, удар 3,2 Дж, 3 режима, SDS-plus. Набор бит в комплекте.', 500.00, 3000.00, 30000.00, 1, NULL, NULL, false, 1, 'Москва', NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (11, NULL, 'Лазерный уровень Bosch GLL 3-80', '3-плоскостной самовыравнивающийся лазерный нивелир, дальность 80 м, штатив в комплекте.', 700.00, 5000.00, 50000.00, 1, NULL, NULL, false, 1, 'Москва', NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (12, NULL, 'Фотобудка с принтером', 'Автоматическая фотобудка: камера, принтер, реквизит, фоны. Печать за 10 сек. Для свадеб и корпоративов.', 5000.00, 30000.00, 300000.00, 4, NULL, NULL, false, 2, 'Санкт-Петербург', NULL, NULL, NULL, 2, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (13, NULL, 'Детский велосипед 16" (рост 100-120 см)', 'Велосипед с боковыми колёсами, регулируемое сиденье и руль. Возраст 4-7 лет.', 200.00, 2000.00, 20000.00, 5, NULL, NULL, false, 20, 'Казань', NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (14, NULL, 'Детская коляска Bugaboo Fox 3', 'Универсальная 2в1: люлька + прогулочный блок. От рождения до 22 кг, всесезонная.', 350.00, 30000.00, 300000.00, 5, NULL, NULL, false, 20, 'Казань', NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings VALUES (16, 'ВТ-2026-000016', 'Старый велосипед', 'Продаю в аренду', 100.00, NULL, NULL, 1, NULL, 2000, false, 1, NULL, NULL, NULL, NULL, 2, '{}', false, true, '2026-04-23 17:14:33.321614');
INSERT INTO public.listings VALUES (15, 'ВТ-2026-000015', 'Тестовый дрель Bosch', 'Отличное состояние', 500.00, NULL, NULL, 1, NULL, 10000, false, 1, NULL, NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 17:14:33.127427');
INSERT INTO public.listings VALUES (17, 'ВТ-2026-000017', 'Тест спецтехники', 'проверка enum', 3000.00, NULL, NULL, 7, 'special_machinery', 25000, false, 1, NULL, NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 17:38:50.385921');
INSERT INTO public.listings VALUES (19, 'ВТ-2026-000019', 'Шуруповёрт Bosch GSR 18V Pro', 'Профессиональный аккумуляторный шуруповёрт. 2 аккумулятора 18V 4.0Ah. Кейс.', 280.00, NULL, NULL, 1, 'tools', 5600, false, 1, NULL, NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 18:51:42.230285');
INSERT INTO public.listings VALUES (20, 'ВТ-2026-000020', 'Палатка 4-местная Marmot', 'Всесезонная палатка. Двухслойная, водонепроницаемая 3000 мм. Для многодневных походов.', 650.00, NULL, NULL, 2, 'leisure', 9750, false, 1, NULL, NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 18:51:42.244276');
INSERT INTO public.listings VALUES (21, 'ВТ-2026-000021', 'Мотоблок Нева МБ-2Б', 'Мощный мотоблок для обработки огорода до 50 соток. Фрезы и плуг в комплекте.', 1200.00, NULL, NULL, 3, 'special_machinery', 12000, false, 2, NULL, NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 18:51:42.254616');
INSERT INTO public.listings VALUES (22, 'ВТ-2026-000022', 'Звуковая система JBL PRX825W', 'Профессиональная активная акустика. 2 колонки 15" + сабвуфер. Идеально для вечеринок.', 3500.00, NULL, NULL, 4, 'electronics', 25000, false, 2, NULL, NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 18:51:42.264361');
INSERT INTO public.listings VALUES (18, 'ВТ-2026-000018', 'Горный велосипед Trek 3500 (обновлён)', 'Отличный горный велосипед. Рама алюминиевая 21 скорость. Шлем и замок в комплекте.', 480.00, NULL, NULL, 2, 'leisure', 7200, false, 1, NULL, NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 18:51:42.213257');


--
-- Data for Name: contact_unlocks; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.contact_unlocks VALUES (1, 2, 1, 'balance', '2026-04-23 17:15:43.946527', NULL);


--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.favorites VALUES (1, 2, 3, '2026-04-23 17:10:42.980752');
INSERT INTO public.favorites VALUES (2, 2, 1, '2026-04-23 17:16:38.348552');


--
-- Data for Name: joint_purchases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.joint_purchases VALUES (1, 'Лазертаг-комплект для команды 10 человек', 'Набираем команду для аренды полного комплекта снаряжения на корпоратив. Лазертаг, жилеты, маски.', 15000.00, 0.00, 0, 'open', NULL, 'anna@example.com', NULL, '2026-04-23 18:54:24.216526');


--
-- Data for Name: newsletter; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.newsletter VALUES (1, 'test_newsletter@example.com', '2026-04-23 18:53:55.888326');


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notifications VALUES (2, 2, 'booking_submitted', '📤 Заявка отправлена — «MacBook Pro 16" M3 — ноутбук для работы»', 'Ваша заявка ХТ-2026-000002 на аренду отправлена владельцу. Ожидайте подтверждения.', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:08:51.968871');
INSERT INTO public.notifications VALUES (3, 2, 'booking_confirmed', '✅ Заявка подтверждена — «MacBook Pro 16" M3 — ноутбук для работы»', 'Владелец подтвердил вашу заявку ХТ-2026-000002. Договоритесь о встрече для передачи вещи.', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:10:16.855694');
INSERT INTO public.notifications VALUES (4, 2, 'booking_active', '🤝 Вещь передана — «MacBook Pro 16" M3 — ноутбук для работы»', 'Владелец подтвердил передачу вещи по заявке ХТ-2026-000002. Аренда началась! Когда вернёте — нажмите «Возвращаю вещь».', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:10:17.044001');
INSERT INTO public.notifications VALUES (7, 2, 'booking_completed', '🏆 Сделка завершена — «MacBook Pro 16" M3 — ноутбук для работы»', 'Спасибо за аренду! Заявка ХТ-2026-000002 завершена и добавлена в историю.', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:10:17.439794');
INSERT INTO public.notifications VALUES (1, 1, 'booking_created', '📬 Новая заявка — «MacBook Pro 16" M3 — ноутбук для работы»', 'Мария Соколова хочет взять вещь на 4 дней (2026-06-01 — 2026-06-05).', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:08:51.963401');
INSERT INTO public.notifications VALUES (5, 1, 'booking_return_pending', '📦 Арендатор возвращает вещь — «MacBook Pro 16" M3 — ноутбук для работы»', 'Арендатор инициировал возврат по заявке ХТ-2026-000002. Встретьтесь и подтвердите получение вещи.', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:10:17.238354');
INSERT INTO public.notifications VALUES (6, 1, 'booking_completed', '🏆 Сделка завершена — «MacBook Pro 16" M3 — ноутбук для работы»', 'Аренда по заявке ХТ-2026-000002 успешно закрыта. Сделка добавлена в историю.', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:10:17.437263');
INSERT INTO public.notifications VALUES (8, 1, 'booking_created', '📞 Прямой запрос контактов — «Горный велосипед Trek 3500»', 'Анна Козлова оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', 3, 'Горный велосипед Trek 3500', false, '2026-04-23 18:52:02.27426');
INSERT INTO public.notifications VALUES (9, 6, 'booking_submitted', '📞 Контакты открыты — «Горный велосипед Trek 3500»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', 3, 'Горный велосипед Trek 3500', false, '2026-04-23 18:52:02.276467');
INSERT INTO public.notifications VALUES (10, 1, 'booking_created', '📬 Новая заявка — «Шуруповёрт Bosch GSR 18V Pro»', 'Анна Козлова хочет взять вещь на 2 дней (2026-05-10 — 2026-05-12).', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:52:02.292304');
INSERT INTO public.notifications VALUES (11, 6, 'booking_submitted', '📤 Заявка отправлена — «Шуруповёрт Bosch GSR 18V Pro»', 'Ваша заявка ХТ-2026-000004 на аренду отправлена владельцу. Ожидайте подтверждения.', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:52:02.294265');
INSERT INTO public.notifications VALUES (12, 3, 'booking_created', '📞 Прямой запрос контактов — «Мотоблок Нева МБ-2Б»', 'Ирина Новикова оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', 5, 'Мотоблок Нева МБ-2Б', false, '2026-04-23 18:52:02.306839');
INSERT INTO public.notifications VALUES (13, 4, 'booking_submitted', '📞 Контакты открыты — «Мотоблок Нева МБ-2Б»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', 5, 'Мотоблок Нева МБ-2Б', false, '2026-04-23 18:52:02.308757');
INSERT INTO public.notifications VALUES (14, 1, 'booking_created', '📬 Новая заявка — «Палатка 4-местная Marmot»', 'Сергей Волков хочет взять вещь на 6 дней (2026-06-01 — 2026-06-07).', 6, 'Палатка 4-местная Marmot', false, '2026-04-23 18:52:02.322054');
INSERT INTO public.notifications VALUES (15, 5, 'booking_submitted', '📤 Заявка отправлена — «Палатка 4-местная Marmot»', 'Ваша заявка ХТ-2026-000006 на аренду отправлена владельцу. Ожидайте подтверждения.', 6, 'Палатка 4-местная Marmot', false, '2026-04-23 18:52:02.324591');
INSERT INTO public.notifications VALUES (16, 3, 'booking_created', '📬 Новая заявка — «Звуковая система JBL PRX825W»', 'Ирина Новикова хочет взять вещь на 2 дней (2026-07-15 — 2026-07-17).', 7, 'Звуковая система JBL PRX825W', false, '2026-04-23 18:52:02.33839');
INSERT INTO public.notifications VALUES (17, 4, 'booking_submitted', '📤 Заявка отправлена — «Звуковая система JBL PRX825W»', 'Ваша заявка ХТ-2026-000007 на аренду отправлена владельцу. Ожидайте подтверждения.', 7, 'Звуковая система JBL PRX825W', false, '2026-04-23 18:52:02.341142');
INSERT INTO public.notifications VALUES (18, 6, 'booking_confirmed', '✅ Заявка подтверждена — «Шуруповёрт Bosch GSR 18V Pro»', 'Владелец подтвердил вашу заявку ХТ-2026-000004. Договоритесь о встрече для передачи вещи.', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:52:02.358518');
INSERT INTO public.notifications VALUES (19, 6, 'booking_active', '🤝 Вещь передана — «Шуруповёрт Bosch GSR 18V Pro»', 'Владелец подтвердил передачу вещи по заявке ХТ-2026-000004. Аренда началась! Когда вернёте — нажмите «Возвращаю вещь».', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:53:09.437695');
INSERT INTO public.notifications VALUES (20, 1, 'booking_return_pending', '📦 Арендатор возвращает вещь — «Шуруповёрт Bosch GSR 18V Pro»', 'Арендатор инициировал возврат по заявке ХТ-2026-000004. Встретьтесь и подтвердите получение вещи.', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:53:09.452997');
INSERT INTO public.notifications VALUES (21, 1, 'booking_completed', '🏆 Сделка завершена — «Шуруповёрт Bosch GSR 18V Pro»', 'Аренда по заявке ХТ-2026-000004 успешно закрыта. Сделка добавлена в историю.', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:53:09.47808');
INSERT INTO public.notifications VALUES (22, 6, 'booking_completed', '🏆 Сделка завершена — «Шуруповёрт Bosch GSR 18V Pro»', 'Спасибо за аренду! Заявка ХТ-2026-000004 завершена и добавлена в историю.', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:53:09.480729');
INSERT INTO public.notifications VALUES (23, 1, 'booking_created', '📬 Новая заявка — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест хочет взять вещь на 1 день (2026-12-31 — 2026-01-01).', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:00:57.274383');
INSERT INTO public.notifications VALUES (24, 6, 'booking_submitted', '📤 Заявка отправлена — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Ваша заявка ХТ-2026-000008 на аренду отправлена владельцу. Ожидайте подтверждения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:00:57.276867');
INSERT INTO public.notifications VALUES (25, 1, 'booking_created', '📬 Новая заявка — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест хочет взять вещь на 4 дней (2020-01-01 — 2020-01-05).', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:00:57.295477');
INSERT INTO public.notifications VALUES (26, 6, 'booking_submitted', '📤 Заявка отправлена — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Ваша заявка ХТ-2026-000009 на аренду отправлена владельцу. Ожидайте подтверждения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:00:57.298635');
INSERT INTO public.notifications VALUES (27, 1, 'booking_created', '📬 Новая заявка — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест хочет взять вещь на 2 дней (2026-06-15 — 2026-06-17).', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:02:09.975977');
INSERT INTO public.notifications VALUES (28, 6, 'booking_submitted', '📤 Заявка отправлена — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Ваша заявка ХТ-2026-000010 на аренду отправлена владельцу. Ожидайте подтверждения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:02:09.979127');
INSERT INTO public.notifications VALUES (29, 1, 'booking_created', '📞 Прямой запрос контактов — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:03:28.836016');
INSERT INTO public.notifications VALUES (30, 6, 'booking_submitted', '📞 Контакты открыты — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:03:28.839368');
INSERT INTO public.notifications VALUES (31, 1, 'booking_created', '📞 Прямой запрос контактов — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:03:28.85448');
INSERT INTO public.notifications VALUES (32, 6, 'booking_submitted', '📞 Контакты открыты — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:03:28.857286');
INSERT INTO public.notifications VALUES (33, 1, 'booking_created', '📞 Прямой запрос контактов — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:05:55.887827');
INSERT INTO public.notifications VALUES (34, 6, 'booking_submitted', '📞 Контакты открыты — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:05:55.891063');
INSERT INTO public.notifications VALUES (35, 1, 'booking_created', '📬 Новая заявка — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест хочет взять вещь на 2 дней (2026-09-01 — 2026-09-03).', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:05:55.908613');
INSERT INTO public.notifications VALUES (36, 6, 'booking_submitted', '📤 Заявка отправлена — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Ваша заявка ХТ-2026-000014 на аренду отправлена владельцу. Ожидайте подтверждения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:05:55.910828');
INSERT INTO public.notifications VALUES (37, 1, 'booking_created', '📞 Прямой запрос контактов — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:06:12.835447');
INSERT INTO public.notifications VALUES (38, 6, 'booking_submitted', '📞 Контакты открыты — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:06:12.838248');


--
-- Data for Name: payout_methods; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: payout_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.platform_settings VALUES (1, 10.00, 6.00, 5.00, 100, 5.00, 100, 2.00, 1500, 50, 20, 15, 10, 25000, 3, 199, 349, 599, 99, 199, 49, 499, 1990, 5.00, 3.00, true, 10, true, 'after_payment', 49, 299, 699, 2, 0, true, 7, true, 'protected_first', 60, true, 'self_employed', false, NULL, true, false, NULL, false, NULL, '2026-04-23 18:54:24.228', 7);


--
-- Data for Name: regions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.regions VALUES (1, 'Москва', 'moscow');
INSERT INTO public.regions VALUES (2, 'Санкт-Петербург', 'spb');
INSERT INTO public.regions VALUES (3, 'Севастополь', 'sevastopol');
INSERT INTO public.regions VALUES (4, 'Республика Адыгея', 'adygea');
INSERT INTO public.regions VALUES (5, 'Республика Алтай', 'altai-rep');
INSERT INTO public.regions VALUES (6, 'Республика Башкортостан', 'bashkortostan');
INSERT INTO public.regions VALUES (7, 'Республика Бурятия', 'buryatia');
INSERT INTO public.regions VALUES (8, 'Республика Дагестан', 'dagestan');
INSERT INTO public.regions VALUES (9, 'Республика Ингушетия', 'ingushetia');
INSERT INTO public.regions VALUES (10, 'Кабардино-Балкарская Республика', 'kabardino-balkaria');
INSERT INTO public.regions VALUES (11, 'Республика Калмыкия', 'kalmykia');
INSERT INTO public.regions VALUES (12, 'Карачаево-Черкесская Республика', 'karachay-cherkessia');
INSERT INTO public.regions VALUES (13, 'Республика Карелия', 'karelia');
INSERT INTO public.regions VALUES (14, 'Республика Коми', 'komi');
INSERT INTO public.regions VALUES (15, 'Республика Крым', 'crimea');
INSERT INTO public.regions VALUES (16, 'Республика Марий Эл', 'mari-el');
INSERT INTO public.regions VALUES (17, 'Республика Мордовия', 'mordovia');
INSERT INTO public.regions VALUES (18, 'Республика Саха (Якутия)', 'sakha');
INSERT INTO public.regions VALUES (19, 'Республика Северная Осетия — Алания', 'north-ossetia');
INSERT INTO public.regions VALUES (20, 'Республика Татарстан', 'tatarstan');
INSERT INTO public.regions VALUES (21, 'Республика Тыва', 'tuva');
INSERT INTO public.regions VALUES (22, 'Удмуртская Республика', 'udmurtia');
INSERT INTO public.regions VALUES (23, 'Республика Хакасия', 'khakassia');
INSERT INTO public.regions VALUES (24, 'Чеченская Республика', 'chechnya');
INSERT INTO public.regions VALUES (25, 'Чувашская Республика', 'chuvashia');
INSERT INTO public.regions VALUES (26, 'Алтайский край', 'altai-krai');
INSERT INTO public.regions VALUES (27, 'Забайкальский край', 'zabaykalsky');
INSERT INTO public.regions VALUES (28, 'Камчатский край', 'kamchatka');
INSERT INTO public.regions VALUES (29, 'Краснодарский край', 'krasnodar');
INSERT INTO public.regions VALUES (30, 'Красноярский край', 'krasnoyarsk');
INSERT INTO public.regions VALUES (31, 'Пермский край', 'perm');
INSERT INTO public.regions VALUES (32, 'Приморский край', 'primorsky');
INSERT INTO public.regions VALUES (33, 'Ставропольский край', 'stavropol');
INSERT INTO public.regions VALUES (34, 'Хабаровский край', 'khabarovsk');
INSERT INTO public.regions VALUES (35, 'Амурская область', 'amur');
INSERT INTO public.regions VALUES (36, 'Архангельская область', 'arkhangelsk');
INSERT INTO public.regions VALUES (37, 'Астраханская область', 'astrakhan');
INSERT INTO public.regions VALUES (38, 'Белгородская область', 'belgorod');
INSERT INTO public.regions VALUES (39, 'Брянская область', 'bryansk');
INSERT INTO public.regions VALUES (40, 'Владимирская область', 'vladimir');
INSERT INTO public.regions VALUES (41, 'Волгоградская область', 'volgograd');
INSERT INTO public.regions VALUES (42, 'Вологодская область', 'vologda');
INSERT INTO public.regions VALUES (43, 'Воронежская область', 'voronezh');
INSERT INTO public.regions VALUES (44, 'Ивановская область', 'ivanovo');
INSERT INTO public.regions VALUES (45, 'Иркутская область', 'irkutsk');
INSERT INTO public.regions VALUES (46, 'Калининградская область', 'kaliningrad');
INSERT INTO public.regions VALUES (47, 'Калужская область', 'kaluga');
INSERT INTO public.regions VALUES (48, 'Кемеровская область', 'kemerovo');
INSERT INTO public.regions VALUES (49, 'Кировская область', 'kirov');
INSERT INTO public.regions VALUES (50, 'Костромская область', 'kostroma');
INSERT INTO public.regions VALUES (51, 'Курганская область', 'kurgan');
INSERT INTO public.regions VALUES (52, 'Курская область', 'kursk');
INSERT INTO public.regions VALUES (53, 'Ленинградская область', 'leningrad-obl');
INSERT INTO public.regions VALUES (54, 'Липецкая область', 'lipetsk');
INSERT INTO public.regions VALUES (55, 'Магаданская область', 'magadan');
INSERT INTO public.regions VALUES (56, 'Московская область', 'moscow-obl');
INSERT INTO public.regions VALUES (57, 'Мурманская область', 'murmansk');
INSERT INTO public.regions VALUES (58, 'Нижегородская область', 'nizhny-novgorod');
INSERT INTO public.regions VALUES (59, 'Новгородская область', 'novgorod-obl');
INSERT INTO public.regions VALUES (60, 'Новосибирская область', 'novosibirsk');
INSERT INTO public.regions VALUES (61, 'Омская область', 'omsk');
INSERT INTO public.regions VALUES (62, 'Оренбургская область', 'orenburg');
INSERT INTO public.regions VALUES (63, 'Орловская область', 'oryol');
INSERT INTO public.regions VALUES (64, 'Пензенская область', 'penza');
INSERT INTO public.regions VALUES (65, 'Псковская область', 'pskov');
INSERT INTO public.regions VALUES (66, 'Ростовская область', 'rostov');
INSERT INTO public.regions VALUES (67, 'Рязанская область', 'ryazan');
INSERT INTO public.regions VALUES (68, 'Самарская область', 'samara');
INSERT INTO public.regions VALUES (69, 'Саратовская область', 'saratov');
INSERT INTO public.regions VALUES (70, 'Сахалинская область', 'sakhalin');
INSERT INTO public.regions VALUES (71, 'Свердловская область', 'sverdlovsk');
INSERT INTO public.regions VALUES (72, 'Смоленская область', 'smolensk');
INSERT INTO public.regions VALUES (73, 'Тамбовская область', 'tambov');
INSERT INTO public.regions VALUES (74, 'Тверская область', 'tver');
INSERT INTO public.regions VALUES (75, 'Томская область', 'tomsk');
INSERT INTO public.regions VALUES (76, 'Тульская область', 'tula');
INSERT INTO public.regions VALUES (77, 'Тюменская область', 'tyumen');
INSERT INTO public.regions VALUES (78, 'Ульяновская область', 'ulyanovsk');
INSERT INTO public.regions VALUES (79, 'Челябинская область', 'chelyabinsk');
INSERT INTO public.regions VALUES (80, 'Ярославская область', 'yaroslavl');
INSERT INTO public.regions VALUES (81, 'Еврейская автономная область', 'jewish-ao');
INSERT INTO public.regions VALUES (82, 'Ненецкий автономный округ', 'nenets');
INSERT INTO public.regions VALUES (83, 'Ханты-Мансийский автономный округ', 'khanty-mansiysk');
INSERT INTO public.regions VALUES (84, 'Чукотский автономный округ', 'chukotka');
INSERT INTO public.regions VALUES (85, 'Ямало-Ненецкий автономный округ', 'yamal');
INSERT INTO public.regions VALUES (89, 'Свердловская область', 'ekaterinburg');
INSERT INTO public.regions VALUES (90, 'Республика Татарстан', 'kazan');
INSERT INTO public.regions VALUES (97, 'Республика Башкортостан', 'ufa');
INSERT INTO public.regions VALUES (105, 'Приморский край', 'vladivostok');


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.reports VALUES (1, 2, 'listing', 3, NULL, 'spam', 'Тест жалобы', 'pending', NULL, NULL, NULL, '2026-04-23 17:10:42.809911');


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.reviews VALUES (1, 2, 2, 'ХТ-2026-000002', 'listing', 'renter', 2, 1, 5, 'Отличная аренда, рекомендую!', NULL, NULL, '2026-04-23 17:14:59.358768');
INSERT INTO public.reviews VALUES (2, NULL, 2, 'ХТ-2026-000002', 'renter', 'owner', 1, 2, 4, 'Хороший арендатор, верну вещи в срок', NULL, NULL, '2026-04-23 17:15:17.259088');
INSERT INTO public.reviews VALUES (3, 19, 4, 'ХТ-2026-000004', 'listing', 'renter', 6, 1, 5, 'Отличный шуруповёрт! Алексей очень оперативный, всё прошло гладко. Рекомендую!', NULL, NULL, '2026-04-23 18:53:55.855021');
INSERT INTO public.reviews VALUES (4, NULL, 4, 'ХТ-2026-000004', 'renter', 'owner', 1, 6, 5, 'Анна — надёжный арендатор. Вернула в идеальном состоянии и в срок.', NULL, NULL, '2026-04-23 18:53:55.865009');


--
-- Data for Name: support_messages; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.support_messages VALUES (1, 1, 6, 'Кнопка «Завершить» не активна, бронь в статусе active уже 3 дня. Номер брони ХТ-2026-000004.', false, '2026-04-23 18:55:29.313408');


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.support_tickets VALUES (1, 'TKT-2026-000001', 6, 'Не могу завершить бронирование', 'general', 'open', 'normal', NULL, NULL, '2026-04-23 18:55:29.306322', '2026-04-23 18:55:29.306322');


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_audit_log_id_seq', 6, true);


--
-- Name: auth_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auth_sessions_id_seq', 31, true);


--
-- Name: booking_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.booking_events_id_seq', 23, true);


--
-- Name: booking_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.booking_messages_id_seq', 4, true);


--
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bookings_id_seq', 15, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 20, true);


--
-- Name: claims_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.claims_id_seq', 1, true);


--
-- Name: contact_balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contact_balances_id_seq', 2, true);


--
-- Name: contact_purchases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contact_purchases_id_seq', 3, true);


--
-- Name: contact_unlocks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contact_unlocks_id_seq', 1, true);


--
-- Name: favorites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.favorites_id_seq', 2, true);


--
-- Name: joint_purchases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.joint_purchases_id_seq', 1, true);


--
-- Name: listings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.listings_id_seq', 22, true);


--
-- Name: newsletter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.newsletter_id_seq', 1, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 38, true);


--
-- Name: payout_methods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payout_methods_id_seq', 1, false);


--
-- Name: payout_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payout_requests_id_seq', 1, false);


--
-- Name: platform_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.platform_settings_id_seq', 1, true);


--
-- Name: regions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.regions_id_seq', 133, true);


--
-- Name: reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reports_id_seq', 1, true);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reviews_id_seq', 4, true);


--
-- Name: support_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_messages_id_seq', 1, true);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_tickets_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 10, true);


--
-- PostgreSQL database dump complete
--

\unrestrict pl3UfXhsshTI9Nmk2PooT7oOvanNssHe8N5sPPhIjGgaUfZ5gXdwnGkvQJNwq4X

