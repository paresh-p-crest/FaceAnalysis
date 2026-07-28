"""German twin f-string builders for cvReport explanation fields (Layer A).

Emit explanationDe at CV build time with the same interpolated values as EN.
No LLM. No structured-field backfill.
"""

from __future__ import annotations

from typing import Optional

# Band / classification words that appear inside explanation prose.
LABEL_EN_TO_DE: dict[str, str] = {
    "balanced": "ausgewogen",
    "quite symmetric": "ziemlich symmetrisch",
    "highly symmetric": "sehr symmetrisch",
    "noticeable asymmetry": "spürbare Asymmetrie",
    "well balanced": "gut ausgewogen",
    "good balance": "gute Balance",
    "slight variation": "leichte Abweichung",
    "moderate": "mäßig",
    "soft": "weich",
    "strong": "stark",
    "hyper feminine": "hyperfeminin",
    "hyper masculine": "hypermaskulin",
    "feminine": "feminin",
    "masculine": "maskulin",
    "oval": "oval",
    "round": "rund",
    "square": "quadratisch",
    "heart": "herzförmig",
    "oblong": "länglich",
    "long": "lang",
    "short": "kurz",
    "average": "durchschnittlich",
    "wide": "breit",
    "narrow": "schmal",
    "normal": "normal",
    "full": "voll",
    "thin": "dünn",
    "high": "hoch",
    "low": "niedrig",
    "medium": "mittel",
    "defined": "definiert",
    "angular": "kantig",
    "smooth": "glatt",
    "prominent": "prominent",
    "flat": "flach",
    "harmonious": "harmonisch",
    "well-proportioned": "gut proportioniert",
    "distinctive": "charakteristisch",
    "eyes": "Augen",
    "brows": "Brauen",
    "mouth": "Mund",
    "jaw": "Kiefer",
    "eyebrows": "Augenbrauen",
    "nose": "Nase",
    "cheeks": "Wangen",
    "lips": "Lippen",
    "chin": "Kinn",
    "neck": "Hals",
    "ears": "Ohren",
    "upper": "oberen",
    "middle": "mittleren",
    "lower": "unteren",
}


def label_de(en: Optional[str]) -> str:
    if not en:
        return ""
    key = str(en).strip().lower()
    return LABEL_EN_TO_DE.get(key, key)


def improve_note_de(feature_name: str, opposite: bool, preference: str) -> str:
    if not opposite:
        return ""
    if feature_name.lower() == "overall dimorphism":
        name = "gesamten Dimorphismus"
    else:
        name = label_de(feature_name)
    if preference == "feminine":
        return (
            f" Spielraum für eine weichere, femininere "
            f"{name}-Darstellung."
        )
    return (
        f" Spielraum für eine stärkere, maskulinere "
        f"{name}-Darstellung."
    )


def symmetry_explanation_de(score: int, label: str, regions: Optional[list] = None) -> str:
    regions = regions or []
    region_clause = ""
    if regions:
        sorted_regions = sorted(regions, key=lambda r: r.get("score", 0))
        weakest = sorted_regions[0]
        strongest = sorted_regions[-1]
        if weakest.get("score", 100) < 74:
            region_clause = (
                f" Der größte gemessene Links-Rechts-Unterschied liegt bei den "
                f"{label_de(weakest.get('label'))} ({weakest['score']}), "
                f"während {label_de(strongest.get('label'))} gleichmäßiger sind "
                f"({strongest['score']})."
            )
        else:
            names = ", ".join(label_de(r.get("label")) for r in regions)
            region_clause = (
                f" Die regionale Balance ist über {names} relativ gleichmäßig "
                f"(niedrigster Wert: {label_de(weakest.get('label'))} bei {weakest['score']})."
            )
    return (
        f"Dein Gesichtssymmetrie-Score liegt bei {score} ({label_de(label)})."
        f"{region_clause} "
        "Natürliche Gesichter zeigen fast immer eine gewisse Links-Rechts-Variation."
    )


def face_shape_explanation_de(
    shape: str,
    length: str,
    forehead: str,
    midface: str,
    lower_third: str,
    ratio: float,
) -> str:
    return (
        f"Dein Gesicht wird als {label_de(shape)} klassifiziert, basierend auf einer "
        f"8-Punkte-Gesichtskontur (Gesichtslänge {label_de(length)}, Stirn {label_de(forehead)}, "
        f"Mittelgesicht {label_de(midface)} relativ zur Brauen-/Kieferbreite, "
        f"und unteres Drittel {label_de(lower_third)}; Längen-zu-Mittelgesichts-Verhältnis {ratio:.2f}). "
        f"Kontur und Ellipse zeigen, wie Schläfen, Wangenknochen und Kiefer diese Form rahmen."
    )


def proportions_thirds_explanation_de(upper: float, middle: float, lower: float) -> str:
    if upper < 0.28 and lower > 0.36:
        return (
            f"Deine kürzere Stirn mit einem höheren Mittelgesicht und besonders langem Mund-Kinn-Bereich "
            f"(oben {upper:.2f}, Mitte {middle:.2f}, unten {lower:.2f}) verlagert das visuelle Gewicht nach unten "
            "und gibt deinen Merkmalen einen starken zentralen und unteren Fokus im Vergleich zu "
            "Standardreferenzen für Gesichter wie deines."
        )
    if upper > 0.36 and lower < 0.30:
        return (
            f"Deine höhere Stirn mit einem kürzeren unteren Drittel "
            f"(oben {upper:.2f}, Mitte {middle:.2f}, unten {lower:.2f}) verlagert das visuelle Gewicht nach oben, "
            "sodass das obere Gesicht mehr Präsenz trägt als typische Referenzproportionen."
        )
    if abs(upper - middle) < 0.04 and abs(middle - lower) < 0.04:
        return (
            f"Deine Gesichtsdrittel sind eng ausbalanciert "
            f"(oben {upper:.2f}, Mitte {middle:.2f}, unten {lower:.2f}), "
            "sodass das visuelle Gewicht gleichmäßig von der Stirn bis zum Kinn verteilt ist."
        )
    focus_en = "upper" if upper >= middle and upper >= lower else ("middle" if middle >= lower else "lower")
    return (
        f"Deine Gesichtsdrittel messen oben {upper:.2f}, Mitte {middle:.2f} und unten {lower:.2f}, "
        f"sodass das visuelle Gewicht zum {label_de(focus_en)} Drittel neigt im Vergleich zu "
        "gleichmäßig geteilten Referenzen."
    )


PROPORTIONS_THIRDS_UNAVAILABLE_DE = (
    "Gesichtsdrittel konnten aus den Landmarken nicht gemessen werden."
)
FACE_SHAPE_UNAVAILABLE_DE = "Gesichtsform konnte aus den Landmarken nicht gemessen werden."
NASO_AURAL_PROFILE_DE = (
    "Lade ein Seitenprofilfoto für eine genaue naso-aurale Messung hoch. "
    "Schätzungen aus der Frontalansicht sind für dieses Verhältnis klinisch nicht aussagekräftig."
)
HAIR_UPLOAD_DE = (
    "Lade ein Foto vom Scheitel für eine echte Haardichte- und Bedeckungsanalyse hoch."
)
HAIR_FAILED_DE = "Haaranalyse vom Scheitel ist fehlgeschlagen."
SMILE_UPLOAD_DE = "Lade ein Lächelfoto für eine erweiterte Zahn- und Lächelanalyse hoch."
SMILE_FAILED_DE = "Lächelfoto-Analyse ist fehlgeschlagen."


def orbito_nasal_explanation_de(value: float) -> str:
    clause = (
        "Die Nasenbasis ist breiter als der innere Augenabstand, sodass die zentrale Säule breiter wirkt."
        if value > 1.1
        else "Die Nasenbasis ist schmaler als der innere Augenabstand, sodass die zentrale Säule feiner wirkt."
        if value < 0.9
        else "Die Nasenbreite stimmt eng mit dem inneren Augenabstand überein."
    )
    return f"Dein Orbito-Nasal-Verhältnis liegt bei {value:.2f} (Referenz ≈ 1,00). {clause}"


def naso_oral_explanation_de(value: float) -> str:
    clause = (
        "Die Mundbreite ist relativ zurückhaltend gegenüber der Nasenbasis, sodass der Fokus auf der Nase bleibt."
        if value < 1.3
        else "Die Mundbreite ist relativ breit gegenüber der Nasenbasis, sodass die Mundzone präsenter wirkt."
        if value > 1.8
        else "Die Mundbreite liegt nahe dem erwarteten Bereich relativ zur Nasenbasis."
    )
    return f"Dein Mund-zu-Nase-Verhältnis liegt bei {value:.2f} (Referenz ≈ 1,60). {clause}"


def orbital_explanation_de(value: float) -> str:
    spacing = (
        "gleichmäßig beabstandet."
        if 0.95 <= value <= 1.05
        else "etwas eng stehend."
        if value < 0.95
        else "etwas weit stehend."
    )
    return (
        f"Dein Verhältnis von Augenabstand zu Augenbreite liegt bei {value:.2f} (Referenz ≈ 1,00), "
        f"sodass die Augen als {spacing}"
    )


def naso_aural_explanation_de(ratio: float) -> str:
    if ratio > 1.05:
        return (
            "Deine höheren Ohren im Vergleich zur Nasenhöhe erzeugen einen großen vertikalen Rahmen "
            "neben dem Mittelgesicht, sodass die Seitenansicht vertikal gestreckter wirkt und die "
            "zentrale Gesichtssäule eine stärkere Stützkontur erhält."
        )
    if ratio < 0.95:
        return (
            "Deine kürzeren Ohren relativ zur Nasenhöhe halten den seitlichen Rahmen kompakter, "
            "sodass die Mittelgesichtssäule mehr des vertikalen Schwerpunkts von der Seite trägt."
        )
    return (
        "Deine Ohrhöhe stimmt eng mit der Nasenhöhe überein und erzeugt einen ausgewogenen "
        "vertikalen Rahmen neben dem Mittelgesicht."
    )


def nose_profile_append_de(nf, nasolabial, nasolabial_norm, hump_label: str) -> str:
    return (
        f" Profilwinkel: Nasofrontal {nf}°, Nasolabial {nasolabial}° "
        f"(typisch {nasolabial_norm}), Nasenhöcker {hump_label}."
    )


def dimorphism_overall_explanation_de(
    overall_label: str,
    overall_score: int,
    top_drivers: list[dict],
    overall_opp: bool,
    preference: str,
) -> str:
    top_clause = ", ".join(
        f"{label_de(f['name'])} ({label_de(f['label'])}, {f['score']})" for f in top_drivers
    )
    text = (
        f"Dein gesamtes Dimorphismus-Profil liest sich als {label_de(overall_label)} "
        f"({overall_score}/100). Die stärksten gemessenen Treiber sind {top_clause}."
    )
    text += improve_note_de("overall dimorphism", overall_opp, preference)
    return text


def dimorphism_feature_explanation_de(
    name: str,
    score: int,
    label: str,
    detail: str,
    opposite: bool,
    preference: str,
) -> str:
    verb = "liegen bei" if name in ("Eyebrows", "Eyes", "Cheeks", "Lips", "Ears") else "liegt bei"
    text = (
        f"Deine {label_de(name)} {verb} {score} ({label_de(label)}): {detail}."
        + improve_note_de(name, opposite, preference)
    )
    return text


def averageness_explanation_de(deviations: list, score: int) -> str:
    def _phrase(d: dict) -> str:
        feature = d["feature"]
        direction = d["direction"]
        if feature == "brows":
            return "einer höheren Brauenlinie" if direction == "higher" else "einer niedrigeren Brauenlinie"
        if feature == "nose":
            return f"einer {label_de(direction)}en Nase" if direction in ("wider", "narrower", "longer", "shorter") else f"einer {direction} Nase"
        if feature == "jaw width":
            return f"einem {label_de(direction)}en Kiefer" if direction in ("wider", "narrower") else f"einem {direction} Kiefer"
        if feature == "facial thirds":
            return "verschobenen Gesichtsdritteln"
        if feature == "symmetry":
            return (
                "ausgewogener Links-Rechts-Symmetrie"
                if direction == "balanced"
                else "stärkerer Links-Rechts-Asymmetrie"
            )
        return feature

    notable = [
        _phrase(d)
        for d in deviations
        if d["magnitude"] > 0.04 and d["direction"] != "balanced"
    ][:3]

    if score >= 70:
        if not notable:
            return (
                "Deine gemessenen Proportionen liegen nah an der demografischen Norm bei Kieferbreite, Nase, "
                "Brauen, Gesichtsdritteln und Symmetrie."
            )
        return (
            "Deine Gesamtproportionen liegen eher auf der typischen Seite relativ zu deiner demografischen Norm, "
            f"mit der auffälligsten gemessenen Abweichung bei {', '.join(notable)}."
        )
    if not notable:
        return (
            "Deine Verhältnisse zeigen eine Mischung aus Übereinstimmung und Abweichung "
            "relativ zu den idealen Proportionszielen."
        )
    return (
        f"Im Vergleich zu den idealen Proportionszielen erscheint die auffälligste gemessene Abweichung "
        f"bei {', '.join(notable)}."
    )
