--
-- PostgreSQL database dump
--

\restrict he8WFIlNvA8ffKFzlzCYvQMInZLQLmPOlKDpQRluGyjYv5RX3hEbdL3xdlrgByv

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

INSERT INTO public.users (id, name, email, password_hash, role, phone, avatar, bio, telegram, website, region_id, completed_deals_count, is_banned, ban_reason, is_verified, verified_at, verified_by_admin_id, verification_note, trust_score, trust_score_updated_at, created_at) VALUES (1, 'Администратор', 'admin@hochu.to', '$2b$10$732r5LvGllq5U7OF7FNU/eq1vDA12nADwJOiWfkArbsslUn5/FmqS', 'admin', NULL, NULL, NULL, NULL, NULL, NULL, 0, false, NULL, false, NULL, NULL, NULL, NULL, NULL, '2026-04-29 08:39:42.3605');


--
-- Data for Name: admin_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: booking_events; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: booking_messages; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: claims; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: contact_balances; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: contact_purchases; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: pools; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: digital_acts; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: listings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: joint_purchases; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: newsletter; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: payout_methods; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: payout_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.platform_settings (id, service_fee_percent, tax_fee_percent, shield_fee_percent, shield_fee_min, risk_coverage_percent, risk_coverage_min, deposit_multiplier, deposit_min, prot_mult_electronics, prot_mult_tools, prot_mult_leisure, prot_mult_special_machinery, new_user_protection_cap, new_user_deals_threshold, fund_reserve_ratio_pct, max_claim_amount_single_rub, max_claims_per_user_month, max_claim_amount_per_listing_pct, vip_price_7d, vip_price_14d, vip_price_30d, urgent_price_3d, urgent_price_7d, boost_price_24h, subscription_pro_monthly, subscription_business_monthly, subscription_business_commission_percent, joint_purchase_fee_percent, pool_fee_self_managed_percent, pool_fee_concierge_percent, co_owner_daily_fee_rub, depreciation_per_rental_percent, free_listings_enabled, free_listings_max_per_owner, free_listings_require_phone, free_show_owner_phone_mode, contact_price_single, contact_price_pack10, contact_price_unlimited_30d, free_contacts_bonus, contact_lifetime_days, contact_pack_refund_enabled, contact_pack_refund_window_days, free_to_premium_upgrade_enabled, default_catalog_sort, min_premium_share_in_results, show_format_badges, is_commercial_mode, payment_mode, yookassa_enabled, yookassa_shop_id, yookassa_secret_key, yookassa_test_mode, sbp_enabled, sbp_merchant_id, cloudpayments_enabled, cloudpayments_public_id, active_ai_provider, updated_at, updated_by) VALUES (1, 10.00, 6.00, 5.00, 100, 5.00, 100, 2.00, 1500, 50, 20, 15, 10, 25000, 3, 20, 150000, 3, 100, 199, 349, 599, 99, 199, 49, 499, 1990, 5.00, 3.00, 5.00, 12.00, 100, 1, true, 10, true, 'after_payment', 49, 299, 699, 2, 0, true, 7, true, 'protected_first', 60, true, false, 'self_employed', false, NULL, NULL, true, false, NULL, false, NULL, 'mock', '2026-04-29 08:39:42.435082', NULL);


--
-- Data for Name: pool_shares; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: regions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: share_offers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: support_messages; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: admin_audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.admin_audit_log_id_seq', 1, false);


--
-- Name: booking_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.booking_events_id_seq', 1, false);


--
-- Name: booking_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.booking_messages_id_seq', 1, false);


--
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bookings_id_seq', 1, false);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 1, false);


--
-- Name: claims_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.claims_id_seq', 1, false);


--
-- Name: contact_balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contact_balances_id_seq', 1, false);


--
-- Name: contact_purchases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.contact_purchases_id_seq', 1, false);


--
-- Name: digital_acts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.digital_acts_id_seq', 1, false);


--
-- Name: favorites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.favorites_id_seq', 1, false);


--
-- Name: joint_purchases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.joint_purchases_id_seq', 1, false);


--
-- Name: listings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.listings_id_seq', 1, false);


--
-- Name: newsletter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.newsletter_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payments_id_seq', 1, false);


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
-- Name: pool_shares_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pool_shares_id_seq', 1, false);


--
-- Name: pools_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pools_id_seq', 1, false);


--
-- Name: regions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.regions_id_seq', 1, false);


--
-- Name: reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reports_id_seq', 1, false);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reviews_id_seq', 1, false);


--
-- Name: share_offers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.share_offers_id_seq', 1, false);


--
-- Name: support_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_messages_id_seq', 1, false);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_tickets_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- PostgreSQL database dump complete
--

\unrestrict he8WFIlNvA8ffKFzlzCYvQMInZLQLmPOlKDpQRluGyjYv5RX3hEbdL3xdlrgByv

