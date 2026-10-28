"""Test de bout en bout des parcours clés.
Usage : python3 tests/e2e.py [URL]   (base locale par défaut, données de démonstration chargées)
Mots de passe : comptes de démonstration du seed (DEMO_PASSWORD) et administrateur local (.env.local).
"""
import os, sys, time, tempfile
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome")
DEMO_PW = os.environ.get("DEMO_PASSWORD", "Demo-GTR-2026")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@demo.globaltalents-resources.com")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "Admin-GTR-2026")
RUN = str(int(time.time()))
results = []

def step(name, fn):
    t = time.time()
    try:
        fn()
        results.append((True, name))
        print(f"OK   {name} ({time.time()-t:.1f}s)")
    except Exception as e:
        results.append((False, name))
        print(f"ÉCHEC {name} : {str(e)[:400]}")
        raise

def login(page, email, pw):
    page.goto(BASE + "/connexion")
    page.fill("input[name=email]", email)
    page.fill("input[name=password]", pw)
    page.click("button[type=submit]")
    page.wait_for_load_state("networkidle")

def logout(page):
    page.context.clear_cookies()

# Un vrai petit PDF pour le CV
pdf = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
pdf.write(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")
pdf.close()

cand_email = f"cand{RUN}@test.gtr"
rec_email = f"rec{RUN}@test.gtr"
company = f"Sénégal Test SARL {RUN}"
job_title = f"Comptable confirmé test {RUN}"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    def public_pages():
        for path in ["/", "/offres", "/offres?pays=CI&contrat=CDI", "/entreprises", "/conseils", "/recruteurs", "/infos/faq", "/sitemap.xml", "/robots.txt", "/api/health"]:
            r = page.goto(BASE + path)
            assert r.status == 200, f"{path} -> {r.status}"
        r = page.goto(BASE + "/candidat")
        assert "/connexion" in page.url, "l'espace candidat doit exiger une connexion"
        r = page.goto(BASE + "/offres/999999-nexiste-pas")
        assert r.status == 404, "offre inexistante -> 404"
    step("Pages publiques et protections", public_pages)

    def search():
        page.goto(BASE + "/offres?q=cybers%C3%A9curit%C3%A9")
        expect(page.locator("article").first).to_contain_text("cybersécurité", ignore_case=True)
        page.goto(BASE + "/offres?pays=GN")
        assert page.locator("article").count() == 4, "4 offres de démo en Guinée"
    step("Recherche et filtres", search)

    def register_candidate():
        page.goto(BASE + "/inscription")
        page.fill("input[name=first_name]", "Moussa")
        page.fill("input[name=last_name]", "Traoré")
        page.fill("input[name=email]", cand_email)
        page.fill("input[name=phone]", "+223 70 00 00 00")
        page.select_option("select[name=country_code]", "ML")
        page.fill("input[name=password]", "MotDePasse-Test-1")
        page.check("input[name=consent]")
        page.click("button[type=submit]")
        page.wait_for_url("**/candidat/profil**")
        expect(page.get_by_text("Votre compte est créé")).to_be_visible()
    step("Inscription candidat", register_candidate)

    def build_profile():
        page.set_input_files("input[name=file]", pdf.name)
        page.locator("form:has(input[name=file]) button[type=submit]").click()
        expect(page.get_by_text("CV ajouté.")).to_be_visible()
        expect(page.get_by_text("CV principal", exact=True)).to_be_visible()
        f = page.locator("form:has(select[name=experience_level])")
        f.locator("select[name=experience_level]").select_option("confirme")
        f.locator("select[name=study_level]").select_option("bac5")
        f.locator("select[name=desired_function_ids]").first.select_option(label="Comptabilité / Finance / Contrôle de gestion")
        f.locator("input[name=search_countries][value=ML]").check()
        f.locator("input[name=search_countries][value=SN]").check()
        f.locator("button[type=submit]").click()
        expect(page.get_by_text("Souhaits enregistrés")).to_be_visible()
        s = page.locator("form:has(input[name=name][placeholder*='Excel'])")
        s.locator("input[name=name]").fill("SYSCOHADA, Sage, Excel, Fiscalité")
        s.locator("button[type=submit]").click()
        expect(page.get_by_text("4 compétences ajoutées")).to_be_visible()
    step("Profil candidat : CV, souhaits, compétences", build_profile)

    def apply_demo_job():
        page.goto(BASE + "/offres?q=Comptable&pays=ML")
        page.locator("article a", has_text="Comptable").first.click()
        page.wait_for_load_state("networkidle")
        expect(page.get_by_text("% de correspondance").first).to_be_visible()
        page.fill("textarea[name=cover_letter]", "Disponible immédiatement, 6 ans en cabinet.")
        page.click("text=Envoyer ma candidature")
        page.wait_for_url("**/candidat/candidatures**")
        expect(page.get_by_text("Vos chances de succès")).to_be_visible()
        expect(page.get_by_text("CV pas encore ouvert")).to_be_visible()
    step("Candidature à une offre de démonstration", apply_demo_job)

    def save_and_alert():
        page.goto(BASE + "/offres?pays=ML")
        page.locator("button[aria-label=\"Sauvegarder l'offre\"]").first.click()
        page.wait_for_load_state("networkidle")
        page.goto(BASE + "/candidat/sauvegardees")
        assert page.locator("article").count() >= 1, "offre sauvegardée attendue"
        page.goto(BASE + "/offres?pays=ML&contrat=CDI")
        page.fill("input[name=name][placeholder=\"Nom de l'alerte\"]", "CDI au Mali")
        page.click("text=Créer l'alerte")
        page.wait_for_url("**/candidat/alertes**")
        expect(page.locator("input[value='CDI au Mali']")).to_be_visible()
    step("Offre sauvegardée et alerte personnalisée", save_and_alert)

    def settings_export():
        page.goto(BASE + "/candidat/parametres")
        page.uncheck("input[name=visible_cvtheque]")
        page.click("text=Enregistrer les paramètres")
        expect(page.get_by_text("Paramètres enregistrés.")).to_be_visible()
        page.check("input[name=visible_cvtheque]")
        page.click("text=Enregistrer les paramètres")
        r = page.request.get(BASE + "/api/me/export")
        assert r.status == 200 and cand_email in r.text(), "export des données"
    step("Paramètres de visibilité et export des données", settings_export)
    logout(page)

    def register_recruiter():
        page.goto(BASE + "/recruteurs/inscription")
        page.fill("input[name=company_name]", company)
        page.select_option("select[name=country_code]", "SN")
        page.fill("input[name=city]", "Dakar")
        page.select_option("select[name=sector_id]", label="Conseil / Audit")
        page.select_option("select[name=size_band]", "11 à 50")
        page.fill("input[name=registration_number]", "SN-DKR-2026-B-12345")
        page.fill("input[name=first_name]", "Fatou")
        page.fill("input[name=last_name]", "Sall")
        page.fill("input[name=email]", rec_email)
        page.fill("input[name=phone]", "+221 77 111 22 33")
        page.fill("input[name=password]", "MotDePasse-Rec-1")
        page.check("input[name=consent]")
        page.click("button[type=submit]")
        page.wait_for_url("**/recruteur?bienvenue=1")
        expect(page.get_by_text("en cours de vérification")).to_be_visible()
    step("Inscription recruteur (entreprise à vérifier)", register_recruiter)

    def create_job():
        page.goto(BASE + "/recruteur/offres/nouvelle")
        page.fill("input[name=title]", job_title)
        page.select_option("select[name=function_id]", label="Comptabilité / Finance / Contrôle de gestion")
        page.select_option("select[name=sector_id]", label="Conseil / Audit")
        page.select_option("select[name=contract_type]", "CDI")
        page.select_option("select[name=experience_level]", "confirme")
        page.select_option("select[name=study_level]", "bac5")
        page.fill("input[name=salary_min]", "600000")
        page.fill("input[name=salary_max]", "900000")
        page.fill("textarea[name=description]", "Cabinet en croissance à Dakar, nous recherchons un comptable confirmé.\n- tenir la comptabilité de 30 clients PME\n- préparer les déclarations fiscales\n- produire les états financiers SYSCOHADA")
        page.fill("input[name=skills]", "SYSCOHADA, Sage, Fiscalité")
        page.fill("input[name=question_0]", "Disposez-vous d'au moins 5 ans d'expérience en cabinet ?")
        page.check("input[name=elim_0]")
        page.click("button[name=intent][value=submit]")
        page.wait_for_url("**/recruteur/offres?soumise=**")
        expect(page.get_by_text("En modération").first).to_be_visible()
    step("Création d'une offre (crédit offert)", create_job)
    logout(page)

    def admin_moderation():
        login(page, ADMIN_EMAIL, ADMIN_PW)
        assert "/admin" in page.url, f"admin redirigé vers {page.url}"
        page.goto(BASE + "/admin/entreprises?statut=pending")
        page.locator("li", has_text=company).locator("button", has_text="Valider").click()
        page.wait_for_load_state("networkidle")
        page.goto(BASE + "/admin/offres")
        page.locator("li", has_text=job_title).locator("button", has_text="Publier").click()
        page.wait_for_load_state("networkidle")
        page.goto(BASE + "/admin/offres?statut=published&q=" + RUN)
        expect(page.get_by_text(job_title)).to_be_visible()
        page.goto(BASE + "/admin/audit")
        expect(page.get_by_text("job.publish").first).to_be_visible()
    step("Back-office : validation de l'entreprise et publication", admin_moderation)
    logout(page)

    def candidate_applies_new_job():
        login(page, cand_email, "MotDePasse-Test-1")
        page.goto(BASE + "/offres?q=" + RUN)
        page.locator("article a").first.click()
        page.wait_for_load_state("networkidle")
        page.locator("input[type=radio][value=oui]").first.check()
        page.click("text=Envoyer ma candidature")
        page.wait_for_url("**/candidat/candidatures**")
    step("Le candidat postule à la nouvelle offre", candidate_applies_new_job)
    logout(page)

    def recruiter_pipeline():
        login(page, rec_email, "MotDePasse-Rec-1")
        expect(page.get_by_text("1 candidature à trier")).to_be_visible()
        page.goto(BASE + "/recruteur/offres")
        page.click(f"text={job_title}")
        page.wait_for_load_state("networkidle")
        job_id = page.url.rstrip("/").split("/")[-1].split("?")[0]
        page.click("text=Moussa Traoré")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_text("Correspondance :")).to_be_visible()
        page.select_option("select#stage", "entretien_rh")
        page.click("text=Mettre à jour")
        page.wait_for_load_state("networkidle")
        page.fill("textarea[name=body][aria-label=Note]", "Très bon profil, à recevoir.")
        page.select_option("select[name=rating]", "5")
        page.click("text=Ajouter la note")
        expect(page.get_by_text("Note ajoutée")).to_be_visible()
        r = page.request.get(BASE + page.locator("a", has_text="Ouvrir le CV").get_attribute("href"))
        assert r.status == 200 and r.headers["content-type"] == "application/pdf", "téléchargement du CV"
        csv = page.request.get(f"{BASE}/api/recruteur/offres/{job_id}/export")
        assert csv.status == 200 and "Traoré" in csv.text(), f"export CSV ({csv.status})"
    step("Recruteur : fiche candidat, étape, note, CV", recruiter_pipeline)

    def recruiter_payment_cvtheque():
        page.goto(BASE + "/recruteur/abonnement")
        page.check("input[name=plan][value=cvtheque1]")
        page.check("input[name=provider][value=wave]")
        page.fill("input[name=phone]", "+221 77 111 22 33")
        page.click("text=Continuer vers le paiement")
        page.wait_for_url("**/recruteur/paiement/**")
        page.click("text=Simuler un paiement réussi")
        expect(page.get_by_text("Paiement reçu")).to_be_visible()
        page.click("text=Voir la facture")
        expect(page.get_by_text("Total TTC")).to_be_visible()
        page.goto(BASE + "/recruteur/cvtheque?q=cybers")
        page.locator("button", has_text="Voir les coordonnées").first.click()
        page.wait_for_load_state("networkidle")
        expect(page.locator("a[href^='mailto:']").first).to_be_visible()
    step("Paiement Wave (démo), facture et CVthèque", recruiter_payment_cvtheque)

    def access_control():
        # Un recruteur ne voit pas les candidatures d'une autre entreprise
        r = page.goto(BASE + "/recruteur/offres/1")
        assert r.status == 404, f"offre d'une autre entreprise -> {r.status}"
        r = page.goto(BASE + "/admin")
        assert "/admin" not in page.url, "un recruteur ne doit pas accéder à l'administration"
    step("Cloisonnement entre entreprises et rôles", access_control)
    logout(page)

    def candidate_sees_progress():
        login(page, cand_email, "MotDePasse-Test-1")
        page.goto(BASE + "/candidat/candidatures")
        card = page.locator("article", has_text=job_title)
        expect(card.get_by_text("Entretien").first).to_be_visible()
        expect(card.get_by_text("CV consulté par le recruteur")).to_be_visible()
        page.goto(BASE + "/candidat/notifications")
        expect(page.get_by_text("Votre candidature avance").first).to_be_visible()
    step("Le candidat voit l'avancement et les notifications", candidate_sees_progress)

    def mobile():
        m = browser.new_page(viewport={"width": 375, "height": 800})
        m.goto(BASE + "/")
        w = m.evaluate("document.documentElement.scrollWidth")
        assert w <= 376, f"défilement horizontal sur mobile ({w}px)"
        m.goto(BASE + "/offres")
        w = m.evaluate("document.documentElement.scrollWidth")
        assert w <= 376, f"défilement horizontal sur /offres ({w}px)"
        m.close()
    step("Affichage mobile sans défilement horizontal", mobile)

    browser.close()

ok = sum(1 for r in results if r[0])
print(f"\n{ok}/{len(results)} parcours réussis")
if errors:
    print("Erreurs JavaScript :", errors[:5])
sys.exit(0 if ok == len(results) and not errors else 1)
