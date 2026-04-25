--
-- PostgreSQL database dump
--

\restrict Zq1Q3OljK4tMXwQXHSnsStjbkov76nNZwWwztRps4uSA6oaegblSyPpWWyAGPSZ

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

INSERT INTO public.users VALUES (12, 'Администратор', 'admin@hochu.to', '$2b$10$4gTLjfZ2O8eeWrosdg0AoebA2.Eb/1/HM5tjeajj5i6qz4qDM8l6q', 'admin', '+70000000000', NULL, NULL, NULL, NULL, 134, 0, false, NULL, false, NULL, NULL, NULL, NULL, NULL, '2026-04-25 01:54:27.777913');
INSERT INTO public.users VALUES (14, 'Мария Соколова', 'maria@example.com', '$2b$10$fmbzeS8DTX5B1DoK0r0e2ebz6ixgQd4oWoB0/JBC/EA3mzA5aYska', 'owner', '+7 (812) 987-65-43', NULL, 'Фотограф. Сдаю профессиональное оборудование.', '@maria_photo', NULL, 135, 0, false, NULL, false, NULL, NULL, NULL, NULL, NULL, '2026-04-25 01:54:28.199576');
INSERT INTO public.users VALUES (16, 'Ирина Новикова', 'irina@example.com', '$2b$10$wWf.06FFUyANEX1cgWN4xeGoPt7mrGCPJ7GAtX6c6afbp3Ur.bZ9i', 'renter', '+7 (963) 111-22-33', NULL, NULL, NULL, NULL, 134, 0, false, NULL, false, NULL, NULL, NULL, NULL, NULL, '2026-04-25 01:54:28.518012');
INSERT INTO public.users VALUES (17, 'Сергей Волков', 'sergey@example.com', '$2b$10$8RexegCn7EYkOS39dEAMsORXbs/V7PpbaHWRGn5EQh06hvY9GaNNO', 'renter', '+7 (921) 444-55-66', NULL, NULL, NULL, NULL, 135, 0, false, NULL, false, NULL, NULL, NULL, NULL, NULL, '2026-04-25 01:54:28.518012');
INSERT INTO public.users VALUES (18, 'Анна Козлова', 'anna@example.com', '$2b$10$TnKM40lMuJbBi8hrhH2zCusPn/6fbeJzwAbCvbWjFx9k7llZXcZu2', 'renter', '+7 (383) 777-88-99', NULL, NULL, NULL, NULL, 193, 0, false, NULL, false, NULL, NULL, NULL, NULL, NULL, '2026-04-25 01:54:28.518012');
INSERT INTO public.users VALUES (19, 'Чужой', 'stranger1777082154@test.ru', '$2b$10$Nl8Act3rt.webhXqvD.uG.SqcuTZOfM2MpXujYEwCCTC55tAfIi.m', 'renter', '+790082154', NULL, NULL, NULL, NULL, NULL, 0, false, NULL, false, NULL, NULL, NULL, NULL, NULL, '2026-04-25 01:55:55.613484');
INSERT INTO public.users VALUES (15, 'Дмитрий Захаров', 'dmitry@example.com', '$2b$10$0Bc.kPy28OACSOMIq352Ou5jtmG0XRoWJn/7a3JYgADxU0LMGLnQ6', 'owner', '+7 (343) 555-44-33', NULL, 'Сдаю спортивное снаряжение и товары для природы.', NULL, NULL, 204, 4, false, NULL, false, NULL, NULL, NULL, NULL, NULL, '2026-04-25 01:54:28.283282');
INSERT INTO public.users VALUES (13, 'Алексей Петров', 'alexey@example.com', '$2b$10$L.eTADnDd24.xO6P5w5iM.p2M8Moj6Z9YBYPXpFzVzyHIJnTbGrYq', 'owner', '+7 (916) 123-45-67', NULL, 'Сдаю технику и инструменты уже 3 года.', '@alexey_rents', NULL, 134, 4, false, NULL, false, NULL, NULL, NULL, NULL, NULL, '2026-04-25 01:54:28.117345');


--
-- Data for Name: admin_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.admin_audit_log VALUES (7, 12, 'platform_settings', 2, 'update', '[]', '2026-04-25 03:59:22.808933');
INSERT INTO public.admin_audit_log VALUES (8, 12, 'platform_settings', 2, 'update', '[]', '2026-04-25 03:59:22.870913');
INSERT INTO public.admin_audit_log VALUES (9, 12, 'platform_settings', 2, 'update', '[]', '2026-04-25 03:59:22.924266');
INSERT INTO public.admin_audit_log VALUES (10, 12, 'platform_settings', 2, 'update', '[]', '2026-04-25 03:59:22.974093');
INSERT INTO public.admin_audit_log VALUES (11, 12, 'platform_settings', 2, 'update', '["poolFeeSelfManagedPercent","poolFeeConciergePercent","coOwnerDailyFeeRub"]', '2026-04-25 04:00:19.314459');
INSERT INTO public.admin_audit_log VALUES (12, 12, 'platform_settings', 2, 'update', '["poolFeeSelfManagedPercent","poolFeeConciergePercent","coOwnerDailyFeeRub"]', '2026-04-25 04:00:19.450275');
INSERT INTO public.admin_audit_log VALUES (13, 12, 'platform_settings', 2, 'update', '["depreciationPerRentalPercent"]', '2026-04-25 06:58:15.912238');
INSERT INTO public.admin_audit_log VALUES (14, 12, 'platform_settings', 2, 'update', '["depreciationPerRentalPercent"]', '2026-04-25 06:58:16.004824');


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
INSERT INTO public.auth_sessions VALUES (32, 12, '7a0338bc0b94b6281b973b071f218603e0abbcd4524c0f53e1073c759af4f8cf', '2026-05-25 01:54:27.781', NULL, '2026-04-25 01:54:27.782562');
INSERT INTO public.auth_sessions VALUES (33, 12, 'b76aadd7aa13e36c9ce6a7c6d645fab0fe439f98b91a6f08b3691322c929f619', '2026-05-25 01:54:27.958', NULL, '2026-04-25 01:54:27.959156');
INSERT INTO public.auth_sessions VALUES (34, 13, 'ab42d321ed38d6e32bced0efe0f7040ea6295cdb6ccdc056cf341b26784ee2a6', '2026-05-25 01:55:54.618', NULL, '2026-04-25 01:55:54.618882');
INSERT INTO public.auth_sessions VALUES (35, 14, 'd4cf8d3d0e50b7c0e78e1da6c449532881e4d25944cdda438b7cbf506d292248', '2026-05-25 01:55:54.87', NULL, '2026-04-25 01:55:54.871256');
INSERT INTO public.auth_sessions VALUES (36, 16, '395870cc8534c1b313da5c3d5806877d3e74f1595433fd465a05af5d9e9e0bc1', '2026-05-25 01:55:55.105', NULL, '2026-04-25 01:55:55.105855');
INSERT INTO public.auth_sessions VALUES (37, 17, 'a09de2f218860adebe2c472aa5a1f2e04a7f1c421b25198271a1eedfa610311c', '2026-05-25 01:55:55.261', NULL, '2026-04-25 01:55:55.26211');
INSERT INTO public.auth_sessions VALUES (38, 12, 'd9752f5f8bc358d39b31c3213570fa42a7d0838e60b6d37eeb067be62ccee3af', '2026-05-25 01:55:55.434', NULL, '2026-04-25 01:55:55.434517');
INSERT INTO public.auth_sessions VALUES (39, 19, '16ee1c14eb27461dfe8145b1cb987cb6e40860dba3406ae53604d520dfa28bc5', '2026-05-25 01:55:55.616', NULL, '2026-04-25 01:55:55.616881');
INSERT INTO public.auth_sessions VALUES (40, 19, '463c64231e54e4e153fa96823d72e4c66e4338f1ab43e0ce470c9fddef855998', '2026-05-25 01:55:55.759', NULL, '2026-04-25 01:55:55.760315');
INSERT INTO public.auth_sessions VALUES (41, 12, '3e89afae5c4ab16cd77a3b5d192ff15513060e1d44ebb3149639888b720d60d2', '2026-05-25 02:26:01.564', NULL, '2026-04-25 02:26:01.564675');
INSERT INTO public.auth_sessions VALUES (42, 12, '8383470a68cb3abb01c36b26aa3dea70298e7b546940c52d2c06ca95661559f9', '2026-05-25 02:26:13.664', NULL, '2026-04-25 02:26:13.664288');
INSERT INTO public.auth_sessions VALUES (43, 12, '9286c4f85c22d13f77c400b0637eedce0c32081a45e2f1a10215af2af28b62c9', '2026-05-25 02:26:13.863', NULL, '2026-04-25 02:26:13.863355');
INSERT INTO public.auth_sessions VALUES (44, 12, '80e213684ea5386361a69a3fb87012958b264f260c360fce37f024cfac493aac', '2026-05-25 02:26:26.58', NULL, '2026-04-25 02:26:26.580283');
INSERT INTO public.auth_sessions VALUES (45, 12, 'b8fbf09cf17752fcb73aff0fd30d06a7b98d059d679e75f2a7670c3b1644f211', '2026-05-25 02:26:39.208', NULL, '2026-04-25 02:26:39.208333');
INSERT INTO public.auth_sessions VALUES (46, 13, 'd2498f098b85a15c1dd9db3b4ecf4c861f597a74f9a7da2a899ad508160052b3', '2026-05-25 02:26:39.373', NULL, '2026-04-25 02:26:39.374098');
INSERT INTO public.auth_sessions VALUES (47, 16, 'c3b68bc63513c1f94ad7bd23200bcff5a099ad01c011665e108c111012481c0b', '2026-05-25 02:26:39.65', NULL, '2026-04-25 02:26:39.650321');
INSERT INTO public.auth_sessions VALUES (48, 13, '030c688c347985d130f18fe080d59c8b21e6d18446e9ad66dfda0edf9d456dce', '2026-05-25 02:26:49.52', NULL, '2026-04-25 02:26:49.521099');
INSERT INTO public.auth_sessions VALUES (49, 16, 'e62fe9f7c7d20d66e8eac34ce19ff6b757cd9f8a63ccba215550e38787f3e8c4', '2026-05-25 02:27:01.624', NULL, '2026-04-25 02:27:01.624827');
INSERT INTO public.auth_sessions VALUES (50, 16, 'e54e08f8a55734716177c76982fcbba3d67e5ed831e0cef334b29f79f4c2987c', '2026-05-25 02:27:24.902', NULL, '2026-04-25 02:27:24.903177');
INSERT INTO public.auth_sessions VALUES (51, 16, 'a8bf9bef6efb1fc61aacbc297ffec9a4151376c56c3593e1d5c15ddce2537728', '2026-05-25 02:28:42.219', NULL, '2026-04-25 02:28:42.220598');
INSERT INTO public.auth_sessions VALUES (52, 16, 'eab4c5155b6a8807766d7e0c203fa36582e5b01003b7cc6906de45a4b74942f9', '2026-05-25 02:32:13.293', NULL, '2026-04-25 02:32:13.294686');
INSERT INTO public.auth_sessions VALUES (53, 12, '100e76a11c6d6bc82230ba4d04d080feee6dbf43c02a4862056f26e0273a8a9a', '2026-05-25 03:59:22.617', NULL, '2026-04-25 03:59:22.61863');
INSERT INTO public.auth_sessions VALUES (54, 16, 'bfe538afbb7a1f3428ca9c5085b201affad052c03b08649ec22d1556555bf0c9', '2026-05-25 03:59:23.098', NULL, '2026-04-25 03:59:23.098989');
INSERT INTO public.auth_sessions VALUES (55, 12, '91d6cbbe88d319bf9794e0dced6e5a81714bede76e241ada4d7f18c2efbb58df', '2026-05-25 04:00:19.216', NULL, '2026-04-25 04:00:19.216704');
INSERT INTO public.auth_sessions VALUES (56, 12, '243b002ce2000eb38931ad656642b671488980a3c7ffa392de8a24a1fb69ee42', '2026-05-25 04:04:17.167', NULL, '2026-04-25 04:04:17.168013');
INSERT INTO public.auth_sessions VALUES (57, 12, 'e8f652164d4eff5433f07eab288f35d322d67d1c6b276069ee6c636a6934edd7', '2026-05-25 04:08:04.723', NULL, '2026-04-25 04:08:04.72348');
INSERT INTO public.auth_sessions VALUES (58, 13, '32b0bf6305f53d4d50be272ae2b1f141d2e1b017ae4b778669112af024cf1525', '2026-05-25 04:37:51.91', NULL, '2026-04-25 04:37:51.911881');
INSERT INTO public.auth_sessions VALUES (59, 16, '993e38acf2162b6fdf22cb07b114b37f8d72367240d427e9ff41a3c520fe897a', '2026-05-25 04:37:52.073', NULL, '2026-04-25 04:37:52.074068');
INSERT INTO public.auth_sessions VALUES (60, 13, 'c5e78049d6f7a4934e68fa601c53d423bc96bd9bbd932e2aa95abfbe6655c8c3', '2026-05-25 04:38:03.025', NULL, '2026-04-25 04:38:03.026401');
INSERT INTO public.auth_sessions VALUES (61, 16, '00abf1fda5b2fc4beb1695edab42e5f914993157d6f8ce99064da02d22860b5d', '2026-05-25 04:38:03.147', NULL, '2026-04-25 04:38:03.148177');
INSERT INTO public.auth_sessions VALUES (62, 13, 'e45949261f733055ea258d2d362f68efecf5567d4935eb10aefae1eed8682748', '2026-05-25 04:38:14.894', NULL, '2026-04-25 04:38:14.895108');
INSERT INTO public.auth_sessions VALUES (63, 16, 'fdb806b72b1e0b0131f6af5a52648a3e1ac05e198a8565a7dbadd4b034234990', '2026-05-25 04:38:15.045', NULL, '2026-04-25 04:38:15.045868');
INSERT INTO public.auth_sessions VALUES (64, 13, '3e6d0f8585cb3f51239a38b2cc57febb3d8d7bc1361f5a400917db0fe8688bd9', '2026-05-25 04:38:47.498', NULL, '2026-04-25 04:38:47.498814');
INSERT INTO public.auth_sessions VALUES (65, 16, 'f6480a47338c5b53c44a45313744d6f21d847a9c8b56536ed5160cda66ed0775', '2026-05-25 04:38:47.648', NULL, '2026-04-25 04:38:47.649387');
INSERT INTO public.auth_sessions VALUES (66, 13, 'ad4a43eb104278ed937afd6b35ea1acb49a439cc0a28da9815dffdcceb550b50', '2026-05-25 04:40:14.664', NULL, '2026-04-25 04:40:14.664713');
INSERT INTO public.auth_sessions VALUES (67, 16, '37f3115410d8572eaa2ebe4140b495838f9f3ceeee16ed75bea0db007f10532e', '2026-05-25 04:40:14.811', NULL, '2026-04-25 04:40:14.811565');
INSERT INTO public.auth_sessions VALUES (68, 16, 'cff6c060e677e6b79e24d45f439a2f84847e0bec32ce62f4e6203d2c8f49ccae', '2026-05-25 04:41:03.246', NULL, '2026-04-25 04:41:03.246902');
INSERT INTO public.auth_sessions VALUES (69, 13, '2aa2021512aa61016a9fc0bbf7365a61a6b5a48e46c422bf6874fbd1f224cae7', '2026-05-25 04:45:10.982', NULL, '2026-04-25 04:45:10.98337');
INSERT INTO public.auth_sessions VALUES (70, 13, 'f602c37c2aaf9a5271cdc2b2361e2b47f68e4eaa5b9f9f974bb59aebcb0fa606', '2026-05-25 05:08:47.327', NULL, '2026-04-25 05:08:47.32807');
INSERT INTO public.auth_sessions VALUES (71, 14, '8171c6b97ac11e536ce589ba15f491434e56cfc96d9a73eca12ff6b04767706d', '2026-05-25 05:08:47.869', NULL, '2026-04-25 05:08:47.870604');
INSERT INTO public.auth_sessions VALUES (72, 15, '4b37924257dfde35d72e9d246fce4246ff816cf2f0cff61163e2430759fe8a95', '2026-05-25 05:08:48.209', NULL, '2026-04-25 05:08:48.210597');
INSERT INTO public.auth_sessions VALUES (73, 16, 'f18a432591347c876c6b5a674af51f3a3d6749d6991b38fa9b4f2163af65bbbd', '2026-05-25 05:08:51.643', NULL, '2026-04-25 05:08:51.643756');
INSERT INTO public.auth_sessions VALUES (74, 13, 'bb1e57e55f496664a32c6a5d3ce8c4f474858137f9b7aad13e7d5aa5d0c46f29', '2026-05-25 05:10:08.631', NULL, '2026-04-25 05:10:08.632793');
INSERT INTO public.auth_sessions VALUES (75, 14, 'e0462f1461b75bc2206eb1ebd559b42039dfde972cf34e50188769e3877bed96', '2026-05-25 05:10:08.862', NULL, '2026-04-25 05:10:08.862758');
INSERT INTO public.auth_sessions VALUES (76, 15, 'b3261047d4f1e2bc5010e4e8b6a39399cef3e7a8a55c9d522e29ea06a079fb63', '2026-05-25 05:10:09.066', NULL, '2026-04-25 05:10:09.067845');
INSERT INTO public.auth_sessions VALUES (77, 16, '0a79cfd8eb8f251650faa0ad0a0870fa4ef6201b5ddab85e95bde082d5fdcef3', '2026-05-25 05:10:09.276', NULL, '2026-04-25 05:10:09.277467');
INSERT INTO public.auth_sessions VALUES (78, 13, 'cbe0341e7d71f6ac9fc27c7fce1166dcfc2ad9df57654287585bbc51ee16ead0', '2026-05-25 05:16:29.621', NULL, '2026-04-25 05:16:29.622739');
INSERT INTO public.auth_sessions VALUES (79, 14, 'fdc0da8fc3bbad154c86f73228bdd362272dc0c178a3b7e84a6f5fc989d0055e', '2026-05-25 05:16:29.799', NULL, '2026-04-25 05:16:29.799974');
INSERT INTO public.auth_sessions VALUES (80, 13, '3d0dcbc954e93bd65388bca67f884092e538bdb8eedc7ea6c33ef16451d7ba7e', '2026-05-25 05:58:36.666', NULL, '2026-04-25 05:58:36.666989');
INSERT INTO public.auth_sessions VALUES (81, 14, '1348c6d6b692d536eda2d0960fbc79c753c297a30cb17d94a33c2a0ac244b222', '2026-05-25 05:58:36.803', NULL, '2026-04-25 05:58:36.80437');
INSERT INTO public.auth_sessions VALUES (82, 15, '451353f289da546552f96c10525c89013bff3791e2794ae1cf507cc0a42d65da', '2026-05-25 05:58:36.902', NULL, '2026-04-25 05:58:36.902576');
INSERT INTO public.auth_sessions VALUES (83, 13, '31d41e08e00c9e9c16ddd17bbbbd30cff196e259ffa7304e9f5209d4bd727240', '2026-05-25 05:59:02.029', NULL, '2026-04-25 05:59:02.030042');
INSERT INTO public.auth_sessions VALUES (84, 14, '40726a79c79c5e48133099f8ada6a6f6f8b551d7332ee13b44c28a60df88d9cc', '2026-05-25 05:59:02.129', NULL, '2026-04-25 05:59:02.130337');
INSERT INTO public.auth_sessions VALUES (85, 15, '2a74eab6845f3a3b0047d9eeeae54ad564d940b44397659b39cb76268c970799', '2026-05-25 05:59:02.228', NULL, '2026-04-25 05:59:02.228375');
INSERT INTO public.auth_sessions VALUES (86, 13, 'd90ac8bdae406009c1d0af39998a1e94ac0237d75a37d0bb758ef14fb8800073', '2026-05-25 06:00:59.228', NULL, '2026-04-25 06:00:59.229311');
INSERT INTO public.auth_sessions VALUES (87, 14, '82f82cc463ff8e820ca694a430983bd9297b28f62c34d715788e03e4e07e58af', '2026-05-25 06:00:59.36', NULL, '2026-04-25 06:00:59.361345');
INSERT INTO public.auth_sessions VALUES (88, 15, '16da0d0ae631d7d33d9a8b9057812c4e9d6282962d829ae65287f41e1884b14b', '2026-05-25 06:00:59.461', NULL, '2026-04-25 06:00:59.461646');
INSERT INTO public.auth_sessions VALUES (89, 13, '6945fb5da6e8504ad9ec8e85a92b3b7fb97efe44cce9e2d56db99dfe5d429d6f', '2026-05-25 06:01:08.788', NULL, '2026-04-25 06:01:08.788908');
INSERT INTO public.auth_sessions VALUES (90, 14, '8b3f5fcc37291fcc601004830265feeb756d490c13ceac78c2a10b94bdbd2c66', '2026-05-25 06:01:08.883', NULL, '2026-04-25 06:01:08.883705');
INSERT INTO public.auth_sessions VALUES (91, 15, '0dcc04f368509a1b1fa34d6f5c85c5b2a2909c8b4a682fae2c67d9231770a60a', '2026-05-25 06:01:08.971', NULL, '2026-04-25 06:01:08.971917');
INSERT INTO public.auth_sessions VALUES (92, 15, 'f927ebc4da20434bbd31b6d3922f390d922391f7162a53e1ffb210848e80b9bf', '2026-05-25 06:06:29.524', NULL, '2026-04-25 06:06:29.52496');
INSERT INTO public.auth_sessions VALUES (93, 15, '1bd1268091390841f1d21870b98ad56a4279782872f4fd526efce388278b6b83', '2026-05-25 06:06:37.03', NULL, '2026-04-25 06:06:37.03085');
INSERT INTO public.auth_sessions VALUES (94, 15, '9c7027762e333bee687123f0f3a214e4e077923656566ce5eef1a40e0dbcbaf6', '2026-05-25 06:09:08.51', NULL, '2026-04-25 06:09:08.511528');
INSERT INTO public.auth_sessions VALUES (95, 15, '2c466095787ede8ca662615a597382a2b3153f27c4cb7f3db95f03bfaf99bc3f', '2026-05-25 06:10:28.12', NULL, '2026-04-25 06:10:28.121424');
INSERT INTO public.auth_sessions VALUES (96, 13, 'd4c0b9eb2066b5c4203e3e5b5be79123aadc9e0c56feba36ea070f593ff9f1ef', '2026-05-25 06:10:28.48', NULL, '2026-04-25 06:10:28.481211');
INSERT INTO public.auth_sessions VALUES (97, 13, 'f6deeddd75e6e0a38acfd7bd9ac8ae232b442a29fda59ff5b37eca09a340bb74', '2026-05-25 06:51:19.817', NULL, '2026-04-25 06:51:19.817899');
INSERT INTO public.auth_sessions VALUES (98, 13, '39371101460c2b3a245fe6946c885f2670d54ec2bf8aafdb721882ce5e440279', '2026-05-25 06:51:45.645', NULL, '2026-04-25 06:51:45.646111');
INSERT INTO public.auth_sessions VALUES (99, 15, '1c419ce866f7d37dc25fe241fb62658ec83feadbb26d9e86ea85feb69e7a30b4', '2026-05-25 06:51:45.791', NULL, '2026-04-25 06:51:45.792249');
INSERT INTO public.auth_sessions VALUES (100, 13, 'f38ade03dc0425f32fae9e78aa64d5dd477ae1cbc30dd9e578e6d8bd2168ccde', '2026-05-25 06:52:35.257', NULL, '2026-04-25 06:52:35.258376');
INSERT INTO public.auth_sessions VALUES (101, 15, 'e7f03249e6ff896c8fefe86fded56f60f1950adcbc106245bd5577dfc034f5f2', '2026-05-25 06:52:35.428', NULL, '2026-04-25 06:52:35.42892');
INSERT INTO public.auth_sessions VALUES (102, 15, '313b5d31aa74f3df5b28abd388ee4aae40e2c7abc84b1531238cba018e7d9cfb', '2026-05-25 06:53:20.345', NULL, '2026-04-25 06:53:20.345288');
INSERT INTO public.auth_sessions VALUES (103, 13, 'e8bbf66c5e65f222d69d927fb15f015962d3cdbd6e78b06db7d3898110e74dec', '2026-05-25 06:57:28.52', NULL, '2026-04-25 06:57:28.520895');
INSERT INTO public.auth_sessions VALUES (104, 12, '985812f388223552d26d9523c1aa4b31dc2d3fabdd73d809d79063c1db736189', '2026-05-25 06:58:15.817', NULL, '2026-04-25 06:58:15.81798');
INSERT INTO public.auth_sessions VALUES (105, 13, '739586e8e8193ae614bc0765d929ae8e950fb2701bbbe701fc63798e1111554e', '2026-05-25 07:20:30.015', NULL, '2026-04-25 07:20:30.016797');
INSERT INTO public.auth_sessions VALUES (106, 15, '189d387f60f5c69cfea0857cd341c64ccc50c0aa059223bb68caa32df3fed83b', '2026-05-25 07:20:30.472', NULL, '2026-04-25 07:20:30.47324');
INSERT INTO public.auth_sessions VALUES (107, 15, 'e5435d646b263daab4ddbe5c1654b77285e5e50f1c995629ff351b88d232eb93', '2026-05-25 07:20:50.432', NULL, '2026-04-25 07:20:50.432803');
INSERT INTO public.auth_sessions VALUES (108, 13, '9b0d4a0f5c330a49c2aa582b2768e7d79fab9011aa688254d08670f9dc383041', '2026-05-25 07:21:09.153', NULL, '2026-04-25 07:21:09.153657');
INSERT INTO public.auth_sessions VALUES (109, 15, 'd6bfe61d07ea89ae331b6fa5320c3ad2460ff4a9be8025838e04d286e6d2435b', '2026-05-25 07:21:09.285', NULL, '2026-04-25 07:21:09.285401');
INSERT INTO public.auth_sessions VALUES (110, 15, '93bd8cedf7dfe55e4c151afce83417bec5e492b8d2ae2f9e9b44281a8edd5c63', '2026-05-25 07:21:25.518', NULL, '2026-04-25 07:21:25.519101');
INSERT INTO public.auth_sessions VALUES (111, 13, '87ff9ad47d3e1853e826c9e92d65578eec9bb6ac7f4e43b37edcfc2f16295aa6', '2026-05-25 07:24:23.719', NULL, '2026-04-25 07:24:23.72104');
INSERT INTO public.auth_sessions VALUES (112, 15, 'a1dd6c050c5b553ad1877e138241a1845f1a7c99fcca30c18c28d777c6a7f111', '2026-05-25 07:24:23.973', NULL, '2026-04-25 07:24:23.974031');
INSERT INTO public.auth_sessions VALUES (113, 15, '61120e77b064d3c8e05299d1de1db2df835c3ea1bb95a55e8d55eebd8423a730', '2026-05-25 07:24:39.562', NULL, '2026-04-25 07:24:39.563188');
INSERT INTO public.auth_sessions VALUES (114, 13, '7fdf5a33e51cb07bba19f7014cdbe8d540d2457c061c21c694f6d0f8bbe56e8b', '2026-05-25 08:05:35.864', NULL, '2026-04-25 08:05:35.865507');
INSERT INTO public.auth_sessions VALUES (115, 14, '75fc27849bac7a4d3b81a1a581e3c084fe37e64da09a76a5ebf61b66951ffdd4', '2026-05-25 08:05:35.993', NULL, '2026-04-25 08:05:35.99419');
INSERT INTO public.auth_sessions VALUES (116, 15, '094114eef3ca33e07442971feaf86c8870a5e11c384b89a35a351a665fc69dc4', '2026-05-25 08:05:36.125', NULL, '2026-04-25 08:05:36.125497');
INSERT INTO public.auth_sessions VALUES (117, 13, '0fe3cb5bbb0efad8dbd54d1baa0811126a1b91e68a03cd399d76f94c17e5639d', '2026-05-25 08:05:44.52', NULL, '2026-04-25 08:05:44.521249');
INSERT INTO public.auth_sessions VALUES (118, 14, '8fd3ba4374416306b5330408034dac46750dc16d86278968388ebdc64b120752', '2026-05-25 08:05:44.677', NULL, '2026-04-25 08:05:44.678159');
INSERT INTO public.auth_sessions VALUES (119, 15, 'ba98842ddeff5adce272646ae327b69411b4a789e75177b5ddba19bfb0f8c0f4', '2026-05-25 08:05:44.823', NULL, '2026-04-25 08:05:44.824102');


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.bookings VALUES (16, 'ХТ-2026-000016', 37, 16, 13, '2026-04-30', '2026-05-02', 2, 49.00, 1000.00, 0.00, 0.00, 0.00, NULL, 0.00, NULL, false, false, 'active', 'none', NULL, NULL, NULL, NULL, '2026-04-25 01:55:56.660904');
INSERT INTO public.bookings VALUES (20, 'ХТ-2026-000020', 90, 14, 13, '2026-04-26', '2026-04-29', 3, 300.00, 0.00, 300.00, 0.00, 0.00, 0.00, 1500.00, 0.00, true, false, 'pending', 'none', 'co-owner test', NULL, NULL, NULL, '2026-04-25 06:01:09.074101');
INSERT INTO public.bookings VALUES (21, 'ХТ-2026-000021', 90, 15, 13, '2026-06-10', '2026-06-12', 2, 200.00, 0.00, 200.00, 0.00, 0.00, 0.00, 1500.00, 0.00, true, false, 'pending', 'none', NULL, NULL, NULL, NULL, '2026-04-25 06:06:37.110015');
INSERT INTO public.bookings VALUES (22, 'ХТ-2026-000022', 90, 15, 13, '2026-07-10', '2026-07-12', 2, 200.00, 0.00, 200.00, 0.00, 0.00, 0.00, 1500.00, 0.00, true, false, 'pending', 'none', NULL, NULL, NULL, NULL, '2026-04-25 06:09:08.615209');
INSERT INTO public.bookings VALUES (23, 'ХТ-2026-000023', 90, 15, 13, '2026-08-10', '2026-08-12', 2, 200.00, 0.00, 200.00, 0.00, 0.00, 0.00, 1500.00, 0.00, true, false, 'pending', 'none', NULL, NULL, NULL, NULL, '2026-04-25 06:10:28.273275');
INSERT INTO public.bookings VALUES (24, 'ХТ-2026-000024', 43, 13, 15, '2026-12-01', '2026-12-02', 1, 49.00, 800.00, 0.00, 0.00, 0.00, NULL, 0.00, NULL, false, false, 'confirmed', 'none', NULL, NULL, NULL, NULL, '2026-04-25 06:51:45.981255');
INSERT INTO public.bookings VALUES (25, 'ХТ-2026-000025', 43, 13, 15, '2026-12-01', '2026-12-02', 1, 49.00, 800.00, 0.00, 0.00, 0.00, NULL, 0.00, NULL, false, false, 'completed', 'none', NULL, NULL, NULL, NULL, '2026-04-25 06:52:35.494328');
INSERT INTO public.bookings VALUES (26, 'ХТ-2026-000026', 43, 13, 15, '2026-12-15', '2026-12-16', 1, 49.00, 800.00, 0.00, 0.00, 0.00, NULL, 0.00, NULL, false, false, 'completed', 'none', NULL, NULL, NULL, NULL, '2026-04-25 07:20:30.632529');
INSERT INTO public.bookings VALUES (27, 'ХТ-2026-000027', 43, 13, 15, '2026-12-20', '2026-12-21', 1, 49.00, 800.00, 0.00, 0.00, 0.00, NULL, 0.00, NULL, false, false, 'completed', 'none', NULL, NULL, NULL, NULL, '2026-04-25 07:21:09.348342');
INSERT INTO public.bookings VALUES (28, 'ХТ-2026-000028', 43, 13, 15, '2027-01-10', '2027-01-11', 1, 49.00, 800.00, 0.00, 0.00, 0.00, NULL, 0.00, NULL, false, false, 'completed', 'none', NULL, NULL, NULL, NULL, '2026-04-25 07:24:24.097821');


--
-- Data for Name: booking_events; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.booking_events VALUES (24, 16, 'ХТ-2026-000016', 16, 'renter', 'direct_contact_opened', NULL, 'confirmed', 'Прямой расчёт: оплачено 49 ₽ за открытие контактов', '2026-04-25 01:55:56.683013');
INSERT INTO public.booking_events VALUES (25, 16, 'ХТ-2026-000016', 13, 'owner', 'status_changed', 'confirmed', 'active', NULL, '2026-04-25 01:55:59.972349');
INSERT INTO public.booking_events VALUES (26, 20, 'ХТ-2026-000020', 14, 'renter', 'created', NULL, 'pending', 'co-owner test', '2026-04-25 06:01:09.086181');
INSERT INTO public.booking_events VALUES (27, 21, 'ХТ-2026-000021', 15, 'renter', 'created', NULL, 'pending', NULL, '2026-04-25 06:06:37.119076');
INSERT INTO public.booking_events VALUES (28, 22, 'ХТ-2026-000022', 15, 'renter', 'created', NULL, 'pending', NULL, '2026-04-25 06:09:08.623611');
INSERT INTO public.booking_events VALUES (29, 23, 'ХТ-2026-000023', 15, 'renter', 'created', NULL, 'pending', NULL, '2026-04-25 06:10:28.29469');
INSERT INTO public.booking_events VALUES (30, 24, 'ХТ-2026-000024', 13, 'renter', 'direct_contact_opened', NULL, 'confirmed', 'Прямой расчёт: оплачено 49 ₽ за открытие контактов', '2026-04-25 06:51:45.993266');
INSERT INTO public.booking_events VALUES (31, 25, 'ХТ-2026-000025', 13, 'renter', 'direct_contact_opened', NULL, 'confirmed', 'Прямой расчёт: оплачено 49 ₽ за открытие контактов', '2026-04-25 06:52:35.514855');
INSERT INTO public.booking_events VALUES (32, 25, 'ХТ-2026-000025', 15, 'owner', 'status_changed', 'return_pending', 'completed', NULL, '2026-04-25 06:53:20.430778');
INSERT INTO public.booking_events VALUES (33, 26, 'ХТ-2026-000026', 13, 'renter', 'direct_contact_opened', NULL, 'confirmed', 'Прямой расчёт: оплачено 49 ₽ за открытие контактов', '2026-04-25 07:20:30.647459');
INSERT INTO public.booking_events VALUES (34, 26, 'ХТ-2026-000026', 15, 'owner', 'status_changed', 'return_pending', 'completed', NULL, '2026-04-25 07:20:50.492786');
INSERT INTO public.booking_events VALUES (35, 27, 'ХТ-2026-000027', 13, 'renter', 'direct_contact_opened', NULL, 'confirmed', 'Прямой расчёт: оплачено 49 ₽ за открытие контактов', '2026-04-25 07:21:09.359878');
INSERT INTO public.booking_events VALUES (36, 27, 'ХТ-2026-000027', 15, 'owner', 'status_changed', 'return_pending', 'completed', NULL, '2026-04-25 07:21:25.596462');
INSERT INTO public.booking_events VALUES (37, 28, 'ХТ-2026-000028', 13, 'renter', 'direct_contact_opened', NULL, 'confirmed', 'Прямой расчёт: оплачено 49 ₽ за открытие контактов', '2026-04-25 07:24:24.125974');
INSERT INTO public.booking_events VALUES (38, 28, 'ХТ-2026-000028', 15, 'owner', 'status_changed', 'return_pending', 'completed', NULL, '2026-04-25 07:24:39.684467');


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

INSERT INTO public.categories VALUES (21, 'Стройка и ремонт', 'construction', '🔨');
INSERT INTO public.categories VALUES (22, 'Туризм и спорт', 'tourism', '⛺');
INSERT INTO public.categories VALUES (23, 'Сад и огород', 'garden', '🌱');
INSERT INTO public.categories VALUES (24, 'Праздники', 'holidays', '🎉');
INSERT INTO public.categories VALUES (25, 'Детские товары', 'children', '👶');
INSERT INTO public.categories VALUES (26, 'Электроника', 'electronics', '💻');
INSERT INTO public.categories VALUES (27, 'Авто и мото', 'auto', '🚗');
INSERT INTO public.categories VALUES (28, 'Одежда и обувь', 'clothing', '👗');
INSERT INTO public.categories VALUES (29, 'Фото и видео', 'photo', '📷');
INSERT INTO public.categories VALUES (30, 'Книги и учёба', 'books', '📚');


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

INSERT INTO public.pools VALUES (13, 13, 'https://example.com/item', 'Тест-пул Stage 23c 1777096742234', 'smoke', 30000, NULL, 0, 'p2p_direct', 'Сбер 1234 5678', 'self_managed', 'funding', true, NULL, '2026-04-25 05:59:02.242857');
INSERT INTO public.pools VALUES (14, 13, 'https://example.com/item', 'Smoke 23c 1777096859480', 'smoke', 30000, NULL, 0, 'p2p_direct', 'Сбер 1234 5678', 'self_managed', 'purchasing', true, NULL, '2026-04-25 06:00:59.486234');
INSERT INTO public.pools VALUES (15, 13, 'https://example.com/item', 'Smoke 23c 1777096868978', 'smoke', 30000, NULL, 0, 'p2p_direct', 'Сбер 1234 5678', 'self_managed', 'active', true, NULL, '2026-04-25 06:01:08.981593');


--
-- Data for Name: listings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.listings VALUES (24, NULL, 'MacBook Pro 16" M3', 'M3 Pro, 36 ГБ RAM, 1 ТБ SSD. Для разработки и дизайна.', 3000.00, 120000.00, NULL, 26, NULL, NULL, false, 134, 'Москва', NULL, NULL, NULL, 13, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (25, NULL, 'Проектор Epson + экран 120"', '3600 люмен, HDMI+USB. Для конференций и кино.', 1500.00, 10000.00, NULL, 26, NULL, NULL, false, 134, 'Москва', NULL, NULL, NULL, 13, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (26, NULL, 'Sony A7 IV + объектив 24-70mm f/2.8', '33 МП, 2 акб, сумка. Профессиональная съёмка.', 3500.00, 80000.00, NULL, 29, NULL, NULL, false, 135, 'Санкт-Петербург', NULL, NULL, NULL, 14, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (27, NULL, 'Студийный свет — 3 моноблока 400 Вт', 'Стойки, зонты, октабокс 80×80, синхронизатор.', 2000.00, 20000.00, NULL, 29, NULL, NULL, false, 135, 'Санкт-Петербург', NULL, NULL, NULL, 14, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (28, NULL, 'Стабилизатор DJI RS 3', '3-осевой гимбал, нагрузка до 3 кг, Bluetooth.', 800.00, 12000.00, NULL, 29, NULL, NULL, false, 135, 'Санкт-Петербург', NULL, NULL, NULL, 14, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (29, NULL, 'Горные лыжи Rossignol + ботинки (р.43-44)', '170 см, Look SPX 12. Состояние хорошее.', 700.00, 8000.00, NULL, 22, NULL, NULL, false, 204, 'Екатеринбург', NULL, NULL, NULL, 15, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (30, NULL, 'Туристическая палатка на 4 человека', 'MSR Habitude 4, 3,5 кг, водостойкость 3000 мм.', 600.00, 5000.00, NULL, 22, NULL, NULL, false, 204, 'Екатеринбург', NULL, NULL, NULL, 15, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (31, NULL, 'SUP-доска надувная 11 футов', 'Весло, насос, рюкзак. Для рек и озёр.', 900.00, 6000.00, NULL, 22, NULL, NULL, false, 204, 'Екатеринбург', NULL, NULL, NULL, 15, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (32, NULL, 'Перфоратор Bosch GBH 2-28 F', '880 Вт, 3,2 Дж удар, SDS-plus, набор бит.', 500.00, 3000.00, NULL, 21, NULL, NULL, false, 134, 'Москва', NULL, NULL, NULL, 13, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (33, NULL, 'Лазерный уровень Bosch GLL 3-80', '3-плоскостной, 80 м, штатив в комплекте.', 700.00, 5000.00, NULL, 21, NULL, NULL, false, 134, 'Москва', NULL, NULL, NULL, 13, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (34, NULL, 'Фотобудка с принтером', 'Автоматическая, печать за 10 сек. Для свадеб и корпоративов.', 5000.00, 30000.00, NULL, 24, NULL, NULL, false, 135, 'Санкт-Петербург', NULL, NULL, NULL, 14, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (35, NULL, 'Детский велосипед 16" (рост 100-120 см)', 'Боковые колёса, регулируемые сиденье и руль. Возраст 4-7 лет.', 200.00, 2000.00, NULL, 25, NULL, NULL, false, 153, 'Казань', NULL, NULL, NULL, 15, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (36, NULL, 'Детская коляска Bugaboo Fox 3', '2в1: люлька + прогулочный блок. От рождения до 22 кг.', 350.00, 30000.00, NULL, 25, NULL, NULL, false, 153, 'Казань', NULL, NULL, NULL, 15, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (38, NULL, 'Шуруповёрт Makita DDF484 18V', 'Бесщёточный, 2 АКБ 5 Ач, кейс, биты. [seed-test]', 350.00, 3500.00, NULL, 21, NULL, NULL, false, 207, 'Тверская область', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/construction-1-0/800/600,https://picsum.photos/seed/construction-1-1/800/600,https://picsum.photos/seed/construction-1-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (39, NULL, 'Лазерный уровень Bosch GLL 3-80', '3-плоскостной, 80 м, штатив, очки. [seed-test]', 700.00, 6000.00, NULL, 21, NULL, NULL, false, 218, 'Ямало-Ненецкий автономный округ', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/construction-2-0/800/600,https://picsum.photos/seed/construction-2-1/800/600,https://picsum.photos/seed/construction-2-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (40, NULL, 'Болгарка DeWalt DWE4257 125 мм', '1500 Вт, плавный пуск, диски в подарок. [seed-test]', 400.00, 3000.00, NULL, 21, NULL, NULL, false, 144, 'Калмыкия', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/construction-3-0/800/600,https://picsum.photos/seed/construction-3-1/800/600,https://picsum.photos/seed/construction-3-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (41, NULL, 'Бетономешалка 160 л', 'Чугунный венец, 230 В. Самовывоз или доставка по городу. [seed-test]', 800.00, 5000.00, NULL, 21, NULL, NULL, false, 155, 'Удмуртская Республика', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/construction-4-0/800/600,https://picsum.photos/seed/construction-4-1/800/600,https://picsum.photos/seed/construction-4-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (42, NULL, 'Горные лыжи Rossignol Experience 88', '170 см, крепления Look SPX 12, отличное состояние. [seed-test]', 700.00, 8000.00, NULL, 22, NULL, NULL, false, 203, 'Сахалинская область', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/tourism-0-0/800/600,https://picsum.photos/seed/tourism-0-1/800/600,https://picsum.photos/seed/tourism-0-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (44, NULL, 'Палатка MSR Habitude 4 (4 чел.)', '3,5 кг, тамбур, водостойкость 3000 мм. [seed-test]', 600.00, 5000.00, NULL, 22, NULL, NULL, false, 140, 'Бурятия', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/tourism-2-0/800/600,https://picsum.photos/seed/tourism-2-1/800/600,https://picsum.photos/seed/tourism-2-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (45, NULL, 'Спальник зимний -20°C', 'Пуховый, размер L, компрессионный мешок. [seed-test]', 250.00, 3000.00, NULL, 22, NULL, NULL, false, 151, 'Саха (Якутия)', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/tourism-3-0/800/600,https://picsum.photos/seed/tourism-3-1/800/600,https://picsum.photos/seed/tourism-3-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (46, NULL, 'Туристический рюкзак Osprey Atmos 65', 'Антигравитационная подвеска, дождевик в комплекте. [seed-test]', 200.00, 4000.00, NULL, 22, NULL, NULL, false, 162, 'Краснодарский край', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/tourism-4-0/800/600,https://picsum.photos/seed/tourism-4-1/800/600,https://picsum.photos/seed/tourism-4-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (23, NULL, 'DJI Mini 3 Pro — дрон для аэросъёмки', '4K/60fps, 3 акб, кейс. Для путешествий и съёмки мероприятий.', 2500.00, 15000.00, NULL, 26, NULL, NULL, false, 134, 'Москва', NULL, NULL, NULL, 13, '{}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.52319', NULL, NULL, 0);
INSERT INTO public.listings VALUES (47, NULL, 'Мотоблок Patriot Garden Калуга', 'Бензин, 7 л.с., фрезы 80 см, обучение в комплекте. [seed-test]', 1200.00, 8000.00, NULL, 23, NULL, NULL, false, 210, 'Тюменская область', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/garden-0-0/800/600,https://picsum.photos/seed/garden-0-1/800/600,https://picsum.photos/seed/garden-0-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (48, NULL, 'Газонокосилка Husqvarna LC 140', 'Бензин, ширина 40 см, мешок 50 л. [seed-test]', 700.00, 5000.00, NULL, 23, NULL, NULL, false, 136, 'Севастополь', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/garden-1-0/800/600,https://picsum.photos/seed/garden-1-1/800/600,https://picsum.photos/seed/garden-1-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (49, NULL, 'Триммер бензиновый STIHL FS 55', 'Леска + диск, ремень-наплечник. [seed-test]', 500.00, 4000.00, NULL, 23, NULL, NULL, false, 147, 'Коми', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/garden-2-0/800/600,https://picsum.photos/seed/garden-2-1/800/600,https://picsum.photos/seed/garden-2-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (50, NULL, 'Цепная пила Husqvarna 240', 'Шина 40 см, 2-тактный, цепь + масло. [seed-test]', 600.00, 5000.00, NULL, 23, NULL, NULL, false, 158, 'Чувашская Республика', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/garden-3-0/800/600,https://picsum.photos/seed/garden-3-1/800/600,https://picsum.photos/seed/garden-3-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (51, NULL, 'Измельчитель веток Bosch AXT 25 TC', 'Турбинная режущая система, диаметр до 45 мм. [seed-test]', 800.00, 7000.00, NULL, 23, NULL, NULL, false, 169, 'Архангельская область', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/garden-4-0/800/600,https://picsum.photos/seed/garden-4-1/800/600,https://picsum.photos/seed/garden-4-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (52, NULL, 'Фотобудка с печатью', 'Автомат, печать за 10 сек, 200 фото в подарок. [seed-test]', 5000.00, 30000.00, NULL, 24, NULL, NULL, false, 217, 'Чукотский автономный округ', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/holidays-0-0/800/600,https://picsum.photos/seed/holidays-0-1/800/600,https://picsum.photos/seed/holidays-0-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (53, NULL, 'Шатёр свадебный 6×12 м', 'Каркас + ткань, монтаж и доставка отдельно. [seed-test]', 8000.00, 50000.00, NULL, 24, NULL, NULL, false, 143, 'Кабардино-Балкарская Республика', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/holidays-1-0/800/600,https://picsum.photos/seed/holidays-1-1/800/600,https://picsum.photos/seed/holidays-1-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (54, NULL, 'Звуковая система JBL EON 715 (пара)', 'Микрофон, стойка, кабели. Для мероприятий до 200 чел. [seed-test]', 3500.00, 35000.00, NULL, 24, NULL, NULL, false, 154, 'Тыва', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/holidays-2-0/800/600,https://picsum.photos/seed/holidays-2-1/800/600,https://picsum.photos/seed/holidays-2-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (55, NULL, 'Светомузыка LED-проектор Laser', 'Лазер + LED-эффекты, ДУ. Для дискотек. [seed-test]', 1200.00, 8000.00, NULL, 24, NULL, NULL, false, 165, 'Приморский край', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/holidays-3-0/800/600,https://picsum.photos/seed/holidays-3-1/800/600,https://picsum.photos/seed/holidays-3-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (56, NULL, 'Дым-машина Antari Z-1500 II', '1500 Вт, ДУ, 2 л жидкости в подарок. [seed-test]', 1500.00, 10000.00, NULL, 24, NULL, NULL, false, 176, 'Воронежская область', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/holidays-4-0/800/600,https://picsum.photos/seed/holidays-4-1/800/600,https://picsum.photos/seed/holidays-4-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (57, NULL, 'Детская коляска Bugaboo Fox 3', '2 в 1: люлька + прогулка. От 0 до 22 кг. [seed-test]', 350.00, 30000.00, NULL, 25, NULL, NULL, false, 139, 'Башкортостан', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/children-0-0/800/600,https://picsum.photos/seed/children-0-1/800/600,https://picsum.photos/seed/children-0-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (58, NULL, 'Автокресло Britax Römer Advansafix', 'Группа 1/2/3 (9-36 кг), Isofix, наклон. [seed-test]', 250.00, 12000.00, NULL, 25, NULL, NULL, false, 150, 'Мордовия', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/children-1-0/800/600,https://picsum.photos/seed/children-1-1/800/600,https://picsum.photos/seed/children-1-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (59, NULL, 'Детский велосипед 16" с колёсами', 'Возраст 4-7 лет, регулировка сиденья и руля. [seed-test]', 200.00, 2500.00, NULL, 25, NULL, NULL, false, 161, 'Камчатский край', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/children-2-0/800/600,https://picsum.photos/seed/children-2-1/800/600,https://picsum.photos/seed/children-2-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (60, NULL, 'Беговел Strider 12 Pro', 'Алюминий, 3 кг, для детей 18 мес – 5 лет. [seed-test]', 200.00, 3500.00, NULL, 25, NULL, NULL, false, 172, 'Брянская область', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/children-3-0/800/600,https://picsum.photos/seed/children-3-1/800/600,https://picsum.photos/seed/children-3-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (61, NULL, 'Манеж-кровать Chicco Lullaby', 'С пеленальным столиком и музыкальным мобилем. [seed-test]', 300.00, 5000.00, NULL, 25, NULL, NULL, false, 183, 'Костромская область', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/children-4-0/800/600,https://picsum.photos/seed/children-4-1/800/600,https://picsum.photos/seed/children-4-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (62, NULL, 'MacBook Pro 16" M3 Pro', '36 ГБ RAM, 1 ТБ SSD. Для разработки, дизайна, монтажа. [seed-test]', 3000.00, 120000.00, NULL, 26, NULL, NULL, false, 146, 'Карелия', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/electronics-0-0/800/600,https://picsum.photos/seed/electronics-0-1/800/600,https://picsum.photos/seed/electronics-0-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (63, NULL, 'iPad Pro 12.9" M2 + Apple Pencil', '256 ГБ, Wi-Fi+Cellular, чехол-клавиатура. [seed-test]', 1200.00, 80000.00, NULL, 26, NULL, NULL, false, 157, 'Чеченская Республика', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/electronics-1-0/800/600,https://picsum.photos/seed/electronics-1-1/800/600,https://picsum.photos/seed/electronics-1-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (64, NULL, 'DJI Mini 3 Pro Fly More Combo', '4K/60fps, 3 АКБ, кейс. Не требует регистрации. [seed-test]', 2500.00, 50000.00, NULL, 26, NULL, NULL, false, 168, 'Амурская область', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/electronics-2-0/800/600,https://picsum.photos/seed/electronics-2-1/800/600,https://picsum.photos/seed/electronics-2-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (65, NULL, 'Проектор Epson EH-TW7100 + экран 120"', '4K-ready, 3000 люмен, HDMI 2.0. [seed-test]', 1500.00, 30000.00, NULL, 26, NULL, NULL, false, 179, 'Калининградская область', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/electronics-3-0/800/600,https://picsum.photos/seed/electronics-3-1/800/600,https://picsum.photos/seed/electronics-3-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (66, NULL, 'PlayStation 5 + 2 геймпада + 5 игр', '1 ТБ, 4K HDR, FIFA 24, GTA V, Mortal Kombat и др. [seed-test]', 1000.00, 40000.00, NULL, 26, NULL, NULL, false, 190, 'Мурманская область', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/electronics-4-0/800/600,https://picsum.photos/seed/electronics-4-1/800/600,https://picsum.photos/seed/electronics-4-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (67, NULL, 'Автобокс Thule Motion XT 600', '420 л, крепится на рейлинги, замки. [seed-test]', 800.00, 12000.00, NULL, 27, NULL, NULL, false, 153, 'Татарстан', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/auto-0-0/800/600,https://picsum.photos/seed/auto-0-1/800/600,https://picsum.photos/seed/auto-0-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (68, NULL, 'Велобагажник Thule на фаркоп (3 вело)', 'Складной, поворотный, с подсветкой. [seed-test]', 700.00, 15000.00, NULL, 27, NULL, NULL, false, 164, 'Пермский край', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/auto-1-0/800/600,https://picsum.photos/seed/auto-1-1/800/600,https://picsum.photos/seed/auto-1-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (69, NULL, 'Прицеп легковой МЗСА 817711', 'Грузоподъёмность 750 кг, ВУ категории B. [seed-test]', 1500.00, 20000.00, NULL, 27, NULL, NULL, false, 175, 'Вологодская область', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/auto-2-0/800/600,https://picsum.photos/seed/auto-2-1/800/600,https://picsum.photos/seed/auto-2-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (70, NULL, 'Цепи противоскольжения R16-R18', 'Комплект на 2 колеса, перчатки + сумка. [seed-test]', 300.00, 3000.00, NULL, 27, NULL, NULL, false, 186, 'Ленинградская область', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/auto-3-0/800/600,https://picsum.photos/seed/auto-3-1/800/600,https://picsum.photos/seed/auto-3-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (71, NULL, 'Компрессор автомобильный Berkut R20', '60 л/мин, до 12 атм, питание от прикуривателя. [seed-test]', 200.00, 3000.00, NULL, 27, NULL, NULL, false, 197, 'Пензенская область', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/auto-4-0/800/600,https://picsum.photos/seed/auto-4-1/800/600,https://picsum.photos/seed/auto-4-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (72, NULL, 'Свадебное платье Pronovias 42-44', 'Атлас, шлейф, фата в подарок. Химчистка проведена. [seed-test]', 5000.00, 30000.00, NULL, 28, NULL, NULL, false, 160, 'Забайкальский край', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/clothing-0-0/800/600,https://picsum.photos/seed/clothing-0-1/800/600,https://picsum.photos/seed/clothing-0-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (73, NULL, 'Смокинг мужской Hugo Boss 50', 'Чёрный, бабочка и пояс в комплекте. [seed-test]', 2000.00, 15000.00, NULL, 28, NULL, NULL, false, 171, 'Белгородская область', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/clothing-1-0/800/600,https://picsum.photos/seed/clothing-1-1/800/600,https://picsum.photos/seed/clothing-1-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (74, NULL, 'Вечернее платье в пол 44-46', 'Тёмно-синее, с открытой спиной, размер S/M. [seed-test]', 1500.00, 8000.00, NULL, 28, NULL, NULL, false, 182, 'Кировская область', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/clothing-2-0/800/600,https://picsum.photos/seed/clothing-2-1/800/600,https://picsum.photos/seed/clothing-2-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (75, NULL, 'Костюм Санта-Клауса класс люкс', 'Парча, борода, мешок. Универсальный размер. [seed-test]', 1500.00, 6000.00, NULL, 28, NULL, NULL, false, 193, 'Новосибирская область', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/clothing-3-0/800/600,https://picsum.photos/seed/clothing-3-1/800/600,https://picsum.photos/seed/clothing-3-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (76, NULL, 'Костюм Снегурочки', 'Размер 44, кокошник, шуба, сапоги. [seed-test]', 1500.00, 5000.00, NULL, 28, NULL, NULL, false, 204, 'Свердловская область', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/clothing-4-0/800/600,https://picsum.photos/seed/clothing-4-1/800/600,https://picsum.photos/seed/clothing-4-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (77, NULL, 'Sony A7 IV + 24-70 f/2.8 GM', '33 МП, 2 АКБ, сумка, карта 128 ГБ. [seed-test]', 3500.00, 100000.00, NULL, 29, NULL, NULL, false, 167, 'Хабаровский край', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/photo-0-0/800/600,https://picsum.photos/seed/photo-0-1/800/600,https://picsum.photos/seed/photo-0-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (78, NULL, 'Canon EOS R6 Mark II + 24-105 f/4', '24 МП, 2 АКБ, бленда, карта 64 ГБ. [seed-test]', 3000.00, 90000.00, NULL, 29, NULL, NULL, false, 178, 'Иркутская область', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/photo-1-0/800/600,https://picsum.photos/seed/photo-1-1/800/600,https://picsum.photos/seed/photo-1-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (79, NULL, 'Nikon Z6 II + 24-70 f/4 S', '24 МП, 2 АКБ, сумка Lowepro. [seed-test]', 2500.00, 80000.00, NULL, 29, NULL, NULL, false, 189, 'Московская область', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/photo-2-0/800/600,https://picsum.photos/seed/photo-2-1/800/600,https://picsum.photos/seed/photo-2-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (80, NULL, 'Объектив Sigma 35mm f/1.4 Art (Sony E)', 'Светосильный портретник, в коробке. [seed-test]', 800.00, 30000.00, NULL, 29, NULL, NULL, false, 200, 'Рязанская область', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/photo-3-0/800/600,https://picsum.photos/seed/photo-3-1/800/600,https://picsum.photos/seed/photo-3-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (81, NULL, 'Стабилизатор DJI RS 3 Pro', 'До 4,5 кг, Bluetooth-кнопка спуска. [seed-test]', 1000.00, 25000.00, NULL, 29, NULL, NULL, false, 211, 'Ульяновская область', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/photo-4-0/800/600,https://picsum.photos/seed/photo-4-1/800/600,https://picsum.photos/seed/photo-4-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (82, NULL, 'Учебники ОГЭ 2026 по 5 предметам', 'Русский, математика, обществознание, физика, информатика. [seed-test]', 100.00, 500.00, NULL, 30, NULL, NULL, false, 174, 'Волгоградская область', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/books-0-0/800/600,https://picsum.photos/seed/books-0-1/800/600,https://picsum.photos/seed/books-0-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (83, NULL, 'Учебники ЕГЭ 2026 (полный комплект)', 'Русский, математика, физика, информатика, англ. [seed-test]', 150.00, 800.00, NULL, 30, NULL, NULL, false, 185, 'Курская область', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/books-1-0/800/600,https://picsum.photos/seed/books-1-1/800/600,https://picsum.photos/seed/books-1-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (84, NULL, 'Атлас и контурные карты 8-11 кл.', 'Дрофа, актуальная редакция. [seed-test]', 50.00, 300.00, NULL, 30, NULL, NULL, false, 196, 'Орловская область', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/books-2-0/800/600,https://picsum.photos/seed/books-2-1/800/600,https://picsum.photos/seed/books-2-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (85, NULL, 'Глобус физический 320 мм с подсветкой', 'Для уроков географии. [seed-test]', 100.00, 1500.00, NULL, 30, NULL, NULL, false, 207, 'Тверская область', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/books-3-0/800/600,https://picsum.photos/seed/books-3-1/800/600,https://picsum.photos/seed/books-3-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (86, NULL, 'Микроскоп школьный Levenhuk LabZZ M3', 'До 400×, набор образцов. [seed-test]', 200.00, 4000.00, NULL, 30, NULL, NULL, false, 218, 'Ямало-Ненецкий автономный округ', NULL, NULL, NULL, 14, '{https://picsum.photos/seed/books-4-0/800/600,https://picsum.photos/seed/books-4-1/800/600,https://picsum.photos/seed/books-4-2/800/600}', true, true, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (37, NULL, 'Перфоратор Bosch GBH 2-28 F', '880 Вт, 3,2 Дж, SDS-plus, чемодан и буры в комплекте. [seed-test]', 500.00, 4000.00, NULL, 21, NULL, NULL, false, 196, 'Орловская область', NULL, NULL, NULL, 13, '{https://picsum.photos/seed/construction-0-0/800/600,https://picsum.photos/seed/construction-0-1/800/600,https://picsum.photos/seed/construction-0-2/800/600}', true, true, false, NULL, false, NULL, NULL, 1, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 0);
INSERT INTO public.listings VALUES (90, 'ВТ-2026-000090', 'Smoke 23c 1777096868978', 'smoke', 0.00, NULL, NULL, 21, NULL, NULL, false, 134, NULL, NULL, NULL, NULL, 13, '{/uploads/dummy1.jpg,/uploads/dummy2.jpg,/uploads/dummy3.jpg,/uploads/dummy4.jpg}', true, false, false, NULL, false, NULL, NULL, 0, 0, 0.00, 0, '2026-04-25 06:01:09.041708', 15, 13, 0);
INSERT INTO public.listings VALUES (43, NULL, 'Сноуборд Burton Custom 156', 'Жёсткость средняя, крепления Burton Mission, ботинки 43. [seed-test]', 800.00, 9000.00, NULL, 22, NULL, NULL, false, 214, 'Еврейская автономная область', NULL, NULL, NULL, 15, '{https://picsum.photos/seed/tourism-1-0/800/600,https://picsum.photos/seed/tourism-1-1/800/600,https://picsum.photos/seed/tourism-1-2/800/600}', true, true, false, NULL, false, NULL, NULL, 5, 0, 0.00, 0, '2026-04-25 01:54:28.567283', NULL, NULL, 4);


--
-- Data for Name: contact_unlocks; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: digital_acts; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.digital_acts VALUES (1, 16, 'check_in', '["/uploads/p1.jpg", "/uploads/p2.png", "/uploads/p3.webp", "/uploads/p4.heic"]', NULL, '{"gps": {"lat": 55.7558, "lng": 37.6173}, "takenAt": "2026-04-25T01:00:00Z", "extractedFromExif": true}', 16, '2026-04-25 01:55:58.88745', NULL);
INSERT INTO public.digital_acts VALUES (3, 16, 'check_out', '["/uploads/co1.jpg", "/uploads/co2.jpg", "/uploads/co3.jpg", "/uploads/co4.heic"]', NULL, NULL, 13, '2026-04-25 01:56:00.230135', NULL);
INSERT INTO public.digital_acts VALUES (15, NULL, 'check_in', '["/uploads/dummy1.jpg", "/uploads/dummy2.jpg", "/uploads/dummy3.jpg", "/uploads/dummy4.jpg"]', NULL, '{"signature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="}', 13, '2026-04-25 06:01:09.041708', 15);


--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: joint_purchases; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.joint_purchases VALUES (1, 'Лазертаг-комплект для команды 10 человек', 'Набираем команду для аренды полного комплекта снаряжения на корпоратив. Лазертаг, жилеты, маски.', 15000.00, 0.00, 0, 'open', NULL, 'anna@example.com', NULL, '2026-04-23 18:54:24.216526');


--
-- Data for Name: listing_promotions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: listing_views; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.listing_views VALUES (1, 37, 'ip:::1', '2026-04-25-01', '2026-04-25 01:56:00.705833');
INSERT INTO public.listing_views VALUES (2, 43, 'ip:::1', '2026-04-25-06', '2026-04-25 06:51:45.858222');


--
-- Data for Name: newsletter; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.newsletter VALUES (1, 'test_newsletter@example.com', '2026-04-23 18:53:55.888326');


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.notifications VALUES (39, 13, 'booking_created', '📞 Прямой запрос контактов — «Перфоратор Bosch GBH 2-28 F»', 'Ирина Новикова оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', 16, 'Перфоратор Bosch GBH 2-28 F', false, '2026-04-25 01:55:56.686285');
INSERT INTO public.notifications VALUES (40, 16, 'booking_submitted', '📞 Контакты открыты — «Перфоратор Bosch GBH 2-28 F»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', 16, 'Перфоратор Bosch GBH 2-28 F', false, '2026-04-25 01:55:56.689273');
INSERT INTO public.notifications VALUES (41, 16, 'booking_active', '🤝 Вещь передана — «Перфоратор Bosch GBH 2-28 F»', 'Владелец подтвердил передачу вещи по заявке ХТ-2026-000016. Аренда началась! Когда вернёте — нажмите «Возвращаю вещь».', 16, 'Перфоратор Bosch GBH 2-28 F', false, '2026-04-25 01:55:59.975126');
INSERT INTO public.notifications VALUES (44, 13, 'booking_created', '📬 Новая заявка — «Smoke 23c 1777096868978»', 'Мария Соколова хочет взять вещь на 3 дней (2026-04-26 — 2026-04-29).', 20, 'Smoke 23c 1777096868978', false, '2026-04-25 06:01:09.095441');
INSERT INTO public.notifications VALUES (45, 14, 'booking_submitted', '📤 Заявка отправлена — «Smoke 23c 1777096868978»', 'Ваша заявка ХТ-2026-000020 на аренду отправлена владельцу. Ожидайте подтверждения.', 20, 'Smoke 23c 1777096868978', false, '2026-04-25 06:01:09.100057');
INSERT INTO public.notifications VALUES (46, 13, 'booking_created', '📬 Новая заявка — «Smoke 23c 1777096868978»', 'Дмитрий Захаров хочет взять вещь на 2 дней (2026-06-10 — 2026-06-12).', 21, 'Smoke 23c 1777096868978', false, '2026-04-25 06:06:37.124373');
INSERT INTO public.notifications VALUES (47, 15, 'booking_submitted', '📤 Заявка отправлена — «Smoke 23c 1777096868978»', 'Ваша заявка ХТ-2026-000021 на аренду отправлена владельцу. Ожидайте подтверждения.', 21, 'Smoke 23c 1777096868978', false, '2026-04-25 06:06:37.128705');
INSERT INTO public.notifications VALUES (48, 13, 'booking_created', '📬 Новая заявка — «Smoke 23c 1777096868978»', 'Дмитрий Захаров хочет взять вещь на 2 дней (2026-07-10 — 2026-07-12).', 22, 'Smoke 23c 1777096868978', false, '2026-04-25 06:09:08.627407');
INSERT INTO public.notifications VALUES (49, 15, 'booking_submitted', '📤 Заявка отправлена — «Smoke 23c 1777096868978»', 'Ваша заявка ХТ-2026-000022 на аренду отправлена владельцу. Ожидайте подтверждения.', 22, 'Smoke 23c 1777096868978', false, '2026-04-25 06:09:08.630067');
INSERT INTO public.notifications VALUES (50, 13, 'booking_created', '📬 Новая заявка — «Smoke 23c 1777096868978»', 'Дмитрий Захаров хочет взять вещь на 2 дней (2026-08-10 — 2026-08-12).', 23, 'Smoke 23c 1777096868978', false, '2026-04-25 06:10:28.299005');
INSERT INTO public.notifications VALUES (51, 15, 'booking_submitted', '📤 Заявка отправлена — «Smoke 23c 1777096868978»', 'Ваша заявка ХТ-2026-000023 на аренду отправлена владельцу. Ожидайте подтверждения.', 23, 'Smoke 23c 1777096868978', false, '2026-04-25 06:10:28.303524');
INSERT INTO public.notifications VALUES (52, 15, 'booking_created', '📞 Прямой запрос контактов — «Сноуборд Burton Custom 156»', 'Алексей Петров оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', 24, 'Сноуборд Burton Custom 156', false, '2026-04-25 06:51:45.997347');
INSERT INTO public.notifications VALUES (53, 13, 'booking_submitted', '📞 Контакты открыты — «Сноуборд Burton Custom 156»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', 24, 'Сноуборд Burton Custom 156', false, '2026-04-25 06:51:46.000227');
INSERT INTO public.notifications VALUES (54, 15, 'booking_created', '📞 Прямой запрос контактов — «Сноуборд Burton Custom 156»', 'Алексей Петров оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', 25, 'Сноуборд Burton Custom 156', false, '2026-04-25 06:52:35.519069');
INSERT INTO public.notifications VALUES (55, 13, 'booking_submitted', '📞 Контакты открыты — «Сноуборд Burton Custom 156»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', 25, 'Сноуборд Burton Custom 156', false, '2026-04-25 06:52:35.523097');
INSERT INTO public.notifications VALUES (56, 15, 'booking_completed', '🏆 Сделка завершена — «Сноуборд Burton Custom 156»', 'Аренда по заявке ХТ-2026-000025 успешно закрыта. Сделка добавлена в историю.', 25, 'Сноуборд Burton Custom 156', false, '2026-04-25 06:53:20.435011');
INSERT INTO public.notifications VALUES (57, 13, 'booking_completed', '🏆 Сделка завершена — «Сноуборд Burton Custom 156»', 'Спасибо за аренду! Заявка ХТ-2026-000025 завершена и добавлена в историю.', 25, 'Сноуборд Burton Custom 156', false, '2026-04-25 06:53:20.438515');
INSERT INTO public.notifications VALUES (58, 15, 'booking_created', '📞 Прямой запрос контактов — «Сноуборд Burton Custom 156»', 'Алексей Петров оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', 26, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:20:30.652397');
INSERT INTO public.notifications VALUES (59, 13, 'booking_submitted', '📞 Контакты открыты — «Сноуборд Burton Custom 156»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', 26, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:20:30.655987');
INSERT INTO public.notifications VALUES (60, 15, 'booking_completed', '🏆 Сделка завершена — «Сноуборд Burton Custom 156»', 'Аренда по заявке ХТ-2026-000026 успешно закрыта. Сделка добавлена в историю.', 26, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:20:50.496084');
INSERT INTO public.notifications VALUES (61, 13, 'booking_completed', '🏆 Сделка завершена — «Сноуборд Burton Custom 156»', 'Спасибо за аренду! Заявка ХТ-2026-000026 завершена и добавлена в историю.', 26, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:20:50.499354');
INSERT INTO public.notifications VALUES (62, 15, 'booking_created', '📞 Прямой запрос контактов — «Сноуборд Burton Custom 156»', 'Алексей Петров оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', 27, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:21:09.36278');
INSERT INTO public.notifications VALUES (63, 13, 'booking_submitted', '📞 Контакты открыты — «Сноуборд Burton Custom 156»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', 27, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:21:09.366093');
INSERT INTO public.notifications VALUES (64, 15, 'booking_completed', '🏆 Сделка завершена — «Сноуборд Burton Custom 156»', 'Аренда по заявке ХТ-2026-000027 успешно закрыта. Сделка добавлена в историю.', 27, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:21:25.600449');
INSERT INTO public.notifications VALUES (65, 13, 'booking_completed', '🏆 Сделка завершена — «Сноуборд Burton Custom 156»', 'Спасибо за аренду! Заявка ХТ-2026-000027 завершена и добавлена в историю.', 27, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:21:25.604441');
INSERT INTO public.notifications VALUES (66, 15, 'booking_created', '📞 Прямой запрос контактов — «Сноуборд Burton Custom 156»', 'Алексей Петров оплатил открытие ваших контактов (49 ₽). Ожидайте сообщения.', 28, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:24:24.133261');
INSERT INTO public.notifications VALUES (67, 13, 'booking_submitted', '📞 Контакты открыты — «Сноуборд Burton Custom 156»', 'Вы оплатили открытие контактов владельца. Свяжитесь с ним напрямую.', 28, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:24:24.142054');
INSERT INTO public.notifications VALUES (68, 15, 'booking_completed', '🏆 Сделка завершена — «Сноуборд Burton Custom 156»', 'Аренда по заявке ХТ-2026-000028 успешно закрыта. Сделка добавлена в историю.', 28, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:24:39.692068');
INSERT INTO public.notifications VALUES (69, 13, 'booking_completed', '🏆 Сделка завершена — «Сноуборд Burton Custom 156»', 'Спасибо за аренду! Заявка ХТ-2026-000028 завершена и добавлена в историю.', 28, 'Сноуборд Burton Custom 156', false, '2026-04-25 07:24:39.697293');


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

INSERT INTO public.platform_settings VALUES (2, 10.00, 6.00, 5.00, 100, 5.00, 100, 2.00, 1500, 50, 20, 15, 10, 25000, 3, 20, 150000, 3, 100, 199, 349, 599, 99, 199, 49, 499, 1990, 5.00, 3.00, true, 10, true, 'after_payment', 49, 299, 699, 2, 0, true, 7, true, 'protected_first', 60, true, 'self_employed', false, NULL, NULL, true, false, NULL, false, NULL, '2026-04-25 06:58:16', 12, false, 5.00, 12.00, 100, 1);


--
-- Data for Name: pool_shares; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.pool_shares VALUES (9, 13, 14, 33.33, 10000, 'user_transferred', '2026-04-25 05:59:02.347823');
INSERT INTO public.pool_shares VALUES (10, 13, 15, 33.33, 10000, 'user_transferred', '2026-04-25 05:59:02.361715');
INSERT INTO public.pool_shares VALUES (11, 14, 14, 50.00, 15000, 'creator_confirmed', '2026-04-25 06:00:59.510112');
INSERT INTO public.pool_shares VALUES (12, 14, 15, 50.00, 15000, 'creator_confirmed', '2026-04-25 06:00:59.520228');
INSERT INTO public.pool_shares VALUES (13, 15, 13, 100.00, 30000, 'creator_confirmed', '2026-04-25 06:01:08.997943');


--
-- Data for Name: regions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.regions VALUES (134, 'Москва', 'moscow');
INSERT INTO public.regions VALUES (135, 'Санкт-Петербург', 'spb');
INSERT INTO public.regions VALUES (136, 'Севастополь', 'sevastopol');
INSERT INTO public.regions VALUES (137, 'Республика Адыгея', 'adygea');
INSERT INTO public.regions VALUES (138, 'Республика Алтай', 'altai-rep');
INSERT INTO public.regions VALUES (139, 'Республика Башкортостан', 'bashkortostan');
INSERT INTO public.regions VALUES (140, 'Республика Бурятия', 'buryatia');
INSERT INTO public.regions VALUES (141, 'Республика Дагестан', 'dagestan');
INSERT INTO public.regions VALUES (142, 'Республика Ингушетия', 'ingushetia');
INSERT INTO public.regions VALUES (143, 'Кабардино-Балкарская Республика', 'kabardino-balkaria');
INSERT INTO public.regions VALUES (144, 'Республика Калмыкия', 'kalmykia');
INSERT INTO public.regions VALUES (145, 'Карачаево-Черкесская Республика', 'karachay-cherkessia');
INSERT INTO public.regions VALUES (146, 'Республика Карелия', 'karelia');
INSERT INTO public.regions VALUES (147, 'Республика Коми', 'komi');
INSERT INTO public.regions VALUES (148, 'Республика Крым', 'crimea');
INSERT INTO public.regions VALUES (149, 'Республика Марий Эл', 'mari-el');
INSERT INTO public.regions VALUES (150, 'Республика Мордовия', 'mordovia');
INSERT INTO public.regions VALUES (151, 'Республика Саха (Якутия)', 'sakha');
INSERT INTO public.regions VALUES (152, 'Республика Северная Осетия — Алания', 'north-ossetia');
INSERT INTO public.regions VALUES (153, 'Республика Татарстан', 'tatarstan');
INSERT INTO public.regions VALUES (154, 'Республика Тыва', 'tuva');
INSERT INTO public.regions VALUES (155, 'Удмуртская Республика', 'udmurtia');
INSERT INTO public.regions VALUES (156, 'Республика Хакасия', 'khakassia');
INSERT INTO public.regions VALUES (157, 'Чеченская Республика', 'chechnya');
INSERT INTO public.regions VALUES (158, 'Чувашская Республика', 'chuvashia');
INSERT INTO public.regions VALUES (159, 'Алтайский край', 'altai-krai');
INSERT INTO public.regions VALUES (160, 'Забайкальский край', 'zabaykalsky');
INSERT INTO public.regions VALUES (161, 'Камчатский край', 'kamchatka');
INSERT INTO public.regions VALUES (162, 'Краснодарский край', 'krasnodar');
INSERT INTO public.regions VALUES (163, 'Красноярский край', 'krasnoyarsk');
INSERT INTO public.regions VALUES (164, 'Пермский край', 'perm');
INSERT INTO public.regions VALUES (165, 'Приморский край', 'primorsky');
INSERT INTO public.regions VALUES (166, 'Ставропольский край', 'stavropol');
INSERT INTO public.regions VALUES (167, 'Хабаровский край', 'khabarovsk');
INSERT INTO public.regions VALUES (168, 'Амурская область', 'amur');
INSERT INTO public.regions VALUES (169, 'Архангельская область', 'arkhangelsk');
INSERT INTO public.regions VALUES (170, 'Астраханская область', 'astrakhan');
INSERT INTO public.regions VALUES (171, 'Белгородская область', 'belgorod');
INSERT INTO public.regions VALUES (172, 'Брянская область', 'bryansk');
INSERT INTO public.regions VALUES (173, 'Владимирская область', 'vladimir');
INSERT INTO public.regions VALUES (174, 'Волгоградская область', 'volgograd');
INSERT INTO public.regions VALUES (175, 'Вологодская область', 'vologda');
INSERT INTO public.regions VALUES (176, 'Воронежская область', 'voronezh');
INSERT INTO public.regions VALUES (177, 'Ивановская область', 'ivanovo');
INSERT INTO public.regions VALUES (178, 'Иркутская область', 'irkutsk');
INSERT INTO public.regions VALUES (179, 'Калининградская область', 'kaliningrad');
INSERT INTO public.regions VALUES (180, 'Калужская область', 'kaluga');
INSERT INTO public.regions VALUES (181, 'Кемеровская область', 'kemerovo');
INSERT INTO public.regions VALUES (182, 'Кировская область', 'kirov');
INSERT INTO public.regions VALUES (183, 'Костромская область', 'kostroma');
INSERT INTO public.regions VALUES (184, 'Курганская область', 'kurgan');
INSERT INTO public.regions VALUES (185, 'Курская область', 'kursk');
INSERT INTO public.regions VALUES (186, 'Ленинградская область', 'leningrad-obl');
INSERT INTO public.regions VALUES (187, 'Липецкая область', 'lipetsk');
INSERT INTO public.regions VALUES (188, 'Магаданская область', 'magadan');
INSERT INTO public.regions VALUES (189, 'Московская область', 'moscow-obl');
INSERT INTO public.regions VALUES (190, 'Мурманская область', 'murmansk');
INSERT INTO public.regions VALUES (191, 'Нижегородская область', 'nizhny-novgorod');
INSERT INTO public.regions VALUES (192, 'Новгородская область', 'novgorod-obl');
INSERT INTO public.regions VALUES (193, 'Новосибирская область', 'novosibirsk');
INSERT INTO public.regions VALUES (194, 'Омская область', 'omsk');
INSERT INTO public.regions VALUES (195, 'Оренбургская область', 'orenburg');
INSERT INTO public.regions VALUES (196, 'Орловская область', 'oryol');
INSERT INTO public.regions VALUES (197, 'Пензенская область', 'penza');
INSERT INTO public.regions VALUES (198, 'Псковская область', 'pskov');
INSERT INTO public.regions VALUES (199, 'Ростовская область', 'rostov');
INSERT INTO public.regions VALUES (200, 'Рязанская область', 'ryazan');
INSERT INTO public.regions VALUES (201, 'Самарская область', 'samara');
INSERT INTO public.regions VALUES (202, 'Саратовская область', 'saratov');
INSERT INTO public.regions VALUES (203, 'Сахалинская область', 'sakhalin');
INSERT INTO public.regions VALUES (204, 'Свердловская область', 'sverdlovsk');
INSERT INTO public.regions VALUES (205, 'Смоленская область', 'smolensk');
INSERT INTO public.regions VALUES (206, 'Тамбовская область', 'tambov');
INSERT INTO public.regions VALUES (207, 'Тверская область', 'tver');
INSERT INTO public.regions VALUES (208, 'Томская область', 'tomsk');
INSERT INTO public.regions VALUES (209, 'Тульская область', 'tula');
INSERT INTO public.regions VALUES (210, 'Тюменская область', 'tyumen');
INSERT INTO public.regions VALUES (211, 'Ульяновская область', 'ulyanovsk');
INSERT INTO public.regions VALUES (212, 'Челябинская область', 'chelyabinsk');
INSERT INTO public.regions VALUES (213, 'Ярославская область', 'yaroslavl');
INSERT INTO public.regions VALUES (214, 'Еврейская автономная область', 'jewish-ao');
INSERT INTO public.regions VALUES (215, 'Ненецкий автономный округ', 'nenets');
INSERT INTO public.regions VALUES (216, 'Ханты-Мансийский автономный округ', 'khanty-mansiysk');
INSERT INTO public.regions VALUES (217, 'Чукотский автономный округ', 'chukotka');
INSERT INTO public.regions VALUES (218, 'Ямало-Ненецкий автономный округ', 'yamal');


--
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.reviews VALUES (1, 2, 2, 'ХТ-2026-000002', 'listing', 'renter', 2, 1, 5, 'Отличная аренда, рекомендую!', NULL, NULL, '2026-04-23 17:14:59.358768');
INSERT INTO public.reviews VALUES (2, NULL, 2, 'ХТ-2026-000002', 'renter', 'owner', 1, 2, 4, 'Хороший арендатор, верну вещи в срок', NULL, NULL, '2026-04-23 17:15:17.259088');
INSERT INTO public.reviews VALUES (3, 19, 4, 'ХТ-2026-000004', 'listing', 'renter', 6, 1, 5, 'Отличный шуруповёрт! Алексей очень оперативный, всё прошло гладко. Рекомендую!', NULL, NULL, '2026-04-23 18:53:55.855021');
INSERT INTO public.reviews VALUES (4, NULL, 4, 'ХТ-2026-000004', 'renter', 'owner', 1, 6, 5, 'Анна — надёжный арендатор. Вернула в идеальном состоянии и в срок.', NULL, NULL, '2026-04-23 18:53:55.865009');


--
-- Data for Name: share_offers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.share_offers VALUES (2, 13, 14, 12000, 'sold', '2026-04-25 08:05:57.69523', 13, '2026-04-25 08:06:10.089', '+7 999 111-22-33 (Тинькофф)');
INSERT INTO public.share_offers VALUES (4, 13, 13, 25000, 'canceled', '2026-04-25 08:07:18.613005', NULL, NULL, '+7 999 777-88-99');
INSERT INTO public.share_offers VALUES (5, 13, 13, 20000, 'canceled', '2026-04-25 08:09:54.554947', NULL, NULL, '+7 999 000-00-00');


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

SELECT pg_catalog.setval('public.admin_audit_log_id_seq', 14, true);


--
-- Name: auth_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auth_sessions_id_seq', 119, true);


--
-- Name: booking_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.booking_events_id_seq', 38, true);


--
-- Name: booking_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.booking_messages_id_seq', 4, true);


--
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bookings_id_seq', 28, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 30, true);


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
-- Name: digital_acts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.digital_acts_id_seq', 15, true);


--
-- Name: favorites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.favorites_id_seq', 2, true);


--
-- Name: joint_purchases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.joint_purchases_id_seq', 1, true);


--
-- Name: listing_promotions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.listing_promotions_id_seq', 1, false);


--
-- Name: listing_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.listing_views_id_seq', 3, true);


--
-- Name: listings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.listings_id_seq', 90, true);


--
-- Name: newsletter_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.newsletter_id_seq', 1, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 69, true);


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

SELECT pg_catalog.setval('public.platform_settings_id_seq', 2, true);


--
-- Name: pool_shares_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pool_shares_id_seq', 14, true);


--
-- Name: pools_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pools_id_seq', 15, true);


--
-- Name: regions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.regions_id_seq', 218, true);


--
-- Name: reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reports_id_seq', 1, true);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reviews_id_seq', 4, true);


--
-- Name: share_offers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.share_offers_id_seq', 5, true);


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

SELECT pg_catalog.setval('public.users_id_seq', 19, true);


--
-- PostgreSQL database dump complete
--

\unrestrict Zq1Q3OljK4tMXwQXHSnsStjbkov76nNZwWwztRps4uSA6oaegblSyPpWWyAGPSZ

