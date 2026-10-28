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
