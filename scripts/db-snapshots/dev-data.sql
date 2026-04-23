--
-- PostgreSQL database dump
--

\restrict tdo8KHOocdLlt8xZ1npWRx8o4222pTBZAhU21cg4gGUohKGbLIculW2FYdiJkCZ

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

INSERT INTO public.users (id, name, email, password_hash, role, phone, avatar, bio, telegram, website, region_id, completed_deals_count, is_banned, ban_reason, created_at) VALUES (3, 'Дмитрий Захаров', 'dmitry@example.com', '$2b$10$boFxyBz.mxuxt.cLJp1ZcOXZo0FXH.IYBViktGCGlKvOSc4A7Acny', 'owner', '+7 (343) 555-44-33', NULL, 'Сдаю спортивное снаряжение и товары для отдыха на природе.', NULL, NULL, 71, 0, false, NULL, '2026-04-23 15:06:02.848668');
INSERT INTO public.users (id, name, email, password_hash, role, phone, avatar, bio, telegram, website, region_id, completed_deals_count, is_banned, ban_reason, created_at) VALUES (4, 'Ирина Новикова', 'irina@example.com', '$2b$10$uVmDwuwm5G5wlUNHNIA.AO2ldddMHaE2aHPyXuNkC26bR21sfypvW', 'renter', '+7 (963) 111-22-33', NULL, NULL, NULL, NULL, 1, 0, false, NULL, '2026-04-23 15:06:03.166003');
INSERT INTO public.users (id, name, email, password_hash, role, phone, avatar, bio, telegram, website, region_id, completed_deals_count, is_banned, ban_reason, created_at) VALUES (5, 'Сергей Волков', 'sergey@example.com', '$2b$10$jNxhibTenj0QlvLR5B.Ex.TZjQojOMw23tgBoDYbC/khxSJOi0uwy', 'renter', '+7 (921) 444-55-66', NULL, NULL, NULL, NULL, 2, 0, false, NULL, '2026-04-23 15:06:03.166003');
INSERT INTO public.users (id, name, email, password_hash, role, phone, avatar, bio, telegram, website, region_id, completed_deals_count, is_banned, ban_reason, created_at) VALUES (7, 'Администратор', 'admin@test.ru', '$2b$10$zG8j1wDT18n17u.3oPMbfutQSMPcllsDz.7rxiFOqa68Q4MGECa46', 'admin', '+7 (000) 000-00-00', NULL, NULL, NULL, NULL, 1, 0, false, NULL, '2026-04-23 15:06:03.166003');
INSERT INTO public.users (id, name, email, password_hash, role, phone, avatar, bio, telegram, website, region_id, completed_deals_count, is_banned, ban_reason, created_at) VALUES (2, 'Мария Соколова', 'maria@example.com', '$2b$10$BN7hWmFwCflPxNRTHSBI7.KEnMJAHh4ADHctySdNSKcE/Ar1yPOze', 'owner', '+7 (812) 987-65-43', NULL, 'Фотограф. Сдаю профессиональное оборудование для съёмок.', '@maria_photo', NULL, 2, 1, false, 'Тест бана', '2026-04-23 15:06:02.766712');
INSERT INTO public.users (id, name, email, password_hash, role, phone, avatar, bio, telegram, website, region_id, completed_deals_count, is_banned, ban_reason, created_at) VALUES (1, 'Алексей Петров', 'alexey@example.com', '$2b$10$Jt/DNGYGGi.qBh18S.Y7lOrvQcueIiaREdejTiA2UjbVcV0/y9qVG', 'owner', '+7 (916) 123-45-67', NULL, 'Сдаю технику и инструменты уже 3 года. Всё в отличном состоянии.', '@alexey_rents', NULL, 1, 2, false, NULL, '2026-04-23 15:06:02.682791');
INSERT INTO public.users (id, name, email, password_hash, role, phone, avatar, bio, telegram, website, region_id, completed_deals_count, is_banned, ban_reason, created_at) VALUES (6, 'Анна Козлова-Тест', 'anna@example.com', '$2b$10$ayi44cN3suJCDmBtD8qUG.a/iw8VBivStF1kCFXPiRkhgnX/bYok2', 'renter', '+7 (383) 777-88-99', NULL, 'Арендую вещи для дачи и путешествий.', 'anna_test', NULL, 1, 1, false, NULL, '2026-04-23 15:06:03.166003');


--
-- Data for Name: admin_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.admin_audit_log (id, admin_id, entity_type, entity_id, action, detail, created_at) VALUES (1, 7, 'platform_settings', 1, 'update', '["serviceFeePercent","taxFeePercent","freeListingsEnabled","contactLifetimeDays"]', '2026-04-23 17:17:57.753338');
INSERT INTO public.admin_audit_log (id, admin_id, entity_type, entity_id, action, detail, created_at) VALUES (2, 7, 'user', 2, 'ban_user', 'Changed: isBanned, banReason. Reason: Тест бана', '2026-04-23 17:18:30.519095');
INSERT INTO public.admin_audit_log (id, admin_id, entity_type, entity_id, action, detail, created_at) VALUES (3, 7, 'user', 2, 'unban_user', 'Changed: isBanned', '2026-04-23 17:18:30.674013');
INSERT INTO public.admin_audit_log (id, admin_id, entity_type, entity_id, action, detail, created_at) VALUES (4, 7, 'listing', 15, 'edit_listing', 'Changed: isAvailable', '2026-04-23 17:19:21.311743');
INSERT INTO public.admin_audit_log (id, admin_id, entity_type, entity_id, action, detail, created_at) VALUES (5, 7, 'listing', 15, 'edit_listing', 'Changed: isAvailable', '2026-04-23 17:19:21.435216');
INSERT INTO public.admin_audit_log (id, admin_id, entity_type, entity_id, action, detail, created_at) VALUES (6, 7, 'platform_settings', 1, 'update', '["serviceFeePercent","taxFeePercent","contactPriceSingle"]', '2026-04-23 18:54:24.231548');


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.bookings (id, booking_number, listing_id, renter_id, owner_id, start_date, end_date, total_days, total_price, rent_amount, service_fee, tax_fee, fund_contribution, renter_fund_contribution, deposit_amount, owner_payout, protection_enabled, renter_protection_enabled, status, claim_status, message, owner_comment, created_at) VALUES (1, 'ХТ-2026-000001', 2, 2, 1, '2026-05-10', '2026-05-15', 5, 15750.00, 15000.00, 1500.00, 900.00, 750.00, 750.00, 120000.00, 11850.00, true, true, 'pending', 'none', 'Тестовое бронирование', NULL, '2026-04-23 17:07:35.096421');
INSERT INTO public.bookings (id, booking_number, listing_id, renter_id, owner_id, start_date, end_date, total_days, total_price, rent_amount, service_fee, tax_fee, fund_contribution, renter_fund_contribution, deposit_amount, owner_payout, protection_enabled, renter_protection_enabled, status, claim_status, message, owner_comment, created_at) VALUES (2, 'ХТ-2026-000002', 2, 2, 1, '2026-06-01', '2026-06-05', 4, 12600.00, 12000.00, 1200.00, 720.00, 600.00, 600.00, 120000.00, 9480.00, true, true, 'completed', 'none', 'Тест фикса уведомлений', NULL, '2026-04-23 17:08:51.919341');
INSERT INTO public.bookings (id, booking_number, listing_id, renter_id, owner_id, start_date, end_date, total_days, total_price, rent_amount, service_fee, tax_fee, fund_contribution, renter_fund_contribution, deposit_amount, owner_payout, protection_enabled, renter_protection_enabled, status, claim_status, message, owner_comment, created_at) VALUES (3, 'ХТ-2026-000003', 18, 6, 1, '2026-05-03', '2026-05-05', 2, 49.00, 900.00, 0.00, 0.00, 0.00, NULL, 0.00, NULL, false, false, 'confirmed', 'none', NULL, NULL, '2026-04-23 18:52:02.264795');
INSERT INTO public.bookings (id, booking_number, listing_id, renter_id, owner_id, start_date, end_date, total_days, total_price, rent_amount, service_fee, tax_fee, fund_contribution, renter_fund_contribution, deposit_amount, owner_payout, protection_enabled, renter_protection_enabled, status, claim_status, message, owner_comment, created_at) VALUES (5, 'ХТ-2026-000005', 21, 4, 3, '2026-05-20', '2026-05-22', 2, 49.00, 2400.00, 0.00, 0.00, 0.00, NULL, 0.00, NULL, false, false, 'confirmed', 'none', NULL, NULL, '2026-04-23 18:52:02.299643');
INSERT INTO public.bookings (id, booking_number, listing_id, renter_id, owner_id, start_date, end_date, total_days, total_price, rent_amount, service_fee, tax_fee, fund_contribution, renter_fund_contribution, deposit_amount, owner_payout, protection_enabled, renter_protection_enabled, status, claim_status, message, owner_comment, created_at) VALUES (6, 'ХТ-2026-000006', 20, 5, 1, '2026-06-01', '2026-06-07', 6, 4095.00, 3900.00, 390.00, 0.00, 195.00, 195.00, 1500.00, 3315.00, true, true, 'pending', 'none', NULL, NULL, '2026-04-23 18:52:02.314625');
INSERT INTO public.bookings (id, booking_number, listing_id, renter_id, owner_id, start_date, end_date, total_days, total_price, rent_amount, service_fee, tax_fee, fund_contribution, renter_fund_contribution, deposit_amount, owner_payout, protection_enabled, renter_protection_enabled, status, claim_status, message, owner_comment, created_at) VALUES (7, 'ХТ-2026-000007', 22, 4, 3, '2026-07-15', '2026-07-17', 2, 7350.00, 7000.00, 700.00, 0.00, 350.00, 350.00, 7000.00, 5950.00, true, true, 'pending', 'none', NULL, NULL, '2026-04-23 18:52:02.330366');
INSERT INTO public.bookings (id, booking_number, listing_id, renter_id, owner_id, start_date, end_date, total_days, total_price, rent_amount, service_fee, tax_fee, fund_contribution, renter_fund_contribution, deposit_amount, owner_payout, protection_enabled, renter_protection_enabled, status, claim_status, message, owner_comment, created_at) VALUES (4, 'ХТ-2026-000004', 19, 6, 1, '2026-05-10', '2026-05-12', 2, 660.00, 560.00, 56.00, 0.00, 100.00, 100.00, 1500.00, 404.00, true, true, 'completed', 'none', NULL, NULL, '2026-04-23 18:52:02.283982');


--
-- Data for Name: booking_events; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (1, 1, 'ХТ-2026-000001', 2, 'renter', 'created', NULL, 'pending', 'Тестовое бронирование', '2026-04-23 17:07:35.103131');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (2, 2, 'ХТ-2026-000002', 2, 'renter', 'created', NULL, 'pending', 'Тест фикса уведомлений', '2026-04-23 17:08:51.959913');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (3, 2, 'ХТ-2026-000002', 1, 'owner', 'status_changed', 'pending', 'confirmed', NULL, '2026-04-23 17:10:16.852142');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (4, 2, 'ХТ-2026-000002', 1, 'owner', 'status_changed', 'confirmed', 'active', NULL, '2026-04-23 17:10:17.042051');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (5, 2, 'ХТ-2026-000002', 1, 'owner', 'status_changed', 'active', 'return_pending', NULL, '2026-04-23 17:10:17.235535');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (6, 2, 'ХТ-2026-000002', 1, 'owner', 'status_changed', 'return_pending', 'completed', NULL, '2026-04-23 17:10:17.433737');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (7, 3, 'ХТ-2026-000003', 6, 'renter', 'direct_contact_opened', NULL, 'confirmed', 'Прямой расчёт: оплачено 49 ₽ за открытие контактов', '2026-04-23 18:52:02.271269');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (8, 4, 'ХТ-2026-000004', 6, 'renter', 'created', NULL, 'pending', NULL, '2026-04-23 18:52:02.289752');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (9, 5, 'ХТ-2026-000005', 4, 'renter', 'direct_contact_opened', NULL, 'confirmed', 'Прямой расчёт: оплачено 49 ₽ за открытие контактов', '2026-04-23 18:52:02.30455');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (10, 6, 'ХТ-2026-000006', 5, 'renter', 'created', NULL, 'pending', NULL, '2026-04-23 18:52:02.319509');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (11, 7, 'ХТ-2026-000007', 4, 'renter', 'created', NULL, 'pending', NULL, '2026-04-23 18:52:02.335584');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (12, 4, 'ХТ-2026-000004', 1, 'owner', 'status_changed', 'pending', 'confirmed', NULL, '2026-04-23 18:52:02.356605');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (13, 4, 'ХТ-2026-000004', 1, 'owner', 'status_changed', 'confirmed', 'active', NULL, '2026-04-23 18:53:09.434897');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (14, 4, 'ХТ-2026-000004', 6, 'renter', 'status_changed', 'active', 'return_pending', NULL, '2026-04-23 18:53:09.449993');
INSERT INTO public.booking_events (id, booking_id, booking_number, actor_id, actor_role, event_type, from_status, to_status, comment, created_at) VALUES (15, 4, 'ХТ-2026-000004', 1, 'owner', 'status_changed', 'return_pending', 'completed', NULL, '2026-04-23 18:53:09.475297');


--
-- Data for Name: booking_messages; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.booking_messages (id, booking_id, sender_id, content, is_read, created_at) VALUES (1, 2, 2, 'Привет, подтвердите пожалуйста бронирование!', false, '2026-04-23 17:10:43.493203');
INSERT INTO public.booking_messages (id, booking_id, sender_id, content, is_read, created_at) VALUES (2, 2, 2, 'Добрый день, когда забрать?', false, '2026-04-23 17:20:37.167341');
INSERT INTO public.booking_messages (id, booking_id, sender_id, content, is_read, created_at) VALUES (3, 4, 6, 'Привет! Когда можно забрать шуруповёрт?', false, '2026-04-23 18:52:38.782658');
INSERT INTO public.booking_messages (id, booking_id, sender_id, content, is_read, created_at) VALUES (4, 4, 1, 'Добрый день! В любой день с 10 до 18. Звоните за час.', true, '2026-04-23 18:52:38.818247');


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.categories (id, name, slug, icon) VALUES (1, 'Стройка и ремонт', 'construction', '🔨');
INSERT INTO public.categories (id, name, slug, icon) VALUES (2, 'Туризм и спорт', 'tourism', '⛺');
INSERT INTO public.categories (id, name, slug, icon) VALUES (3, 'Сад и огород', 'garden', '🌱');
INSERT INTO public.categories (id, name, slug, icon) VALUES (4, 'Праздники', 'holidays', '🎉');
INSERT INTO public.categories (id, name, slug, icon) VALUES (5, 'Детские товары', 'children', '👶');
INSERT INTO public.categories (id, name, slug, icon) VALUES (6, 'Электроника', 'electronics', '💻');
INSERT INTO public.categories (id, name, slug, icon) VALUES (7, 'Авто и мото', 'auto', '🚗');
INSERT INTO public.categories (id, name, slug, icon) VALUES (8, 'Одежда и обувь', 'clothing', '👗');
INSERT INTO public.categories (id, name, slug, icon) VALUES (9, 'Фото и видео', 'photo', '📷');
INSERT INTO public.categories (id, name, slug, icon) VALUES (10, 'Книги и учёба', 'books', '📚');


--
-- Data for Name: claims; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.claims (id, booking_id, claimant_id, type, status, description, evidence_url, admin_note, requested_amount, approved_amount, resolved_at, created_at, updated_at) VALUES (1, 4, 1, 'damage', 'pending', 'Царапина на корпусе шуруповёрта после аренды.', NULL, NULL, NULL, NULL, NULL, '2026-04-23 18:56:04.601726', '2026-04-23 18:56:04.601726');


--
-- Data for Name: contact_balances; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.contact_balances (id, user_id, balance, unlimited_until, bonus_granted, updated_at) VALUES (1, 2, 2, NULL, true, '2026-04-23 17:15:43.903');
INSERT INTO public.contact_balances (id, user_id, balance, unlimited_until, bonus_granted, updated_at) VALUES (2, 6, 2, NULL, true, '2026-04-23 18:53:23.954962');


--
-- Data for Name: contact_purchases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.contact_purchases (id, user_id, kind, amount_rub, contacts_added, expires_at, payment_ref, refunded_at, created_at) VALUES (1, 2, 'bonus', 0, 2, NULL, NULL, NULL, '2026-04-23 17:07:35.017462');
INSERT INTO public.contact_purchases (id, user_id, kind, amount_rub, contacts_added, expires_at, payment_ref, refunded_at, created_at) VALUES (2, 2, 'single', 49, 1, NULL, 'stub', NULL, '2026-04-23 17:12:59.496696');
INSERT INTO public.contact_purchases (id, user_id, kind, amount_rub, contacts_added, expires_at, payment_ref, refunded_at, created_at) VALUES (3, 6, 'bonus', 0, 2, NULL, NULL, NULL, '2026-04-23 18:53:23.957987');


--
-- Data for Name: listings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (1, NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', 'Квадрокоптер DJI Mini 3 Pro с камерой 4K/60fps. В комплекте 3 аккумулятора, зарядная станция, кейс. Идеален для путешествий и съёмки мероприятий.', 2500.00, 15000.00, 150000.00, 6, NULL, NULL, false, 1, 'Москва', NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (2, NULL, 'MacBook Pro 16" M3 — ноутбук для работы', 'Apple MacBook Pro 16", чип M3 Pro, 36 ГБ RAM, 1 ТБ SSD. Для разработки, видеомонтажа, дизайна.', 3000.00, 120000.00, 1200000.00, 6, NULL, NULL, false, 1, 'Москва', NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (3, NULL, 'Проектор Epson + экран 120"', 'Проектор 3600 люмен, HDMI + USB, экран 120" в комплекте. Для конференций и домашнего кино.', 1500.00, 10000.00, 100000.00, 6, NULL, NULL, false, 1, 'Москва', NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (4, NULL, 'Sony A7 IV + объектив 24-70mm f/2.8', 'Полнокадровая беззеркалка 33 МП. Объектив Sony 24-70mm f/2.8, 2 акб, зарядка, сумка.', 3500.00, 80000.00, 800000.00, 9, NULL, NULL, false, 2, 'Санкт-Петербург', NULL, NULL, NULL, 2, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (5, NULL, 'Студийный свет — 3 моноблока 400 Вт', 'Студийный комплект: 3 моноблока, стойки, зонты, октабокс 80×80, синхронизатор.', 2000.00, 20000.00, 200000.00, 9, NULL, NULL, false, 2, 'Санкт-Петербург', NULL, NULL, NULL, 2, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (6, NULL, 'Стабилизатор DJI RS 3 для камеры', '3-осевой гимбал, нагрузка до 3 кг, Bluetooth, для любых камер.', 800.00, 12000.00, 120000.00, 9, NULL, NULL, false, 2, 'Санкт-Петербург', NULL, NULL, NULL, 2, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (7, NULL, 'Горные лыжи Rossignol + ботинки (р. 43-44)', 'Лыжи Rossignol 170 см с креплениями Look SPX 12. Ботинки р.43-44. Состояние хорошее.', 700.00, 8000.00, 80000.00, 2, NULL, NULL, false, 71, 'Екатеринбург', NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (8, NULL, 'Туристическая палатка на 4 человека', 'MSR Habitude 4, вес 3,5 кг, водостойкость 3000 мм. Трёхсезонная.', 600.00, 5000.00, 50000.00, 2, NULL, NULL, false, 71, 'Екатеринбург', NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (9, NULL, 'SUP-доска надувная 11 футов', 'Доска для сапсёрфинга с веслом, насосом и рюкзаком. Для рек, озёр, водохранилищ.', 900.00, 6000.00, 60000.00, 2, NULL, NULL, false, 71, 'Екатеринбург', NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (10, NULL, 'Перфоратор Bosch GBH 2-28 F', 'Мощный перфоратор 880 Вт, удар 3,2 Дж, 3 режима, SDS-plus. Набор бит в комплекте.', 500.00, 3000.00, 30000.00, 1, NULL, NULL, false, 1, 'Москва', NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (11, NULL, 'Лазерный уровень Bosch GLL 3-80', '3-плоскостной самовыравнивающийся лазерный нивелир, дальность 80 м, штатив в комплекте.', 700.00, 5000.00, 50000.00, 1, NULL, NULL, false, 1, 'Москва', NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (12, NULL, 'Фотобудка с принтером', 'Автоматическая фотобудка: камера, принтер, реквизит, фоны. Печать за 10 сек. Для свадеб и корпоративов.', 5000.00, 30000.00, 300000.00, 4, NULL, NULL, false, 2, 'Санкт-Петербург', NULL, NULL, NULL, 2, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (13, NULL, 'Детский велосипед 16" (рост 100-120 см)', 'Велосипед с боковыми колёсами, регулируемое сиденье и руль. Возраст 4-7 лет.', 200.00, 2000.00, 20000.00, 5, NULL, NULL, false, 20, 'Казань', NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (14, NULL, 'Детская коляска Bugaboo Fox 3', 'Универсальная 2в1: люлька + прогулочный блок. От рождения до 22 кг, всесезонная.', 350.00, 30000.00, 300000.00, 5, NULL, NULL, false, 20, 'Казань', NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 15:06:03.171843');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (16, 'ВТ-2026-000016', 'Старый велосипед', 'Продаю в аренду', 100.00, NULL, NULL, 1, NULL, 2000, false, 1, NULL, NULL, NULL, NULL, 2, '{}', false, true, '2026-04-23 17:14:33.321614');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (15, 'ВТ-2026-000015', 'Тестовый дрель Bosch', 'Отличное состояние', 500.00, NULL, NULL, 1, NULL, 10000, false, 1, NULL, NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 17:14:33.127427');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (17, 'ВТ-2026-000017', 'Тест спецтехники', 'проверка enum', 3000.00, NULL, NULL, 7, 'special_machinery', 25000, false, 1, NULL, NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 17:38:50.385921');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (19, 'ВТ-2026-000019', 'Шуруповёрт Bosch GSR 18V Pro', 'Профессиональный аккумуляторный шуруповёрт. 2 аккумулятора 18V 4.0Ah. Кейс.', 280.00, NULL, NULL, 1, 'tools', 5600, false, 1, NULL, NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 18:51:42.230285');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (20, 'ВТ-2026-000020', 'Палатка 4-местная Marmot', 'Всесезонная палатка. Двухслойная, водонепроницаемая 3000 мм. Для многодневных походов.', 650.00, NULL, NULL, 2, 'leisure', 9750, false, 1, NULL, NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 18:51:42.244276');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (21, 'ВТ-2026-000021', 'Мотоблок Нева МБ-2Б', 'Мощный мотоблок для обработки огорода до 50 соток. Фрезы и плуг в комплекте.', 1200.00, NULL, NULL, 3, 'special_machinery', 12000, false, 2, NULL, NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 18:51:42.254616');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (22, 'ВТ-2026-000022', 'Звуковая система JBL PRX825W', 'Профессиональная активная акустика. 2 колонки 15" + сабвуфер. Идеально для вечеринок.', 3500.00, NULL, NULL, 4, 'electronics', 25000, false, 2, NULL, NULL, NULL, NULL, 3, '{}', true, true, '2026-04-23 18:51:42.264361');
INSERT INTO public.listings (id, listing_number, title, description, price_per_day, deposit, market_value, category_id, item_category, max_protection_limit, requires_manual_verification, region_id, city, lat, lng, meeting_address, owner_id, photos, owner_protection_enabled, is_available, created_at) VALUES (18, 'ВТ-2026-000018', 'Горный велосипед Trek 3500 (обновлён)', 'Отличный горный велосипед. Рама алюминиевая 21 скорость. Шлем и замок в комплекте.', 480.00, NULL, NULL, 2, 'leisure', 7200, false, 1, NULL, NULL, NULL, NULL, 1, '{}', true, true, '2026-04-23 18:51:42.213257');


--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.favorites (id, user_id, listing_id, created_at) VALUES (1, 2, 3, '2026-04-23 17:10:42.980752');
INSERT INTO public.favorites (id, user_id, listing_id, created_at) VALUES (2, 2, 1, '2026-04-23 17:16:38.348552');


--
-- Data for Name: joint_purchases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.joint_purchases (id, item_name, description, target_amount, collected_amount, participants_count, status, author_id, contact_email, contact_phone, created_at) VALUES (1, 'Лазертаг-комплект для команды 10 человек', 'Набираем команду для аренды полного комплекта снаряжения на корпоратив. Лазертаг, жилеты, маски.', 15000.00, 0.00, 0, 'open', NULL, 'anna@example.com', NULL, '2026-04-23 18:54:24.216526');


--
-- Data for Name: newsletter; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.newsletter (id, email, created_at) VALUES (1, 'test_newsletter@example.com', '2026-04-23 18:53:55.888326');


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (2, 2, 'booking_submitted', '📤 Заявка отправлена — «MacBook Pro 16" M3 — ноутбук для работы»', 'Ваша заявка ХТ-2026-000002 на аренду отправлена владельцу. Ожидайте подтверждения.', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:08:51.968871');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (3, 2, 'booking_confirmed', '✅ Заявка подтверждена — «MacBook Pro 16" M3 — ноутбук для работы»', 'Владелец подтвердил вашу заявку ХТ-2026-000002. Договоритесь о встрече для передачи вещи.', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:10:16.855694');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (4, 2, 'booking_active', '🤝 Вещь передана — «MacBook Pro 16" M3 — ноутбук для работы»', 'Владелец подтвердил передачу вещи по заявке ХТ-2026-000002. Аренда началась! Когда вернёте — нажмите «Возвращаю вещь».', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:10:17.044001');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (7, 2, 'booking_completed', '🏆 Сделка завершена — «MacBook Pro 16" M3 — ноутбук для работы»', 'Спасибо за аренду! Заявка ХТ-2026-000002 завершена и добавлена в историю.', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:10:17.439794');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (1, 1, 'booking_created', '📬 Новая заявка — «MacBook Pro 16" M3 — ноутбук для работы»', 'Мария Соколова хочет взять вещь на 4 дней (2026-06-01 — 2026-06-05).', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:08:51.963401');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (5, 1, 'booking_return_pending', '📦 Арендатор возвращает вещь — «MacBook Pro 16" M3 — ноутбук для работы»', 'Арендатор инициировал возврат по заявке ХТ-2026-000002. Встретьтесь и подтвердите получение вещи.', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:10:17.238354');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (6, 1, 'booking_completed', '🏆 Сделка завершена — «MacBook Pro 16" M3 — ноутбук для работы»', 'Аренда по заявке ХТ-2026-000002 успешно закрыта. Сделка добавлена в историю.', 2, 'MacBook Pro 16" M3 — ноутбук для работы', true, '2026-04-23 17:10:17.437263');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (8, 1, 'booking_created', '📞 Прямой запрос контактов — «Горный велосипед Trek 3500»', 'Анна Козлова оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', 3, 'Горный велосипед Trek 3500', false, '2026-04-23 18:52:02.27426');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (9, 6, 'booking_submitted', '📞 Контакты открыты — «Горный велосипед Trek 3500»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', 3, 'Горный велосипед Trek 3500', false, '2026-04-23 18:52:02.276467');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (10, 1, 'booking_created', '📬 Новая заявка — «Шуруповёрт Bosch GSR 18V Pro»', 'Анна Козлова хочет взять вещь на 2 дней (2026-05-10 — 2026-05-12).', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:52:02.292304');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (11, 6, 'booking_submitted', '📤 Заявка отправлена — «Шуруповёрт Bosch GSR 18V Pro»', 'Ваша заявка ХТ-2026-000004 на аренду отправлена владельцу. Ожидайте подтверждения.', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:52:02.294265');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (12, 3, 'booking_created', '📞 Прямой запрос контактов — «Мотоблок Нева МБ-2Б»', 'Ирина Новикова оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', 5, 'Мотоблок Нева МБ-2Б', false, '2026-04-23 18:52:02.306839');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (13, 4, 'booking_submitted', '📞 Контакты открыты — «Мотоблок Нева МБ-2Б»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', 5, 'Мотоблок Нева МБ-2Б', false, '2026-04-23 18:52:02.308757');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (14, 1, 'booking_created', '📬 Новая заявка — «Палатка 4-местная Marmot»', 'Сергей Волков хочет взять вещь на 6 дней (2026-06-01 — 2026-06-07).', 6, 'Палатка 4-местная Marmot', false, '2026-04-23 18:52:02.322054');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (15, 5, 'booking_submitted', '📤 Заявка отправлена — «Палатка 4-местная Marmot»', 'Ваша заявка ХТ-2026-000006 на аренду отправлена владельцу. Ожидайте подтверждения.', 6, 'Палатка 4-местная Marmot', false, '2026-04-23 18:52:02.324591');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (16, 3, 'booking_created', '📬 Новая заявка — «Звуковая система JBL PRX825W»', 'Ирина Новикова хочет взять вещь на 2 дней (2026-07-15 — 2026-07-17).', 7, 'Звуковая система JBL PRX825W', false, '2026-04-23 18:52:02.33839');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (17, 4, 'booking_submitted', '📤 Заявка отправлена — «Звуковая система JBL PRX825W»', 'Ваша заявка ХТ-2026-000007 на аренду отправлена владельцу. Ожидайте подтверждения.', 7, 'Звуковая система JBL PRX825W', false, '2026-04-23 18:52:02.341142');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (18, 6, 'booking_confirmed', '✅ Заявка подтверждена — «Шуруповёрт Bosch GSR 18V Pro»', 'Владелец подтвердил вашу заявку ХТ-2026-000004. Договоритесь о встрече для передачи вещи.', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:52:02.358518');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (19, 6, 'booking_active', '🤝 Вещь передана — «Шуруповёрт Bosch GSR 18V Pro»', 'Владелец подтвердил передачу вещи по заявке ХТ-2026-000004. Аренда началась! Когда вернёте — нажмите «Возвращаю вещь».', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:53:09.437695');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (20, 1, 'booking_return_pending', '📦 Арендатор возвращает вещь — «Шуруповёрт Bosch GSR 18V Pro»', 'Арендатор инициировал возврат по заявке ХТ-2026-000004. Встретьтесь и подтвердите получение вещи.', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:53:09.452997');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (21, 1, 'booking_completed', '🏆 Сделка завершена — «Шуруповёрт Bosch GSR 18V Pro»', 'Аренда по заявке ХТ-2026-000004 успешно закрыта. Сделка добавлена в историю.', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:53:09.47808');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (22, 6, 'booking_completed', '🏆 Сделка завершена — «Шуруповёрт Bosch GSR 18V Pro»', 'Спасибо за аренду! Заявка ХТ-2026-000004 завершена и добавлена в историю.', 4, 'Шуруповёрт Bosch GSR 18V Pro', false, '2026-04-23 18:53:09.480729');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (23, 1, 'booking_created', '📬 Новая заявка — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест хочет взять вещь на 1 день (2026-12-31 — 2026-01-01).', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:00:57.274383');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (24, 6, 'booking_submitted', '📤 Заявка отправлена — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Ваша заявка ХТ-2026-000008 на аренду отправлена владельцу. Ожидайте подтверждения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:00:57.276867');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (25, 1, 'booking_created', '📬 Новая заявка — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест хочет взять вещь на 4 дней (2020-01-01 — 2020-01-05).', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:00:57.295477');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (26, 6, 'booking_submitted', '📤 Заявка отправлена — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Ваша заявка ХТ-2026-000009 на аренду отправлена владельцу. Ожидайте подтверждения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:00:57.298635');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (27, 1, 'booking_created', '📬 Новая заявка — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест хочет взять вещь на 2 дней (2026-06-15 — 2026-06-17).', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:02:09.975977');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (28, 6, 'booking_submitted', '📤 Заявка отправлена — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Ваша заявка ХТ-2026-000010 на аренду отправлена владельцу. Ожидайте подтверждения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:02:09.979127');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (29, 1, 'booking_created', '📞 Прямой запрос контактов — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:03:28.836016');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (30, 6, 'booking_submitted', '📞 Контакты открыты — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:03:28.839368');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (31, 1, 'booking_created', '📞 Прямой запрос контактов — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:03:28.85448');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (32, 6, 'booking_submitted', '📞 Контакты открыты — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:03:28.857286');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (33, 1, 'booking_created', '📞 Прямой запрос контактов — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:05:55.887827');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (34, 6, 'booking_submitted', '📞 Контакты открыты — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:05:55.891063');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (35, 1, 'booking_created', '📬 Новая заявка — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест хочет взять вещь на 2 дней (2026-09-01 — 2026-09-03).', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:05:55.908613');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (36, 6, 'booking_submitted', '📤 Заявка отправлена — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Ваша заявка ХТ-2026-000014 на аренду отправлена владельцу. Ожидайте подтверждения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:05:55.910828');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (37, 1, 'booking_created', '📞 Прямой запрос контактов — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Анна Козлова-Тест оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:06:12.835447');
INSERT INTO public.notifications (id, user_id, type, title, message, booking_id, listing_title, is_read, created_at) VALUES (38, 6, 'booking_submitted', '📞 Контакты открыты — «DJI Mini 3 Pro — дрон для аэросъёмки»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', false, '2026-04-23 19:06:12.838248');


--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.platform_settings (id, service_fee_percent, tax_fee_percent, shield_fee_percent, shield_fee_min, risk_coverage_percent, risk_coverage_min, deposit_multiplier, deposit_min, prot_mult_electronics, prot_mult_tools, prot_mult_leisure, prot_mult_special_machinery, new_user_protection_cap, new_user_deals_threshold, vip_price_7d, vip_price_14d, vip_price_30d, urgent_price_3d, urgent_price_7d, boost_price_24h, subscription_pro_monthly, subscription_business_monthly, subscription_business_commission_percent, joint_purchase_fee_percent, free_listings_enabled, free_listings_max_per_owner, free_listings_require_phone, free_show_owner_phone_mode, contact_price_single, contact_price_pack10, contact_price_unlimited_30d, free_contacts_bonus, contact_lifetime_days, contact_pack_refund_enabled, contact_pack_refund_window_days, free_to_premium_upgrade_enabled, default_catalog_sort, min_premium_share_in_results, show_format_badges, payment_mode, yookassa_enabled, yookassa_shop_id, yookassa_test_mode, sbp_enabled, sbp_merchant_id, cloudpayments_enabled, cloudpayments_public_id, updated_at, updated_by) VALUES (1, 10.00, 6.00, 5.00, 100, 5.00, 100, 2.00, 1500, 50, 20, 15, 10, 25000, 3, 199, 349, 599, 99, 199, 49, 499, 1990, 5.00, 3.00, true, 10, true, 'after_payment', 49, 299, 699, 2, 0, true, 7, true, 'protected_first', 60, true, 'self_employed', false, NULL, true, false, NULL, false, NULL, '2026-04-23 18:54:24.228', 7);


--
-- Data for Name: regions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.regions (id, name, slug) VALUES (1, 'Москва', 'moscow');
INSERT INTO public.regions (id, name, slug) VALUES (2, 'Санкт-Петербург', 'spb');
INSERT INTO public.regions (id, name, slug) VALUES (3, 'Севастополь', 'sevastopol');
INSERT INTO public.regions (id, name, slug) VALUES (4, 'Республика Адыгея', 'adygea');
INSERT INTO public.regions (id, name, slug) VALUES (5, 'Республика Алтай', 'altai-rep');
INSERT INTO public.regions (id, name, slug) VALUES (6, 'Республика Башкортостан', 'bashkortostan');
INSERT INTO public.regions (id, name, slug) VALUES (7, 'Республика Бурятия', 'buryatia');
INSERT INTO public.regions (id, name, slug) VALUES (8, 'Республика Дагестан', 'dagestan');
INSERT INTO public.regions (id, name, slug) VALUES (9, 'Республика Ингушетия', 'ingushetia');
INSERT INTO public.regions (id, name, slug) VALUES (10, 'Кабардино-Балкарская Республика', 'kabardino-balkaria');
INSERT INTO public.regions (id, name, slug) VALUES (11, 'Республика Калмыкия', 'kalmykia');
INSERT INTO public.regions (id, name, slug) VALUES (12, 'Карачаево-Черкесская Республика', 'karachay-cherkessia');
INSERT INTO public.regions (id, name, slug) VALUES (13, 'Республика Карелия', 'karelia');
INSERT INTO public.regions (id, name, slug) VALUES (14, 'Республика Коми', 'komi');
INSERT INTO public.regions (id, name, slug) VALUES (15, 'Республика Крым', 'crimea');
INSERT INTO public.regions (id, name, slug) VALUES (16, 'Республика Марий Эл', 'mari-el');
INSERT INTO public.regions (id, name, slug) VALUES (17, 'Республика Мордовия', 'mordovia');
INSERT INTO public.regions (id, name, slug) VALUES (18, 'Республика Саха (Якутия)', 'sakha');
INSERT INTO public.regions (id, name, slug) VALUES (19, 'Республика Северная Осетия — Алания', 'north-ossetia');
INSERT INTO public.regions (id, name, slug) VALUES (20, 'Республика Татарстан', 'tatarstan');
INSERT INTO public.regions (id, name, slug) VALUES (21, 'Республика Тыва', 'tuva');
INSERT INTO public.regions (id, name, slug) VALUES (22, 'Удмуртская Республика', 'udmurtia');
INSERT INTO public.regions (id, name, slug) VALUES (23, 'Республика Хакасия', 'khakassia');
INSERT INTO public.regions (id, name, slug) VALUES (24, 'Чеченская Республика', 'chechnya');
INSERT INTO public.regions (id, name, slug) VALUES (25, 'Чувашская Республика', 'chuvashia');
INSERT INTO public.regions (id, name, slug) VALUES (26, 'Алтайский край', 'altai-krai');
INSERT INTO public.regions (id, name, slug) VALUES (27, 'Забайкальский край', 'zabaykalsky');
INSERT INTO public.regions (id, name, slug) VALUES (28, 'Камчатский край', 'kamchatka');
INSERT INTO public.regions (id, name, slug) VALUES (29, 'Краснодарский край', 'krasnodar');
INSERT INTO public.regions (id, name, slug) VALUES (30, 'Красноярский край', 'krasnoyarsk');
INSERT INTO public.regions (id, name, slug) VALUES (31, 'Пермский край', 'perm');
INSERT INTO public.regions (id, name, slug) VALUES (32, 'Приморский край', 'primorsky');
INSERT INTO public.regions (id, name, slug) VALUES (33, 'Ставропольский край', 'stavropol');
INSERT INTO public.regions (id, name, slug) VALUES (34, 'Хабаровский край', 'khabarovsk');
INSERT INTO public.regions (id, name, slug) VALUES (35, 'Амурская область', 'amur');
INSERT INTO public.regions (id, name, slug) VALUES (36, 'Архангельская область', 'arkhangelsk');
INSERT INTO public.regions (id, name, slug) VALUES (37, 'Астраханская область', 'astrakhan');
INSERT INTO public.regions (id, name, slug) VALUES (38, 'Белгородская область', 'belgorod');
INSERT INTO public.regions (id, name, slug) VALUES (39, 'Брянская область', 'bryansk');
INSERT INTO public.regions (id, name, slug) VALUES (40, 'Владимирская область', 'vladimir');
INSERT INTO public.regions (id, name, slug) VALUES (41, 'Волгоградская область', 'volgograd');
INSERT INTO public.regions (id, name, slug) VALUES (42, 'Вологодская область', 'vologda');
INSERT INTO public.regions (id, name, slug) VALUES (43, 'Воронежская область', 'voronezh');
INSERT INTO public.regions (id, name, slug) VALUES (44, 'Ивановская область', 'ivanovo');
INSERT INTO public.regions (id, name, slug) VALUES (45, 'Иркутская область', 'irkutsk');
INSERT INTO public.regions (id, name, slug) VALUES (46, 'Калининградская область', 'kaliningrad');
INSERT INTO public.regions (id, name, slug) VALUES (47, 'Калужская область', 'kaluga');
INSERT INTO public.regions (id, name, slug) VALUES (48, 'Кемеровская область', 'kemerovo');
INSERT INTO public.regions (id, name, slug) VALUES (49, 'Кировская область', 'kirov');
INSERT INTO public.regions (id, name, slug) VALUES (50, 'Костромская область', 'kostroma');
INSERT INTO public.regions (id, name, slug) VALUES (51, 'Курганская область', 'kurgan');
INSERT INTO public.regions (id, name, slug) VALUES (52, 'Курская область', 'kursk');
INSERT INTO public.regions (id, name, slug) VALUES (53, 'Ленинградская область', 'leningrad-obl');
INSERT INTO public.regions (id, name, slug) VALUES (54, 'Липецкая область', 'lipetsk');
INSERT INTO public.regions (id, name, slug) VALUES (55, 'Магаданская область', 'magadan');
INSERT INTO public.regions (id, name, slug) VALUES (56, 'Московская область', 'moscow-obl');
INSERT INTO public.regions (id, name, slug) VALUES (57, 'Мурманская область', 'murmansk');
INSERT INTO public.regions (id, name, slug) VALUES (58, 'Нижегородская область', 'nizhny-novgorod');
INSERT INTO public.regions (id, name, slug) VALUES (59, 'Новгородская область', 'novgorod-obl');
INSERT INTO public.regions (id, name, slug) VALUES (60, 'Новосибирская область', 'novosibirsk');
INSERT INTO public.regions (id, name, slug) VALUES (61, 'Омская область', 'omsk');
INSERT INTO public.regions (id, name, slug) VALUES (62, 'Оренбургская область', 'orenburg');
INSERT INTO public.regions (id, name, slug) VALUES (63, 'Орловская область', 'oryol');
INSERT INTO public.regions (id, name, slug) VALUES (64, 'Пензенская область', 'penza');
INSERT INTO public.regions (id, name, slug) VALUES (65, 'Псковская область', 'pskov');
INSERT INTO public.regions (id, name, slug) VALUES (66, 'Ростовская область', 'rostov');
INSERT INTO public.regions (id, name, slug) VALUES (67, 'Рязанская область', 'ryazan');
INSERT INTO public.regions (id, name, slug) VALUES (68, 'Самарская область', 'samara');
INSERT INTO public.regions (id, name, slug) VALUES (69, 'Саратовская область', 'saratov');
INSERT INTO public.regions (id, name, slug) VALUES (70, 'Сахалинская область', 'sakhalin');
INSERT INTO public.regions (id, name, slug) VALUES (71, 'Свердловская область', 'sverdlovsk');
INSERT INTO public.regions (id, name, slug) VALUES (72, 'Смоленская область', 'smolensk');
INSERT INTO public.regions (id, name, slug) VALUES (73, 'Тамбовская область', 'tambov');
INSERT INTO public.regions (id, name, slug) VALUES (74, 'Тверская область', 'tver');
INSERT INTO public.regions (id, name, slug) VALUES (75, 'Томская область', 'tomsk');
INSERT INTO public.regions (id, name, slug) VALUES (76, 'Тульская область', 'tula');
INSERT INTO public.regions (id, name, slug) VALUES (77, 'Тюменская область', 'tyumen');
INSERT INTO public.regions (id, name, slug) VALUES (78, 'Ульяновская область', 'ulyanovsk');
INSERT INTO public.regions (id, name, slug) VALUES (79, 'Челябинская область', 'chelyabinsk');
INSERT INTO public.regions (id, name, slug) VALUES (80, 'Ярославская область', 'yaroslavl');
INSERT INTO public.regions (id, name, slug) VALUES (81, 'Еврейская автономная область', 'jewish-ao');
INSERT INTO public.regions (id, name, slug) VALUES (82, 'Ненецкий автономный округ', 'nenets');
INSERT INTO public.regions (id, name, slug) VALUES (83, 'Ханты-Мансийский автономный округ', 'khanty-mansiysk');
INSERT INTO public.regions (id, name, slug) VALUES (84, 'Чукотский автономный округ', 'chukotka');
INSERT INTO public.regions (id, name, slug) VALUES (85, 'Ямало-Ненецкий автономный округ', 'yamal');
INSERT INTO public.regions (id, name, slug) VALUES (89, 'Свердловская область', 'ekaterinburg');
INSERT INTO public.regions (id, name, slug) VALUES (90, 'Республика Татарстан', 'kazan');
INSERT INTO public.regions (id, name, slug) VALUES (97, 'Республика Башкортостан', 'ufa');
INSERT INTO public.regions (id, name, slug) VALUES (105, 'Приморский край', 'vladivostok');


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.reports (id, reporter_user_id, report_type, reported_listing_id, reported_user_id, reason, comment, status, resolved_by_admin_id, resolved_note, resolved_at, created_at) VALUES (1, 2, 'listing', 3, NULL, 'spam', 'Тест жалобы', 'pending', NULL, NULL, NULL, '2026-04-23 17:10:42.809911');


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.reviews (id, listing_id, booking_id, booking_number, review_type, reviewer_role, author_id, reviewee_id, rating, text, response_text, response_at, created_at) VALUES (1, 2, 2, 'ХТ-2026-000002', 'listing', 'renter', 2, 1, 5, 'Отличная аренда, рекомендую!', NULL, NULL, '2026-04-23 17:14:59.358768');
INSERT INTO public.reviews (id, listing_id, booking_id, booking_number, review_type, reviewer_role, author_id, reviewee_id, rating, text, response_text, response_at, created_at) VALUES (2, NULL, 2, 'ХТ-2026-000002', 'renter', 'owner', 1, 2, 4, 'Хороший арендатор, верну вещи в срок', NULL, NULL, '2026-04-23 17:15:17.259088');
INSERT INTO public.reviews (id, listing_id, booking_id, booking_number, review_type, reviewer_role, author_id, reviewee_id, rating, text, response_text, response_at, created_at) VALUES (3, 19, 4, 'ХТ-2026-000004', 'listing', 'renter', 6, 1, 5, 'Отличный шуруповёрт! Алексей очень оперативный, всё прошло гладко. Рекомендую!', NULL, NULL, '2026-04-23 18:53:55.855021');
INSERT INTO public.reviews (id, listing_id, booking_id, booking_number, review_type, reviewer_role, author_id, reviewee_id, rating, text, response_text, response_at, created_at) VALUES (4, NULL, 4, 'ХТ-2026-000004', 'renter', 'owner', 1, 6, 5, 'Анна — надёжный арендатор. Вернула в идеальном состоянии и в срок.', NULL, NULL, '2026-04-23 18:53:55.865009');


--
-- Data for Name: support_messages; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.support_messages (id, ticket_id, author_id, body, is_admin, created_at) VALUES (1, 1, 6, 'Кнопка «Завершить» не активна, бронь в статусе active уже 3 дня. Номер брони ХТ-2026-000004.', false, '2026-04-23 18:55:29.313408');


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.support_tickets (id, ticket_number, user_id, subject, category, status, priority, assigned_to_id, closed_at, created_at, updated_at) VALUES (1, 'TKT-2026-000001', 6, 'Не могу завершить бронирование', 'general', 'open', 'normal', NULL, NULL, '2026-04-23 18:55:29.306322', '2026-04-23 18:55:29.306322');


--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_audit_log_id_seq', 6, true);


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

\unrestrict tdo8KHOocdLlt8xZ1npWRx8o4222pTBZAhU21cg4gGUohKGbLIculW2FYdiJkCZ

