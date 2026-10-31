// Applique le schéma, charge les référentiels et, si demandé, les données de démonstration.
// Usage : node scripts/migrate.mjs   (lancé automatiquement par `npm start`)
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "@node-rs/argon2";
import * as S from "../db/seed-data.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}
const ssl = /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined;
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();

const q = (text, params) => client.query(text, params);

await q(fs.readFileSync(path.join(root, "db/schema.sql"), "utf8"));
console.log("Schéma appliqué");

// Référentiels (idempotents)
for (const c of S.COUNTRIES) {
  await q(
    `INSERT INTO countries(code,name,currency,phone_prefix,dpa,sort) VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, currency=EXCLUDED.currency, phone_prefix=EXCLUDED.phone_prefix, dpa=EXCLUDED.dpa, sort=EXCLUDED.sort`,
    [c.code, c.name, c.currency, c.phone, c.dpa, c.sort],
  );
  for (const city of S.CITIES[c.code]) {
    await q(`INSERT INTO cities(country_code,name) VALUES($1,$2) ON CONFLICT DO NOTHING`, [c.code, city]);
  }
}
for (const f of S.FUNCTIONS) await q(`INSERT INTO functions(name) VALUES($1) ON CONFLICT DO NOTHING`, [f]);
for (const s of S.SECTORS) await q(`INSERT INTO sectors(name) VALUES($1) ON CONFLICT DO NOTHING`, [s]);
for (const p of S.PLANS) {
  await q(
    `INSERT INTO plans(code,name,description,price_xof,period,job_credits,cv_credits,cv_unlimited,duration_days,sort)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, price_xof=EXCLUDED.price_xof,
       period=EXCLUDED.period, job_credits=EXCLUDED.job_credits, cv_credits=EXCLUDED.cv_credits,
       cv_unlimited=EXCLUDED.cv_unlimited, duration_days=EXCLUDED.duration_days, sort=EXCLUDED.sort`,
    [p.code, p.name, p.description, p.price, p.period, p.jobs, p.cv, p.unlimited, p.days, p.sort],
  );
}
for (const a of S.ARTICLES) {
  await q(
    `INSERT INTO articles(slug,title,category,excerpt,body) VALUES($1,$2,$3,$4,$5) ON CONFLICT (slug) DO NOTHING`,
    [a.slug, a.title, a.category, a.excerpt, a.body],
  );
}
console.log("Référentiels chargés");

// Compte administrateur initial (depuis les variables d'environnement)
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const { rowCount } = await q(`SELECT 1 FROM users WHERE email=$1`, [email]);
  if (!rowCount) {
    await q(
      `INSERT INTO users(email,password_hash,role,first_name,last_name) VALUES($1,$2,'admin','Administrateur','GTR')`,
      [email, await hash(process.env.ADMIN_PASSWORD)],
    );
    console.log("Compte administrateur créé :", email);
  }
}

// Données de démonstration (SEED_DEMO=1)
if (process.env.SEED_DEMO === "1") {
  const { rows } = await q(`SELECT count(*)::int AS n FROM companies`);
  if (rows[0].n === 0) {
    await seedDemo();
    console.log("Données de démonstration chargées");
  }
}

// Données de démonstration, lot 2 : gestion des partenaires, test de personnalité, présélection
if (process.env.SEED_DEMO === "1") {
  const { rows } = await q(`SELECT 1 FROM users WHERE email='gestion@demo.globaltalents-resources.com'`);
  const { rows: hasJob } = await q(`SELECT 1 FROM jobs WHERE title='Ingénieur cybersécurité (SOC)'`);
  if (!rows.length && hasJob.length) {
    await seedDemoV2();
    console.log("Données de démonstration (partenaires, présélection) chargées");
  }
}

await client.end();

async function seedDemo() {
  const demoPassword = await hash(process.env.DEMO_PASSWORD || "Demo-GTR-2026");
  const fn = Object.fromEntries((await q(`SELECT id,name FROM functions`)).rows.map((r) => [r.name, r.id]));
  const sec = Object.fromEntries((await q(`SELECT id,name FROM sectors`)).rows.map((r) => [r.name, r.id]));
  const companyIds = {};

  for (const c of S.DEMO_COMPANIES) {
    const { rows } = await q(
      `INSERT INTO companies(name,slug,country_code,city,sector_id,size_band,description,culture,benefits,brand_color,status,featured,job_credits,cv_credits)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'verified',$11,10,20) RETURNING id`,
      [c.name, c.slug, c.country, c.city, sec[c.sector], c.size, c.description, c.culture, c.benefits, c.color, c.featured],
    );
    companyIds[c.slug] = rows[0].id;
    const email = `recruteur.${c.slug}@demo.globaltalents-resources.com`;
    const u = await q(
      `INSERT INTO users(email,password_hash,role,first_name,last_name,country_code) VALUES($1,$2,'recruiter','Recruteur',$3,$4) RETURNING id`,
      [email, demoPassword, c.name, c.country],
    );
    await q(`INSERT INTO company_members(company_id,user_id,role) VALUES($1,$2,'admin')`, [rows[0].id, u.rows[0].id]);
  }

  let i = 0;
  for (const [slug, title, f, s, city, contract, exp, study, min, max, skills] of S.DEMO_JOBS) {
    const company = S.DEMO_COMPANIES.find((c) => c.slug === slug);
    const days = (i * 3) % 25;
    await q(
      `INSERT INTO jobs(company_id,title,function_id,sector_id,country_code,city,contract_type,experience_level,study_level,
         salary_min,salary_max,show_salary,positions,description,profile,benefits,skills,status,featured,published_at,expires_at,languages,remote)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'published',$18, now() - ($19 || ' days')::interval,
         now() - ($19 || ' days')::interval + interval '56 days', $20, $21)`,
      [
        companyIds[slug], title, fn[f], sec[s], company.country, city, contract, exp, study, min, max, i % 3 !== 2,
        1 + (i % 3 === 0 ? 1 : 0),
        `${company.name} recrute pour le poste « ${title} », basé à ${city}.\n\nVous rejoindrez une équipe de ${5 + (i % 7)} personnes et contribuerez directement aux objectifs de l'entreprise. Vos principales missions :\n- piloter les activités quotidiennes du poste et en rendre compte ;\n- travailler avec les autres équipes pour améliorer les processus ;\n- proposer des améliorations concrètes et mesurables.`,
        `Vous avez une expérience pertinente et maîtrisez : ${skills.join(", ")}. Vous êtes rigoureux(se), autonome et à l'aise à l'écrit comme à l'oral.`,
        company.benefits, skills, i < 6, String(days), i % 4 === 0 ? ["Français", "Anglais"] : ["Français"], i % 5 === 1 ? "hybride" : "non",
      ],
    );
    i++;
  }

  // Questions de présélection sur quelques offres
  const jobs = (await q(`SELECT id FROM jobs ORDER BY id LIMIT 3`)).rows;
  for (const j of jobs) {
    await q(`INSERT INTO job_questions(job_id,question,eliminatory,expected,sort) VALUES($1,'Êtes-vous disponible dans les 30 jours ?',false,'oui',1)`, [j.id]);
    await q(`INSERT INTO job_questions(job_id,question,eliminatory,expected,sort) VALUES($1,'Résidez-vous dans la ville du poste ou acceptez-vous de vous y installer ?',true,'oui',2)`, [j.id]);
  }

  // Candidat de démonstration
  const cand = await q(
    `INSERT INTO users(email,password_hash,role,first_name,last_name,phone,country_code) VALUES('candidat@demo.globaltalents-resources.com',$1,'candidate','Awa','Ndiaye','+221 77 000 00 00','SN') RETURNING id`,
    [demoPassword],
  );
  const cid = cand.rows[0].id;
  await q(
    `INSERT INTO candidate_profiles(user_id,title,summary,city,experience_level,study_level,current_function_id,desired_function_ids,search_countries,current_salary,desired_salary,availability)
     VALUES($1,'Ingénieure cybersécurité','Ingénieure sécurité avec 6 ans d''expérience en SOC et en gestion des identités, dans les télécoms et la banque.','Dakar','confirme','bac5',$2,$3,'{SN,CI}','800 000 à 1 200 000 FCFA','1 200 000 à 2 000 000 FCFA','Sous 1 mois')`,
    [cid, fn["Cybersécurité"], [fn["Cybersécurité"], fn["Informatique / Développement"]]],
  );
  await q(`INSERT INTO experiences(user_id,title,company,city,start_date,end_date,description) VALUES($1,'Analyste SOC N2','Opérateur télécom (exemple)','Dakar','2021-03-01',NULL,'Surveillance SIEM, réponse aux incidents, durcissement des pare-feu.')`, [cid]);
  await q(`INSERT INTO experiences(user_id,title,company,city,start_date,end_date,description) VALUES($1,'Ingénieure sécurité','Banque régionale (exemple)','Abidjan','2019-01-01','2021-02-28','Gestion des accès, audits ISO 27001.')`, [cid]);
  await q(`INSERT INTO educations(user_id,degree,school,field,year_end) VALUES($1,'Master','École supérieure polytechnique','Sécurité des systèmes d''information',2018)`, [cid]);
  for (const sk of ["SIEM", "SOC", "ISO 27001", "Linux", "Python"]) await q(`INSERT INTO candidate_skills(user_id,name) VALUES($1,$2)`, [cid, sk]);
  await q(`INSERT INTO candidate_languages(user_id,name,level) VALUES($1,'Français','Langue maternelle'),($1,'Anglais','Courant'),($1,'Wolof','Langue maternelle')`, [cid]);
}

async function seedDemoV2() {
  const pw = await hash(process.env.DEMO_PASSWORD || "Demo-GTR-2026");
  const fn = Object.fromEntries((await q(`SELECT id,name FROM functions`)).rows.map((r) => [r.name, r.id]));
  const sec = Object.fromEntries((await q(`SELECT id,name FROM sectors`)).rows.map((r) => [r.name, r.id]));
  const allChecks = JSON.stringify({ checks: { rccm: true, tax: true, phone: true, email: true, web: true, fraud: true }, comment: "Dossier complet (démonstration).", at: new Date().toISOString() });

  // Gestionnaire des partenaires
  const pm = (await q(
    `INSERT INTO users(email,password_hash,role,first_name,last_name,phone,country_code) VALUES('gestion@demo.globaltalents-resources.com',$1,'partner_manager','Fatou','Diallo','+221 77 100 20 30','SN') RETURNING id`,
    [pw],
  )).rows[0].id;
  await q(`UPDATE companies SET account_manager_id=$1, verified_at=coalesce(verified_at,created_at), verification=$2 WHERE status='verified' AND account_manager_id IS NULL`, [pm, allChecks]);

  // Entreprise en attente de vérification
  const pend = (await q(
    `INSERT INTO companies(name,slug,country_code,city,sector_id,size_band,registration_number,website,description,status,job_credits)
     VALUES('Sahel Logistique Express','sahel-logistique-express','NE','Niamey',$1,'11 à 50','RCCM-NI-NIA-2025-B-1234','sahel-logistique.example','Transport de marchandises entre Niamey, Cotonou et Lomé.','pending',1) ON CONFLICT (slug) DO NOTHING RETURNING id`,
    [sec["Logistique / Transport"]],
  )).rows[0]?.id;
  if (pend) {
    const r = (await q(
      `INSERT INTO users(email,password_hash,role,first_name,last_name,phone,country_code) VALUES('recruteur.sahel-logistique@demo.globaltalents-resources.com',$1,'recruiter','Issoufou','Maïga','+227 90 00 11 22','NE') RETURNING id`,
      [pw],
    )).rows[0].id;
    await q(`INSERT INTO company_members(company_id,user_id,role) VALUES($1,$2,'admin')`, [pend, r]);
    await q(
      `INSERT INTO jobs(company_id,created_by,title,function_id,sector_id,country_code,city,contract_type,experience_level,study_level,description,profile,skills,status)
       VALUES($1,$2,'Chef de quai',$3,$4,'NE','Niamey','CDI','intermediaire','bac2','Organisation du chargement et du déchargement des camions.','Expérience en entrepôt.',$5,'pending')`,
      [pend, r, fn["Logistique / Transport"], sec["Logistique / Transport"], ["Entrepôt", "Gestion d'équipe"]],
    );
    const t = (await q(
      `INSERT INTO support_tickets(company_id,opened_by,category,subject,priority) VALUES($1,$2,'compte','Quand mon entreprise sera-t-elle vérifiée ?','normale') RETURNING id`,
      [pend, r],
    )).rows[0].id;
    await q(`INSERT INTO ticket_messages(ticket_id,author_id,body) VALUES($1,$2,'Bonjour, nous avons créé notre compte hier. Quels documents faut-il fournir pour la vérification ?')`, [t, r]);
  }

  // Demandes de support d'une entreprise cliente
  const lagune = (await q(`SELECT c.id, m.user_id FROM companies c JOIN company_members m ON m.company_id=c.id WHERE c.slug='lagune-banque' LIMIT 1`)).rows[0];
  if (lagune) {
    const t1 = (await q(
      `INSERT INTO support_tickets(company_id,opened_by,category,subject,priority,assigned_to,created_at,updated_at) VALUES($1,$2,'paiement','Paiement e-Wari débité mais crédits non visibles','haute',$3,now()-interval '3 hours',now()-interval '3 hours') RETURNING id`,
      [lagune.id, lagune.user_id, pm],
    )).rows[0].id;
    await q(`INSERT INTO ticket_messages(ticket_id,author_id,body,created_at) VALUES($1,$2,'Bonjour, j''ai payé le Pack 5 annonces avec e-Wari ce matin mais je ne vois pas les crédits. Merci de vérifier.',now()-interval '3 hours')`, [t1, lagune.user_id]);
    const t2 = (await q(
      `INSERT INTO support_tickets(company_id,opened_by,category,subject,status,priority,assigned_to,satisfaction,created_at,updated_at,resolved_at) VALUES($1,$2,'mise_en_avant','Mettre notre offre de contrôleur interne à la une','ferme','normale',$3,5,now()-interval '9 days',now()-interval '8 days',now()-interval '8 days') RETURNING id`,
      [lagune.id, lagune.user_id, pm],
    )).rows[0].id;
    await q(`INSERT INTO ticket_messages(ticket_id,author_id,body,created_at) VALUES($1,$2,'Pouvez-vous mettre notre offre de contrôleur interne en avant pour la campagne de recrutement ?',now()-interval '9 days'),($1,$3,'C''est fait : l''offre est à la une pendant 15 jours. Bonne campagne !',now()-interval '8 days')`, [t2, lagune.user_id, pm]);
    await q(`INSERT INTO company_notes(company_id,author_id,kind,body,created_at) VALUES($1,$2,'appel','Point trimestriel avec la DRH : 3 recrutements prévus au T4, intéressée par la CVthèque 3 mois.',now()-interval '12 days')`, [lagune.id, pm]);
  }

  // Présélection : 14 candidatures sur l'offre « Ingénieur cybersécurité (SOC) »
  const job = (await q(`SELECT id FROM jobs WHERE title='Ingénieur cybersécurité (SOC)' ORDER BY id LIMIT 1`)).rows[0].id;
  await q(`UPDATE jobs SET personality_traits='{rigueur,stabilite}' WHERE id=$1`, [job]);
  const qs = (await q(`SELECT question,eliminatory FROM job_questions WHERE job_id=$1 ORDER BY sort,id`, [job])).rows;
  const cyber = fn["Cybersécurité"];
  const PROFILES = { ouverture: "Innovateur", rigueur: "Organisateur", extraversion: "Ambassadeur", cooperation: "Fédérateur", stabilite: "Pilier" };
  const L = {
    fort: (x) => `Madame, Monsieur,\n\nAnalyste SOC depuis ${x.y} ans, je souhaite rejoindre Teranga Télécom pour contribuer à la protection de vos réseaux et de vos clients. Dans mon poste actuel, j'ai mis en place des règles de corrélation SIEM qui ont réduit de 40 % le temps de traitement des incidents, et j'ai piloté la mise en conformité ISO 27001 de deux sites.\n\nVotre projet de SOC 24 h/24 m'intéresse particulièrement : j'aimerais y apporter mon expérience de la réponse aux incidents et de l'encadrement d'analystes N1. Je serais ravi(e) d'en discuter avec vous.`,
    bon: () => `Bonjour,\n\nPassionné(e) de cybersécurité, je suis motivé(e) par votre offre d'ingénieur SOC. J'ai travaillé sur la surveillance SIEM et le durcissement de serveurs Linux, et je souhaite évoluer dans un opérateur télécom comme le vôtre. Je suis rigoureux(se) et à l'aise dans le travail en équipe.`,
    type: () => `Madame, Monsieur,\n\nJe vous soumets ma candidature pour le poste proposé dans votre entreprise. Vous trouverez ci-joint mon CV. Je reste à votre disposition pour tout complément d'information.\n\nCordialement.`,
    court: () => `Je suis motivé pour ce poste.`,
    vide: () => ``,
  };
  const C = [
    ["Moussa", "Fall", "Dakar", "SN", "confirme", "bac5", "Master Cybersécurité", ["SIEM", "SOC", "ISO 27001", "Linux", "Firewall", "Python"], "1 100 000 FCFA", "Immédiate", L.fort({ y: 6 }), { rigueur: 78, stabilite: 74, ouverture: 60, extraversion: 45, cooperation: 62 }, false, false],
    ["Aminata", "Sow", "Dakar", "SN", "expert", "bac5", "Ingénieur Réseaux et sécurité", ["SIEM", "SOC", "ISO 27001", "Firewall"], "1 800 000 FCFA", "Sous 3 mois", L.fort({ y: 12 }), { rigueur: 70, stabilite: 80, ouverture: 55, extraversion: 60, cooperation: 50 }, false, false],
    ["Ibrahima", "Diop", "Thiès", "SN", "confirme", "bac5", "Master Informatique", ["SIEM", "SOC", "Linux"], "950 000 FCFA", "Sous 1 mois", L.type(), null, false, false],
    ["Khadija", "Ba", "Dakar", "SN", "intermediaire", "bac5", "Master Sécurité des systèmes d'information", ["SOC", "SIEM", "Linux", "Firewall", "Python"], "900 000 FCFA", "Immédiate", L.bon(), { rigueur: 85, stabilite: 60, ouverture: 70, extraversion: 40, cooperation: 66 }, false, false],
    ["Ousmane", "Ndiaye", "Dakar", "SN", "confirme", "bac4", "Maîtrise Réseaux", ["ISO 27001", "Firewall", "Linux"], "1 200 000 FCFA", "Sous 1 mois", L.bon(), null, false, false],
    ["Fatoumata", "Camara", "Abidjan", "CI", "confirme", "bac5", "Master Cybersécurité", ["SIEM", "SOC", "ISO 27001", "Linux", "Firewall"], "1 300 000 FCFA", "Sous 3 mois", L.fort({ y: 7 }), null, false, false],
    ["Cheikh", "Sarr", "Dakar", "SN", "junior", "bac3", "Licence Informatique", ["Linux", "Python"], "600 000 FCFA", "Immédiate", L.court(), null, false, false],
    ["Mariama", "Diallo", "Saint-Louis", "SN", "confirme", "bac5", "Master Sécurité informatique", ["SIEM", "SOC", "ISO 27001"], "1 000 000 FCFA", "Immédiate", L.bon(), { rigueur: 72, stabilite: 68, ouverture: 50, extraversion: 55, cooperation: 70 }, false, false],
    ["Pape", "Gueye", "Dakar", "SN", "confirme", "bac5", "Master Cybersécurité", ["SIEM", "SOC", "ISO 27001", "Linux", "Firewall"], "1 000 000 FCFA", "Immédiate", L.fort({ y: 5 }), null, true, false],
    ["Aïssatou", "Kane", "Dakar", "SN", "intermediaire", "bac5", "Master Réseaux et télécoms", ["SIEM", "Firewall"], "850 000 FCFA", "Sous 1 mois", L.vide(), null, false, false],
    ["Lamine", "Cissé", "Mbour", "SN", "confirme", "bac5", "Ingénieur Informatique", ["SOC", "Linux", "Firewall", "ISO 27001"], "1 400 000 FCFA", "En veille", L.bon(), null, false, false],
    ["Ndeye", "Faye", "Dakar", "SN", "confirme", "bac5", "Master Cybersécurité", ["SIEM", "SOC", "ISO 27001", "Linux"], "1 150 000 FCFA", "Sous 1 mois", L.fort({ y: 8 }), { rigueur: 66, stabilite: 82, ouverture: 58, extraversion: 52, cooperation: 60 }, false, true],
    ["Babacar", "Mbaye", "Kaolack", "SN", "debutant", "bac5", "Master Sécurité des réseaux", ["Python", "Linux"], "500 000 FCFA", "Immédiate", L.bon(), null, false, false],
    ["Seynabou", "Thiam", "Dakar", "SN", "confirme", "bac5", "Master Informatique", ["SIEM", "SOC", "Firewall", "Linux"], "Négociable", "Immédiate", L.bon(), null, false, false],
  ];
  let i = 0;
  for (const [first, last, city, country, exp, study, degree, skills, salary, avail, letter, test, failed, anonymous] of C) {
    const slug = `${first}.${last}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const u = (await q(
      `INSERT INTO users(email,password_hash,role,first_name,last_name,country_code) VALUES($1,$2,'candidate',$3,$4,$5) ON CONFLICT (email) DO NOTHING RETURNING id`,
      [`candidat.${slug}@demo.globaltalents-resources.com`, pw, first, last, country],
    )).rows[0]?.id;
    if (!u) continue;
    await q(
      `INSERT INTO candidate_profiles(user_id,title,city,experience_level,study_level,current_function_id,desired_function_ids,search_countries,desired_salary,availability,share_test)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [u, exp === "debutant" ? "Jeune diplômé en cybersécurité" : "Analyste et ingénieur cybersécurité", city, exp, study, i % 5 === 4 ? fn["Télécoms / Réseaux"] : cyber, i % 5 === 4 ? [fn["Télécoms / Réseaux"]] : [cyber], country === "CI" ? ["CI", "SN"] : ["SN"], salary, avail, !!test],
    );
    await q(`INSERT INTO educations(user_id,degree,school,field,year_end) VALUES($1,$2,'Université (exemple)','',$3)`, [u, degree, 2024 - (exp === "expert" ? 14 : exp === "confirme" ? 7 : exp === "intermediaire" ? 4 : 1)]);
    for (const sk of skills) await q(`INSERT INTO candidate_skills(user_id,name) VALUES($1,$2)`, [u, sk]);
    await q(`INSERT INTO candidate_languages(user_id,name,level) VALUES($1,'Français','Langue maternelle'),($1,'Anglais',$2)`, [u, i % 3 === 2 ? "Notions" : "Courant"]);
    if (test) {
      const top = Object.entries(test).sort((a, b) => b[1] - a[1])[0][0];
      await q(`INSERT INTO personality_results(user_id,answers,scores,profile) VALUES($1,$2,$3,$4)`, [u, JSON.stringify(Array(25).fill(0)), JSON.stringify(test), PROFILES[top]]);
    }
    const answers = qs.map((x) => ({ question: x.question, answer: x.eliminatory && failed ? "non" : "oui" }));
    await q(
      `INSERT INTO applications(job_id,candidate_id,cover_letter,answers,score,anonymous,share_test,failed_screening,created_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,now() - make_interval(hours => $9))`,
      [job, u, letter, JSON.stringify(answers), 55 + ((i * 7) % 40), anonymous, !!test, failed, 2 + i * 5],
    );
    i++;
  }
}
