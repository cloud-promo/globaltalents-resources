"""Tests : gestion des partenaires, support recruteur, présélection automatique, test de personnalité.
Prérequis : application lancée avec SEED_DEMO=1 (données de démonstration lot 2).
Usage : python3 tests/partenaires.py [URL_APP]
"""
import os, sys, time, urllib.parse
from playwright.sync_api import sync_playwright, expect

APP = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome")
PW = os.environ.get("DEMO_PASSWORD", "Demo-GTR-2026")
PM = "gestion@demo.globaltalents-resources.com"
REC = "recruteur.teranga-telecom@demo.globaltalents-resources.com"
RUN = str(int(time.time()))[-6:]
results = []

def step(name, fn):
    try:
        fn(); results.append(True); print("OK  ", name)
    except Exception as e:
        results.append(False); print("ÉCHEC", name, ":", str(e)[:600]); raise

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME)
    page = b.new_page(viewport={"width": 1280, "height": 900})

    def login(email, pw=PW):
        page.context.clear_cookies()
        page.goto(APP + "/connexion")
        page.fill("input[name=email]", email); page.fill("input[name=password]", pw)
        page.click("button[type=submit]"); page.wait_for_load_state("networkidle")

    def t_pm_home():
        login(PM)
        assert page.url.endswith("/partenaires"), page.url
        expect(page.get_by_text("Inscriptions à vérifier").first).to_be_visible()
        # Un gestionnaire n'a pas accès à l'administration générale ni à l'espace recruteur
        page.goto(APP + "/admin"); assert "/admin" not in page.url
        page.goto(APP + "/recruteur"); assert "/recruteur" not in page.url
    step("Gestionnaire partenaires : accès à son espace, pas aux autres", t_pm_home)

    def t_verify():
        page.goto(APP + "/partenaires/inscriptions")
        page.locator("li", has_text="Sahel Logistique Express").get_by_text("Ouvrir le dossier").click()
        page.wait_for_load_state("networkidle")
        boxes = page.locator("input[name=checks]")
        boxes.nth(0).check()
        page.get_by_role("button", name="Valider l'entreprise").click(); page.wait_for_load_state("networkidle")
        expect(page.get_by_text("1 / 6 contrôles")).to_be_visible()  # validation refusée : contrôles incomplets
        expect(page.get_by_text("À vérifier").first).to_be_visible()
        for i in range(boxes.count()): boxes.nth(i).check()
        page.get_by_role("button", name="Valider l'entreprise").click(); page.wait_for_load_state("networkidle")
        expect(page.get_by_text("Vérifiée").first).to_be_visible()
        expect(page.locator("select[name=manager_id]")).to_have_value(page.locator("select[name=manager_id] option", has_text="Fatou").get_attribute("value"))
    step("Vérification d'une inscription : 6 contrôles obligatoires, chargé de compte attribué", t_verify)

    def t_gesture_feature():
        page.fill("input[name=jobs]", "2"); page.fill("input[name=gesture_reason]", f"Bienvenue {RUN}")
        page.click("text=Offrir ces crédits")
        expect(page.get_by_text("Crédits ajoutés et entreprise prévenue.")).to_be_visible()
        expect(page.get_by_text(f"Motif : Bienvenue {RUN}")).to_be_visible()
        page.locator("form", has=page.locator("input[name=target][value=company]")).locator("select[name=days]").select_option("15")
        page.locator("form", has=page.locator("input[name=target][value=company]")).get_by_role("button", name="Appliquer").click()
        page.wait_for_load_state("networkidle")
        expect(page.get_by_text("Mise en avant jusqu'au")).to_be_visible()
        page.goto(APP + "/partenaires/mises-en-avant")
        expect(page.get_by_text("Sahel Logistique Express")).to_be_visible()
    step("Geste commercial tracé et mise en avant datée", t_gesture_feature)

    state = {}
    def t_ticket():
        login(REC)
        page.goto(APP + "/recruteur/support")
        page.select_option("select[name=category]", "paiement")
        page.fill("input[name=subject]", f"Facture introuvable {RUN}")
        page.fill("textarea[name=body]", "Bonjour, je ne retrouve pas la facture de mon dernier paiement e-Wari.")
        page.click("text=Envoyer la demande"); page.wait_for_url("**/recruteur/support/**")
        state["t"] = page.url.split("/")[-1].split("?")[0]
        login(PM)
        page.goto(APP + f"/partenaires/support/{state['t']}")
        page.fill("textarea[name=body]", "Note : vérifier côté e-Wari"); page.check("input[name=internal]")
        page.click("text=Envoyer"); expect(page.get_by_text("Note interne ajoutée.")).to_be_visible()
        page.fill("textarea[name=body]", "Bonjour, votre facture est dans Abonnement et factures."); page.uncheck("input[name=internal]")
        page.select_option("select[name=status]", "resolu")
        page.get_by_role("button", name="Envoyer").click(); expect(page.get_by_text("Réponse envoyée au client.")).to_be_visible()
        login(REC)
        page.goto(APP + f"/recruteur/support/{state['t']}")
        expect(page.get_by_text("votre facture est dans Abonnement")).to_be_visible()
        expect(page.get_by_text("vérifier côté e-Wari")).to_have_count(0)  # note interne invisible du client
        page.get_by_role("button", name="5 sur 5").click(); page.wait_for_load_state("networkidle")
        expect(page.get_by_text("Merci pour votre note : 5 / 5.")).to_be_visible()
    step("Support : demande, note interne invisible, réponse, satisfaction", t_ticket)

    def t_screening():
        page.goto(APP + "/recruteur/offres")
        jid = page.locator("tr", has_text="Ingénieur cybersécurité (SOC)").get_by_role("link", name="Top 10").get_attribute("href").split("/")[-2]
        page.goto(APP + f"/recruteur/offres/{jid}/preselection")
        names = page.locator("ol > li a.text-lg").all_inner_texts()
        assert len(names) == 10, names
        assert names[0] == "Moussa Fall", names
        assert "Pape Gueye" not in names, "réponse éliminatoire exclue"
        expect(page.get_by_text("Exclus par vos critères obligatoires (1)")).to_be_visible()
        assert any("anonyme" in n for n in names), "candidature anonyme masquée"
        q = urllib.parse.quote("Top 5 à Dakar disponibles immédiatement moins de 1 200 000")
        page.goto(APP + f"/recruteur/offres/{jid}/preselection?q={q}")
        expect(page.get_by_text("habitant Dakar")).to_be_visible()
        expect(page.get_by_text("prétentions ≤ 1 200 000 FCFA")).to_be_visible()
        names = page.locator("ol > li a.text-lg").all_inner_texts()
        assert names and "Aminata Sow" not in names and "Fatoumata Camara" not in names, names
        # Réglage : ignorer le salaire fait remonter un profil au-dessus du budget
        page.goto(APP + f"/recruteur/offres/{jid}/preselection")
        page.select_option("select[name=w_salary]", "0"); page.click("text=Enregistrer et reclasser"); page.wait_for_load_state("networkidle")
        expect(page.locator("select[name=w_salary]")).to_have_value("0")
        page.select_option("select[name=w_salary]", "1"); page.click("text=Enregistrer et reclasser"); page.wait_for_load_state("networkidle")
        # Invitation en entretien depuis le classement
        page.locator("ol > li", has_text="Moussa Fall").get_by_role("button", name="Inviter en entretien").click()
        page.wait_for_load_state("networkidle")
        expect(page.locator("ol > li", has_text="Moussa Fall").get_by_text("Entretien RH")).to_be_visible()
    step("Présélection : top 10, exclusions, demande en langage naturel, réglages, invitation", t_screening)

    def t_personality():
        login("candidat.moussa.fall@demo.globaltalents-resources.com")
        page.goto(APP + "/candidat/test/resultats")
        expect(page.get_by_text("Votre profil Boussole")).to_be_visible()
        page.goto(APP + "/offres?q=cybers%C3%A9curit%C3%A9")
        page.get_by_role("link", name="Ingénieur cybersécurité (SOC)").first.click()
        expect(page.get_by_text("Adéquation de personnalité : 76 %")).to_be_visible()
    step("Test de personnalité : résultats et adéquation affichée sur l'offre", t_personality)
    b.close()

print(f"\n{sum(results)}/{len(results)} tests partenaires et présélection réussis")
sys.exit(0 if all(results) else 1)
