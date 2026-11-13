"""Génère les rapports PDF FACTICES de démonstration (supabase/demo/rapports/).

Usage : python3 scripts/generer_rapports_demo.py   (nécessite reportlab)
Ces PDF ne contiennent que des données inventées.
"""
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

BLEU_NUIT = HexColor("#0B1E2D")
JAUNE = HexColor("#FFC629")
FOND = HexColor("#F6F5F1")
TEXTE = HexColor("#2A3A47")

RAPPORTS = [
    {
        "fichier": "rapport-demo-garrigues.pdf",
        "titre": "Rapport de nettoyage",
        "site": "Centrale Démo Les Garrigues (au sol)",
        "client": "Exploitant Démo A",
        "lignes": [
            ("Surface nettoyée", "52 763 m²"),
            ("Encrassement constaté", "6 / 10"),
            ("Panneaux cassés", "3 – rangée 12, table 4 (côté est)"),
            ("Bon de commande", "BC-DEMO-2026-031"),
        ],
    },
    {
        "fichier": "rapport-demo-mistral.pdf",
        "titre": "Rapport de nettoyage",
        "site": "Centrale Démo Le Mistral (trackers)",
        "client": "Exploitant Démo A",
        "lignes": [
            ("Surface nettoyée", "38 420 m²"),
            ("Encrassement constaté", "5 / 10"),
            ("Panneaux cassés", "aucun"),
            ("Bon de commande", "BC-DEMO-2026-028"),
        ],
    },
    {
        "fichier": "rapport-demo-atelier-b.pdf",
        "titre": "Rapport de nettoyage",
        "site": "Toiture Démo Atelier B (toiture)",
        "client": "Exploitant Démo B",
        "lignes": [
            ("Surface nettoyée", "6 100 m²"),
            ("Encrassement constaté", "5 / 10"),
            ("Panneaux cassés", "aucun"),
            ("Bon de commande", "BC-DEMO-B-007"),
        ],
    },
]


def generer(dossier: Path, r: dict) -> None:
    largeur, hauteur = A4
    c = canvas.Canvas(str(dossier / r["fichier"]), pagesize=A4)
    c.setTitle(f"{r['titre']} – {r['site']} (DÉMONSTRATION)")
    c.setAuthor("ACG NET SPE – document factice")

    c.setFillColor(FOND)
    c.rect(0, 0, largeur, hauteur, stroke=0, fill=1)
    c.setFillColor(BLEU_NUIT)
    c.rect(0, hauteur - 90, largeur, 90, stroke=0, fill=1)
    c.setFillColor(JAUNE)
    c.rect(40, hauteur - 58, 18, 18, stroke=0, fill=1)
    c.setFillColor(HexColor("#FFFFFF"))
    c.setFont("Helvetica-Bold", 18)
    c.drawString(68, hauteur - 56, "ACG NET SPE")

    y = hauteur - 140
    c.setFillColor(TEXTE)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(40, y, r["titre"])
    c.setFont("Helvetica", 12)
    c.drawString(40, y - 24, r["site"])
    c.drawString(40, y - 42, f"Client : {r['client']}")

    y -= 90
    for libelle, valeur in r["lignes"]:
        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, y, libelle)
        c.setFont("Helvetica", 11)
        c.drawString(220, y, valeur)
        y -= 22

    c.setFillColor(JAUNE)
    c.rect(40, 120, largeur - 80, 50, stroke=0, fill=1)
    c.setFillColor(BLEU_NUIT)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(largeur / 2, 150, "DOCUMENT FACTICE – DÉMONSTRATION")
    c.setFont("Helvetica", 10)
    c.drawCentredString(largeur / 2, 134, "Toutes les données de ce rapport sont inventées.")
    c.showPage()
    c.save()


if __name__ == "__main__":
    dossier = Path(__file__).resolve().parent.parent / "supabase" / "demo" / "rapports"
    dossier.mkdir(parents=True, exist_ok=True)
    for rapport in RAPPORTS:
        generer(dossier, rapport)
        print("Créé :", dossier / rapport["fichier"])
