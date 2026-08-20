"""Vérification de bout en bout de l'app, sur un viewport d'iPhone.

Rejoue à la main ce qu'une utilisatrice fait : ajouter un disque, le chercher, le trier,
le modifier, le supprimer, recharger. Complète les tests unitaires, qui ne couvrent que
`src/lib/` et `src/db/` — le spec exclut volontairement les tests d'interface unitaires.

Prérequis (hors package.json, ce sont des outils de développement) :
    pip install playwright && python -m playwright install chromium

Contre le serveur de dev :
    npm run dev
    python scripts/verifier-app.py

Contre la production :
    BASE_URL=https://catalogue-disques.vercel.app python scripts/verifier-app.py

Piège à connaître : ne PAS attendre `networkidle` après une navigation côté client —
aucune requête réseau n'est émise, l'attente se résout donc avant que React ait rendu.
Ne pas attendre non plus un texte qui existe sur les deux écrans (un titre d'album est
sur la fiche ET dans la liste) : l'attente se résoudrait sur la page qu'on quitte.
"""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://localhost:5173")

SORTIE = str(Path(__file__).resolve().parent.parent / "captures")
Path(SORTIE).mkdir(exist_ok=True)
resultats = []


def verifier(numero, description, condition, detail=""):
    resultats.append((numero, description, bool(condition), detail))
    print(f"{'OK   ' if condition else 'ECHEC'} {numero}. {description} {detail}")


def remplir(page, etiquette, valeur):
    page.locator(f"label:has-text('{etiquette}') input").first.fill(valeur)


def creer_disque(page, champs):
    """Passe par le bouton +, remplit le formulaire, enregistre. `champs` = [(libellé, valeur)]."""
    page.click("a[aria-label='Ajouter un disque']")
    page.wait_for_selector("h1:has-text('Ajouter un disque')")
    page.click("text=Saisir à la main")
    page.wait_for_selector("h1:has-text('Nouveau disque')")
    for etiquette, valeur in champs:
        remplir(page, etiquette, valeur)
    page.click("button[type=submit]")
    page.wait_for_selector("text=Inventaire n°")


with sync_playwright() as p:
    navigateur = p.chromium.launch(headless=True)
    page = navigateur.new_page(viewport={"width": 393, "height": 852})  # iPhone 14 Pro
    erreurs_console = []
    page.on("console", lambda m: erreurs_console.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: erreurs_console.append(str(e)))

    page.goto(BASE + "/")
    page.wait_for_selector("h1:has-text('Ma collection')")

    # 1. Liste vide
    verifier(1, "La liste vide affiche le message d'accueil",
             page.locator("text=Touchez + pour ajouter le premier").is_visible())
    page.screenshot(path=f"{SORTIE}/01-liste-vide.png")

    # 2. Le bouton + ouvre le formulaire
    page.click("a[aria-label='Ajouter un disque']")
    page.wait_for_selector("h1:has-text('Ajouter un disque')")
    choix_ok = page.url.endswith("/ajouter-choix")
    page.click("text=Saisir à la main")
    page.wait_for_selector("h1:has-text('Nouveau disque')")
    verifier(2, "Le + ouvre le choix d'ajout, puis la saisie manuelle",
             choix_ok and page.url.endswith("/ajouter"))
    page.screenshot(path=f"{SORTIE}/02-formulaire.png", full_page=True)

    # 3. Enregistrer redirige vers la fiche
    remplir(page, "Artiste", "Félix Leclerc")
    remplir(page, "Album", "Le tour de l'île")
    remplir(page, "Label", "Philips")
    remplir(page, "N° de catalogue", "6332 108")
    remplir(page, "Pays", "Canada")
    remplir(page, "Année", "1975")
    remplir(page, "Valeur estimée (CAD)", "42.50")
    page.click("button[type=submit]")
    page.wait_for_selector("text=Inventaire n°")
    verifier(3, "Enregistrer redirige vers la fiche du disque",
             "/disque/1" in page.url, f"(url={page.url})")
    page.screenshot(path=f"{SORTIE}/03-fiche.png", full_page=True)

    # 4. Le disque apparaît dans la liste avec son numéro d'inventaire
    page.click("text=Retour à la collection")
    page.wait_for_selector("li")
    # Selection par structure et non par classe Tailwind : « span.w-10 » avait casse
    # cette verification le jour ou la largeur de la colonne a change, sans que
    # rien ne soit reellement en panne.
    numeros = page.locator("li a > span:first-child").all_inner_texts()
    verifier(4, "Le disque apparaît dans la liste avec son n° d'inventaire",
             numeros == ["#1"], f"(numéros affichés : {numeros})")

    # 4.2. Pochette : sans jeton Discogs il n'y a pas d'image, mais la place doit
    # etre tenue quand meme, sinon la liste sursaute pendant le defilement.
    vignette = page.locator("li a > :nth-child(2)").first
    boite = vignette.bounding_box()
    carree = boite is not None and boite["width"] == boite["height"] > 0
    verifier("4.2", "La pochette absente garde la place d'une pochette presente",
             carree, f"(boite : {boite and (round(boite['width']), round(boite['height']))})")

    # 5. La valeur totale
    total = page.locator("p.text-amber-500")
    expect(total).to_have_text("42,50 $", use_inner_text=True)
    verifier(5, "La valeur totale affiche le montant en CAD",
             True, f"(affiché : {total.inner_text()!r})")

    # 5.1 Multiplication par la quantité + jeu de données où tri artiste != tri valeur
    creer_disque(page, [("Artiste", "Harmonium"), ("Album", "L'heptade"),
                        ("Quantité", "2"), ("Valeur estimée (CAD)", "10")])
    page.click("text=Retour à la collection")
    page.wait_for_selector("li:nth-child(2)")
    # Zappa : dernier alphabétiquement, mais valeur la plus haute -> les 2 tris divergent
    creer_disque(page, [("Artiste", "Frank Zappa"), ("Album", "Hot Rats"),
                        ("Valeur estimée (CAD)", "120")])
    page.click("text=Retour à la collection")
    page.wait_for_selector("li:nth-child(3)")
    expect(page.locator("p.text-amber-500")).to_have_text("182,50 $", use_inner_text=True)
    verifier(5.1, "La valeur totale multiplie par la quantité (42,50 + 10x2 + 120 = 182,50)",
             True, f"(affiché : {page.locator('p.text-amber-500').inner_text()!r})")
    page.screenshot(path=f"{SORTIE}/04-liste-remplie.png", full_page=True)

    # 6. Recherche sans accents
    page.fill("input[type=search]", "felix")
    page.wait_for_selector("text=Le tour de l'île")
    verifier(6, "Taper « felix » trouve « Félix »",
             page.locator("li").count() == 1)
    page.screenshot(path=f"{SORTIE}/05-recherche-sans-accent.png")
    page.fill("input[type=search]", "")
    page.wait_for_selector("text=Hot Rats")

    # 7. Le tri réordonne
    def ordre_affiche():
        return page.locator("li span.truncate.font-medium").all_inner_texts()

    page.select_option("select", "artiste")
    page.wait_for_timeout(150)
    par_artiste = ordre_affiche()
    page.select_option("select", "valeur")
    page.wait_for_timeout(150)
    par_valeur = ordre_affiche()
    verifier(7, "Changer le tri réordonne la liste",
             par_artiste != par_valeur, f"\n        artiste={par_artiste}\n        valeur ={par_valeur}")

    # 8. Modifier conserve les champs non touchés
    page.click("text=Le tour de l'île")
    page.wait_for_selector("text=Inventaire n°")
    page.click("text=Modifier")
    page.wait_for_selector("h1:has-text('Modifier le disque')")
    page.locator("label:has-text('Notes') textarea").fill("Pochette légèrement cornée")
    page.click("button[type=submit]")
    page.wait_for_selector("text=Inventaire n°")
    contenu = page.content()
    attendus = ["6332 108", "Philips", "Canada", "1975", "42,50", "Pochette légèrement cornée"]
    manquants = [x for x in attendus if x not in contenu]
    verifier(8, "Modifier conserve les champs non touchés",
             not manquants, f"(manquants : {manquants})" if manquants else "")
    page.screenshot(path=f"{SORTIE}/06-fiche-modifiee.png", full_page=True)

    # 9. Supprimer demande confirmation et ramène à la liste
    dialogues = []
    page.on("dialog", lambda d: (dialogues.append(d.message), d.accept()))
    page.click("text=Supprimer")
    page.wait_for_selector("h1:has-text('Ma collection')")
    verifier(9, "Supprimer demande confirmation puis retire le disque",
             len(dialogues) == 1 and page.locator("text=Le tour de l'île").count() == 0,
             f"(confirmation : {dialogues[0][:45]!r}…)" if dialogues else "(aucune confirmation)")

    # 10. Recharger conserve les données
    page.reload()
    page.wait_for_selector("h1:has-text('Ma collection')")
    page.wait_for_selector("text=L'heptade")
    verifier(10, "Recharger la page conserve les disques (IndexedDB)",
             page.locator("li").count() == 2)

    # 12-13. Parcours Discogs complet. Appelle la vraie API : plus lent, dependant du reseau.
    page.goto(BASE + "/")
    page.wait_for_selector("h1:has-text('Ma collection')")
    page.click("a[aria-label='Ajouter un disque']")
    page.wait_for_selector("h1:has-text('Ajouter un disque')")
    page.click("text=Chercher sur Discogs")
    page.wait_for_selector("h1:has-text('Chercher un disque')")
    page.fill("input[type=search]", "Harmonium Heptade")
    page.click("button[type=submit]")
    page.wait_for_selector("li button", timeout=25000)

    catalogues = page.locator("li button span.font-mono").all_inner_texts()
    verifier(12, "La recherche Discogs retourne plusieurs pressages distincts",
             len(catalogues) >= 2 and len(set(catalogues)) >= 2,
             f"(n° de catalogue : {catalogues[:4]})")
    page.screenshot(path=f"{SORTIE}/08-pressages.png", full_page=True)

    page.locator("li button").first.click()
    page.wait_for_selector("h1:has-text('Nouveau disque')", timeout=25000)
    page.wait_for_selector("text=Rempli depuis Discogs")

    rempli = {e: page.locator(f"label:has-text('{e}') input").first.input_value()
              for e in ["Artiste", "Album", "N° de catalogue", "Pays", "Année"]}
    verifier(13, "Le formulaire est prerempli depuis Discogs",
             all(v.strip() != "" for v in rempli.values()), f"({rempli})")
    page.screenshot(path=f"{SORTIE}/09-preremplissage.png", full_page=True)

    # 14-15. Rafraichissement en lot.
    # Le formulaire prerempli de l'etape 13 est encore ouvert et NON enregistre :
    # il faut le sauver, sinon aucun disque issu de Discogs n'existe et le lot serait vide.
    page.click("button[type=submit]")
    page.wait_for_selector("text=Inventaire n°")

    page.goto(BASE + "/reglages")
    page.wait_for_selector("h1:has-text('Réglages')")
    page.click("text=Rafraîchir toutes les valeurs")
    page.wait_for_selector("text=consulté", timeout=90000)
    bilan = page.locator("p.bg-stone-800").last.inner_text()
    verifier(14, "Le rafraichissement en lot rapporte un bilan",
             "consulté" in bilan, f"({bilan!r})")
    page.screenshot(path=f"{SORTIE}/10-rafraichissement.png", full_page=True)

    # Les disques saisis a la main gardent leur valeur : seul le disque Discogs est compte.
    verifier(15, "Le lot epargne les valeurs saisies a la main",
             bilan.startswith("1 disque sur 1"), f"({bilan!r})")

    # 16-17. Aller-retour sauvegarde -> restauration.
    # On ne supprime PAS la base IndexedDB : Dexie y tient une connexion ouverte et
    # deleteDatabase resterait bloque. On efface un disque par l'interface, ce qui est
    # de toute facon le scenario reel qu'on veut couvrir.
    page.goto(BASE + "/")
    page.wait_for_selector("li")
    avant = sorted(page.locator("li span.truncate.font-medium").all_inner_texts())

    page.goto(BASE + "/sauvegarde")
    page.wait_for_selector("h1:has-text('Sauvegarde')")
    with page.expect_download() as telechargement:
        page.click("text=Sauvegarder maintenant")
    chemin = telechargement.value.path()
    contenu = Path(chemin).read_text(encoding="utf-8")
    verifier(16, "La sauvegarde produit un fichier relisible",
             '"version": 1' in contenu and '"disques"' in contenu,
             f"({len(contenu)} octets, {len(avant)} disques)")

    page.goto(BASE + "/")
    page.wait_for_selector("li")
    page.locator("li a").first.click()
    page.wait_for_selector("text=Inventaire n°")
    page.click("text=Supprimer")
    page.wait_for_selector("h1:has-text('Ma collection')")
    ampute = sorted(page.locator("li span.truncate.font-medium").all_inner_texts())

    page.goto(BASE + "/sauvegarde")
    page.wait_for_selector("h1:has-text('Sauvegarde')")
    page.set_input_files("input[type=file]", chemin)
    page.wait_for_selector("text=restauré", timeout=20000)

    page.goto(BASE + "/")
    page.wait_for_selector("li")
    apres = sorted(page.locator("li span.truncate.font-medium").all_inner_texts())
    verifier(17, "La restauration redonne exactement la collection sauvegardee",
             apres == avant and len(ampute) == len(avant) - 1,
             f"(avant={len(avant)} ampute={len(ampute)} apres={len(apres)})")

    # 18-19. Ecran de scan. Playwright n'a pas de vraie camera : on verifie ce qui est
    # verifiable automatiquement, dont l'absence de requete vers un CDN tiers.
    requetes_cdn = []
    page.on("request", lambda r: requetes_cdn.append(r.url)
            if "jsdelivr" in r.url or "unpkg" in r.url else None)
    page.goto(BASE + "/scanner")
    page.wait_for_selector("h1:has-text('Scanner un code-barres')")
    page.wait_for_timeout(3000)
    corps = page.content()
    verifier(18, "L'ecran de scan se charge et propose un repli sans camera",
             "cherchez-le par son titre" in corps or "Chercher par titre" in corps)
    verifier(19, "Le binaire du scanner ne vient d'aucun CDN tiers",
             len(requetes_cdn) == 0, f"({requetes_cdn})" if requetes_cdn else "")
    page.screenshot(path=f"{SORTIE}/11-scan.png", full_page=True)

    verifier(11, "Aucune erreur JavaScript dans la console",
             len(erreurs_console) == 0, f"({erreurs_console})" if erreurs_console else "")

    navigateur.close()

echecs = [r for r in resultats if not r[2]]
print(f"\n=== {len(resultats) - len(echecs)}/{len(resultats)} verifications reussies ===")
for numero, description, _, detail in echecs:
    print(f"  ECHEC {numero}. {description} {detail}")
raise SystemExit(1 if echecs else 0)
