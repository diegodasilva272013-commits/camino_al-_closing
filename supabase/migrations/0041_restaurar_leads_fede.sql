-- ============================================================
-- 0041 · Restaurar leads de Fede — 3 pasos en una sola transacción
-- 1. Reabrir leads de Fede con is_closed=true accidental
-- 2. Asignar a Fede los que existen sin asignar (batch recuperacion-fede-28jun)
-- 3. Insertar los que no existen en absoluto para Fede
-- ============================================================

DO $$
DECLARE
  fede_id      uuid;
  cnt          int;
BEGIN
  -- ── Buscar user_id de Fede ──────────────────────────────────────────────
  SELECT id INTO fede_id
  FROM public.profiles
  WHERE role IN ('setter','admin','mentor')
    AND (full_name ILIKE '%federico%' OR full_name ILIKE '%fede %' OR full_name ILIKE 'fede')
  ORDER BY created_at ASC
  LIMIT 1;

  IF fede_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún usuario "Fede/Federico" en profiles. Verificar nombre exacto.';
  END IF;

  RAISE NOTICE 'Fede user_id: %', fede_id;

  -- ── Paso 1: Reabrir leads asignados a Fede con is_closed=true accidental ─
  UPDATE public.leads
  SET    is_closed  = false,
         updated_at = now()
  WHERE  assigned_to_user_id = fede_id
    AND  is_closed            = true
    AND  current_status      != 'NO_CALIFICA'
    AND  phone IN (
      '50244990907','543855032838','5217752053669','5492616254454','541136552770',
      '51987590992','543764688412','573237335807','5493512478385','5492634367332',
      '543704782461','5492254586431','14073009227','542604021082','5491125222055',
      '5491133225452','541127387170','5492664773904','573016565588','5491150125729',
      '50767972259','5493794520437','12142644770','5491168897975','1573054167082',
      '593987115301','5493512957068','5493413929563','5713106533504','5492213043512',
      '573234369080','5493425971715','5493888688728','50766267303','5493883631111',
      '542617219951','543873622861','5491123994313','573232385918','5491156210974',
      '5491135994543','5492235930977','5215549664371','595983041910','5493855902147',
      '34654300547','542616405767','543425912267','5219642252796','56949911144',
      '50376358616','543416146714','524499900972','5492994623883','541133143194',
      '542478541605','5491133117479','541168296243','5493547319013','5492214590559',
      '5493813219054','573044422779','542617481452','56963995664','543772629008',
      '543534099602','595981571595','543735310238','543875997384','5491158211739',
      '5491164097580','5493364579667','543416828822','541163606414','34613866018',
      '5522996140917','541126666918','5491136599910','59178079428','543751404684',
      '543572686499','542634845737','5492323618610','34633551523','5493755237784',
      '542966750920','542617059042','5492916480905','541125792443','5492324691808',
      '573188105222','5493406437201','5492944712050','51928435077','5492964560371',
      '5493875818773','593987794335','573105005053','542224534740','5493512425633'
    );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Paso 1 — leads reabiertos: %', cnt;

  -- ── Paso 2: Asignar a Fede los que existen sin asignar ──────────────────
  UPDATE public.leads
  SET    assigned_to_user_id = fede_id,
         assigned_at         = now(),
         updated_at          = now()
  WHERE  assigned_to_user_id IS NULL
    AND  batch_id = 'recuperacion-fede-28jun';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Paso 2 — leads sin asignar ahora de Fede: %', cnt;

  -- ── Paso 3: Insertar los que no existen para Fede ───────────────────────
  INSERT INTO public.leads
    (first_name, last_name, phone, email, current_status, assigned_to_user_id, batch_id, created_at, updated_at)
  SELECT v.fn, v.ln, v.ph, v.em, 'NO_CONTACTADO', fede_id, 'recuperacion-fede-28jun', now(), now()
  FROM (VALUES
    ('Sahid',     NULL,                         '50244990907',   'sahidfarach@hotmail.com'),
    ('Carla',     'Ramona acosta',              '543855032838',  'porartedeamor98@gmail.com'),
    ('Tania',     'Itali domínguez martínez',   '5217752053669', 'italidom28@gmail.com'),
    ('Yesica',    NULL,                         '5492616254454', 'yesicajsanchez@gmail.com'),
    ('Ayrton',    'R',                          '541136552770',  'ayrtonramos99@gmail.com'),
    ('Carmen',    'Anthuanett oliva espinoza',  '51987590992',   'anthuanettolivaespinoza@gmail.com'),
    ('Sonia',     'Mariela becker',             '543764688412',  'sonia28.93.becker@gmail.com'),
    ('Jairo',     NULL,                         '573237335807',  'jortegat@hotmail.com'),
    ('Sergio',    'Fehr',                       '5493512478385', 'sergiofehr@gmail.com'),
    ('José',      'Luis',                       '5492634367332', 'jv6369539@gmail.com'),
    ('Yanela',    'Elizabeth',                  '543704782461',  'yianee.222@gmail.com'),
    ('Guillermo', NULL,                         '5492254586431', 'guillermopinamar2026@gmail.com'),
    ('Iraisy',    'Machado gragirena',          '14073009227',   'iraisym@gmail.com'),
    ('Genaro',    'Emil',                       '542604021082',  'cortezgenaro682@gmail.com'),
    ('Santiago',  'Navarro',                    '5491125222055', 'santiago.navarro2019@gmail.com'),
    ('Micaela',   NULL,                         '5491133225452', 'micaelaymilo1996@gmail.com'),
    ('Luna',      'Coronel',                    '541127387170',  'lunacoronel333@gmail.com'),
    ('Wanda',     'Tamara becerra',             '5492664773904', 'wandatamarabecerra98@gmail.com'),
    ('Samuel',    'Gonzalez mackeldey',         '573016565588',  'sdgmackeldey@gmail.com'),
    ('Melanie',   NULL,                         '5491150125729', 'melysabrina53@gmail.com'),
    ('Beatriz',   'Choy',                       '50767972259',   'beatrizchoy31@hotmail.com'),
    ('Bruno',     NULL,                         '5493794520437', 'brunolopezcuajo@gmail.com'),
    ('Keily',     'Milla',                      '12142644770',   'keilygaleano07@gmail.com'),
    ('Santiago',  NULL,                         '5491168897975', 'santiago.m.anfuso@gmail.com'),
    ('Juan',      'Sebastian vilbao tibaduiza', '1573054167082', 'juan.vilbao2011@gmail.com'),
    ('Julián',    'Paladines',                  '593987115301',  'paladinesjulian7108@gmail.com'),
    ('Agustin',   NULL,                         '5493512957068', 'penzomaximiliano2000@gmail.com'),
    ('Carla',     NULL,                         '5493413929563', 'blandocarla@gmail.com'),
    ('Denys',     'Pantoja rubio',              '5713106533504', 'denyspantoja389@gmail.com'),
    ('Fiorela',   NULL,                         '5492213043512', 'fiorecasas88@gmail.com'),
    ('Mariangel', 'Espinosa',                   '573234369080',  'mariangele38@gmail.com'),
    ('Carola',    NULL,                         '5493425971715', 'carolamorra1980@gmail.com'),
    ('Ayelen',    NULL,                         '5493888688728', 'aye.smt0910@gmail.com'),
    ('Azael',     'Bernal',                     '50766267303',   'azael.bernal04@gmail.com'),
    ('Alicia',    NULL,                         '5493883631111', 'alicia.ponce.272727@gmail.com'),
    ('Sofia',     'Teran',                      '542617219951',  'sofi.teran.02@gmail.com'),
    ('Jose',      'Danilo ortiz',               '543873622861',  'juancithogilyup243@gmail.com'),
    ('Ariel',     NULL,                         '5491123994313', 'canterokevin640@gmail.com'),
    ('Alex',      'Gilberto leguizamo mendoza', '573232385918',  'jalexdavid749@gmail.com'),
    ('Selena',    NULL,                         '5491156210974', 'villalbaselena23@gmail.com'),
    ('Rocio',     'Celeste chamorro',           '5491135994543', 'chamorrorocio01@gmail.com'),
    ('Romina',    'Mañas',                      '5492235930977', 'manasromina5@gmail.com'),
    ('Luis',      'Gonzalez',                   '5215549664371', 'lsgo2906@gmail.com'),
    ('Ariel',     'Barrios benitez',            '595983041910',  'arielbarriosbenitez5@gmail.com'),
    ('Natalia',   NULL,                         '5493855902147', 'ferzuanael@gmail.com'),
    ('Eliza',     'Sant',                       '34654300547',   'liza_sant@hotmail.es'),
    ('Brian',     'Bayarri',                    '542616405767',  'bayarribrian799@gmail.com'),
    ('Cintia',    'Belen baiz',                 '543425912267',  'cinbelbaiz@gmail.com'),
    ('Jonathan',  'Gómez romero',               '5219642252796', 'barbie270698@icloud.com'),
    ('Oscar',     'Jesús salas',                '56949911144',   'salasoscar022@gmail.com'),
    ('Diego',     'Escobar',                    '50376358616',   'diefer13@yahoo.com'),
    ('Mirian',    'Visentin',                   '543416146714',  'noemivstn@gmail.com'),
    ('Vins',      'Santillán reyes',            '524499900972',  'alexreyes3465@gmail.com'),
    ('Daniela',   'Daniela retamal',            '5492994623883', 'dretamal@hotmail.com.ar'),
    ('Gerardo',   'Gomez',                      '541133143194',  'amoelmarsiempre@gmail.com'),
    ('Florencia', 'Meana',                      '542478541605',  'meanafloor1@gmail.com'),
    ('Leone',     NULL,                         '5491133117479', 'leo-kpo10@hotmail.com'),
    ('Agustina',  'Silvero',                    '541168296243',  'agustinanoeli30@gmail.com'),
    ('Facundo',   'Scheble',                    '5493547319013', 'facundoscheble006@gmail.com'),
    ('Vane',      'Sarrio',                     '5492214590559', 'sarriovane@gmail.com'),
    ('Richar',    'Ricardo mamani',             '5493813219054', 'richarmamani454@gmail.com'),
    ('Luisa',     'Maria polo lasso',           '573044422779',  'luisalasso402@gmail.com'),
    ('Matías',    'Aaron mónaco',               '542617481452',  'matiasaaron172008@gmail.com'),
    ('Miguel',    'Jara',                       '56963995664',   'jara.miguelangel.23@gmail.com'),
    ('Graciela',  'Cuenca',                     '543772629008',  'gracielaitaticuenca3@gmail.com'),
    ('Juan',      'Bollatti',                   '543534099602',  'marcelobollatti926@gmail.com'),
    ('Rodney',    NULL,                         '595981571595',  'rodneyramirez881@gmail.com'),
    ('Roco',      'Jaquelina leguizamón',       '543735310238',  'rociojaqueline97@gmail.com'),
    ('Jesica',    'Mariel chocobar',            '543875997384',  'jesicamarielchocobar@gmail.com'),
    ('Analía',    NULL,                         '5491158211739', 'romeroanaliam@gmail.com'),
    ('Candela',   NULL,                         '5491164097580', 'candecarballo68@gmail.com'),
    ('Agustin',   NULL,                         '5493364579667', 'agustinlescano1927@gmail.com'),
    ('Santiago',  'Barboza',                    '543416828822',  'saanti.barboza14@gmail.com'),
    ('Elizabeth', 'Wavrenchuk',                 '541163606414',  'beth.wavrenchuk33333@gmail.com'),
    ('Isabelle',  NULL,                         '34613866018',   'camila250500@gmail.com'),
    ('Tamara',    NULL,                         '5522996140917', 'tami.saavedra.1@gmail.com'),
    ('Adrián',    NULL,                         '541126666918',  'fnestor332@gimail.xn--cmo-gna'),
    ('Analia',    NULL,                         '5491136599910', 'analiaelisabetha@gmail.com'),
    ('Karina',    'Dávila',                     '59178079428',   'karinardavila76@gmail.com'),
    ('Paola',     'Britez',                     '543751404684',  '442270070pab@gmail.com'),
    ('Gisela',    'Cecilia mamondez',           '543572686499',  'cecigallardo2406@gmail.com'),
    ('Yesica',    'Ochi',                       '542634845737',  'yesiochi78@gmail.com'),
    ('Yanina',    NULL,                         '5492323618610', 'asesora.musso@gmail.com'),
    ('Julieta',   NULL,                         '34633551523',   'mjbagnasco@hotmail.com'),
    ('Marcelo',   NULL,                         '5493755237784', 'mv3647662@gmail.com'),
    ('German',    'Leonel montero',             '542966750920',  'germanleonel001@gmail.com'),
    ('Brian',     'Nahuel leyes reta',          '542617059042',  'leyesnahuel12@gmail.com'),
    ('Cris',      'Acuña',                      '5492916480905', 'acunacristel847@gmail.com'),
    ('Agustín',   'Torres',                     '541125792443',  'agustorres0713@gmail.com'),
    ('Sergio',    'Sergio curieses',            '5492324691808', 'valelucaser1@yahoo.it'),
    ('Sebastian', 'Yassin cárdenas muñoz',      '573188105222',  'sebastianyassin4434@gmail.com'),
    ('Anabella',  'Bustos',                     '5493406437201', 'bustosanabella142@gmail.com'),
    ('Ezequiel',  'Andres morales',             '5492944712050', 'em884222@gmail.com'),
    ('Isaac',     'Daniel macedo saavedra',     '51928435077',   'daniel160924@gmail.com'),
    ('Edgardo',   NULL,                         '5492964560371', 'juanedgardoquiroga9@gmail.com'),
    ('Sergio',    'Imanol ibañez',              '5493875818773', 'imanolsandoval8@gmail.com'),
    ('Pepe',      NULL,                         '593987794335',  'info.artecla@gmail.com'),
    ('Grace',     'Diaz peralta',               '573105005053',  'gracediaz0508@outlook.com'),
    ('Santiago',  'Cignio',                     '542224534740',  'santiagocignio307@gmail.com'),
    ('Adriana',   NULL,                         '5493512425633', 'adru_zing@hotmail.com')
  ) AS v(fn, ln, ph, em)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.leads l
    WHERE  l.assigned_to_user_id = fede_id
      AND  regexp_replace(coalesce(l.phone,''), '\D+', '', 'g')
         = regexp_replace(coalesce(v.ph,''),    '\D+', '', 'g')
  );
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RAISE NOTICE 'Paso 3 — leads nuevos insertados para Fede: %', cnt;

  -- ── Resumen ──────────────────────────────────────────────────────────────
  SELECT count(*) INTO cnt
  FROM public.leads
  WHERE assigned_to_user_id = fede_id AND is_closed = false;
  RAISE NOTICE 'Total leads activos de Fede ahora: %', cnt;

END $$;
