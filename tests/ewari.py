"""Tests du paiement e-Wari contre le simulateur (scripts/mock-ewari.mjs).
Prérequis : application lancée avec PAYMENTS_MODE=ewari, EWARI_API_URL=http://localhost:4010,
EWARI_SECRET_KEY=sk_test_local, EWARI_WEBHOOK_SECRET=whsec_local, et le simulateur démarré.
Usage : python3 tests/ewari.py [URL_APP] [URL_SIMULATEUR]
"""
import os, sys, time, json, hmac, hashlib, urllib.request
from playwright.sync_api import sync_playwright, expect

APP = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
MOCK = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:4010"
KEY = os.environ.get("EWARI_SECRET_KEY", "sk_test_local")
WHSEC = os.environ.get("EWARI_WEBHOOK_SECRET", "whsec_local")
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome")
REC = "recruteur.faso-energie-solaire@demo.globaltalents-resources.com"
PW = os.environ.get("DEMO_PASSWORD", "Demo-GTR-2026")
results = []

def mock(path, body=None):
    req = urllib.request.Request(MOCK + path, data=json.dumps(body or {}).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}, method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def post_webhook(raw, sig):
    req = urllib.request.Request(APP + "/api/webhooks/ewari", data=raw.encode(), headers={"Content-Type": "application/json", "X-Ewari-Signature": sig}, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def sign(raw, t=None, secret=WHSEC):
    t = t or int(time.time())
    return f"t={t},v1=" + hmac.new(secret.encode(), f"{t}.{raw}".encode(), hashlib.sha256).hexdigest()

def step(name, fn):
    try:
        fn(); results.append(True); print("OK  ", name)
    except Exception as e:
        results.append(False); print("ÉCHEC", name, ":", str(e)[:500]); raise

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME)
    page = b.new_page(viewport={"width": 1280, "height": 900})
    page.goto(APP + "/connexion")
    page.fill("input[name=email]", REC); page.fill("input[name=password]", PW)
    page.click("button[type=submit]"); page.wait_for_url("**/recruteur**")

    def credits():
        page.goto(APP + "/recruteur/abonnement")
        return int(page.locator("dd").first.inner_text())

    def start(plan="annonce"):
        page.goto(APP + "/recruteur/abonnement")
        page.check(f"input[name=plan][value={plan}]")
        page.click("text=Payer avec e-Wari")
        page.wait_for_url("**/recruteur/paiement/**")
        local_id = page.url.split("/")[-1]
        href = page.locator("a", has_text="Ouvrir l'application e-Wari").get_attribute("href")
        assert href.startswith("ewari://pay?p=GTR001&a="), href
        return local_id, href.split("r=")[-1]

    state = {}

    def t_create():
        state["c0"] = credits()
        lid, pid = start()
        state["lid"], state["pid"] = lid, pid
        expect(page.get_by_role("img", name="QR code de paiement e-Wari")).to_be_visible()
        expect(page.get_by_text("En attente de la confirmation e-Wari")).to_be_visible()
        remote = mock(f"/payments/{pid}", None)
        assert remote["amount"] == 35000 and remote["currency"] == "XOF" and remote["reference"].startswith("GTR-"), remote
    step("Création du paiement chez e-Wari, QR et lien affichés", t_create)

    def t_success_webhook():
        out = mock(f"/payments/{state['pid']}/simulate", {"outcome": "succeeded", "replay": True})
        assert out["webhook"]["status"] == 200, out["webhook"]
        assert out["replay"]["status"] == 200 and "duplicate" in out["replay"]["body"], out["replay"]
        page.goto(APP + f"/recruteur/paiement/{state['lid']}")
        expect(page.get_by_text("Paiement reçu")).to_be_visible()
        assert credits() == state["c0"] + 1, "un seul crédit ajouté malgré le webhook rejoué"
    step("Paiement réussi : webhook signé, crédit ajouté une seule fois malgré le rejeu", t_success_webhook)

    def t_auto_refresh():
        lid, pid = start()
        mock(f"/payments/{pid}/simulate", {"outcome": "succeeded", "webhook": False})
        # Webhook perdu : la page se met à jour seule en interrogeant e-Wari
        expect(page.get_by_text("Paiement reçu")).to_be_visible(timeout=15000)
    step("Webhook perdu : la page interroge e-Wari et se met à jour seule", t_auto_refresh)

    def t_bad_signature():
        lid, pid = start()
        out = mock(f"/payments/{pid}/simulate", {"outcome": "succeeded", "bad_signature": True})
        assert out["webhook"]["status"] == 401, out["webhook"]
        evt = {"id": f"evt_forge1_{int(time.time()*1000)}", "type": "payment.succeeded", "data": {"id": pid, "status": "succeeded"}}
        raw = json.dumps(evt)
        assert post_webhook(raw, sign(raw, t=int(time.time()) - 3600))[0] == 401, "signature trop ancienne refusée"
        assert post_webhook(raw, "t=1,v1=00")[0] == 401
        assert post_webhook(raw, "")[0] == 401
    step("Signature invalide, absente ou trop ancienne : refusée (401)", t_bad_signature)

    def t_forged_body():
        # Webhook correctement signé mais qui ment : e-Wari dit « pending ». Rien ne doit être crédité.
        c = credits()
        lid, pid = start()
        evt = {"id": f"evt_forge2_{int(time.time()*1000)}", "type": "payment.succeeded", "data": {"id": pid, "status": "succeeded", "amount": 35000}}
        raw = json.dumps(evt)
        code, body = post_webhook(raw, sign(raw))
        assert code == 503 and '"retry":true' in body.replace(" ", ""), (code, body)  # e-Wari devra renvoyer l'événement
        assert credits() == c, "un webhook non confirmé par l'API ne crédite rien"
        mock(f"/payments/{pid}/cancel", {})
    step("Webhook signé mais non confirmé par l'API e-Wari : rien n'est crédité, e-Wari doit le renvoyer", t_forged_body)

    def t_early_webhook_retry():
        # Le webhook arrive avant que l'API e-Wari ne confirme ; la nouvelle tentative du même événement crédite.
        c = credits()
        lid, pid = start()
        evt = {"id": f"evt_early_{int(time.time()*1000)}", "type": "payment.succeeded", "data": {"id": pid}}
        raw = json.dumps(evt)
        assert post_webhook(raw, sign(raw))[0] == 503
        mock(f"/payments/{pid}/simulate", {"outcome": "succeeded", "webhook": False})
        code, body = post_webhook(raw, sign(raw))
        assert code == 200 and '"status":"paid"' in body.replace(" ", ""), (code, body)
        assert credits() == c + 1
    step("Webhook arrivé trop tôt : la nouvelle tentative d'e-Wari est bien prise en compte", t_early_webhook_retry)

    def t_tampered_amount():
        c = credits()
        lid, pid = start()
        mock(f"/payments/{pid}/simulate", {"outcome": "succeeded", "tamper_amount": 100})
        page.goto(APP + f"/recruteur/paiement/{lid}")
        expect(page.get_by_text("Payer avec e-Wari", exact=True)).to_be_visible()
        assert credits() == c, "montant différent : pas de crédit"
        page.goto(APP + "/recruteur/paiement/" + lid)
    step("Montant payé différent du montant demandé : refusé et signalé", t_tampered_amount)

    def t_failed():
        lid, pid = start()
        mock(f"/payments/{pid}/simulate", {"outcome": "failed"})
        page.goto(APP + f"/recruteur/paiement/{lid}")
        expect(page.get_by_text("Paiement non abouti")).to_be_visible()
        expect(page.get_by_text("Vérifiez votre solde e-Wari")).to_be_visible()
    step("Paiement refusé (solde insuffisant)", t_failed)

    def t_cancel():
        lid, pid = start()
        page.click("text=Annuler ce paiement")
        page.wait_for_load_state("networkidle")
        expect(page.get_by_text("Ce paiement a été annulé")).to_be_visible()
        assert mock(f"/payments/{pid}", None)["status"] == "cancelled"
    step("Annulation par le recruteur, répercutée chez e-Wari", t_cancel)

    def t_admin():
        page.context.clear_cookies()
        page.goto(APP + "/connexion")
        page.fill("input[name=email]", os.environ.get("ADMIN_EMAIL", "admin@demo.globaltalents-resources.com"))
        page.fill("input[name=password]", os.environ.get("ADMIN_PASSWORD", "Admin-GTR-2026"))
        page.click("button[type=submit]"); page.wait_for_url("**/admin**")
        page.goto(APP + "/admin/paiements")
        expect(page.get_by_text("e-Wari (bac à sable)")).to_be_visible()
        page.goto(APP + "/admin/audit")
        expect(page.get_by_text("payment.mismatch").first).to_be_visible()
        expect(page.get_by_text("webhook.ewari.bad_signature").first).to_be_visible()
    step("Back-office : mode bac à sable, anomalies tracées dans l'audit", t_admin)
    b.close()

print(f"\n{sum(results)}/{len(results)} tests e-Wari réussis")
sys.exit(0 if all(results) else 1)
