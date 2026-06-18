---
layout: page
title: Dokumenty
---

Ke stažení zde jsou dostupné:

### Stanovy spolku
  - [webová verze]({{ "/stanovy" | relative_url }})
  - [verze ve formátu PDF]({{ "/files/CNA_stanovy_v3.pdf" | relative_url }} )

## Výroční zprávy

<table class="table table-striped">
    <thead>
        <tr>
        <th>Datum schůze</th>
        <th>Soubor</th>
        </tr>
    </thead>
    <tbody>
        {%- assign visible_docs = site.data.zpravy | where: "visible", "true" | sort: "datum" -%}
        {% for f in visible_docs %}
        <tr>
        <td>{{ f.datum }}</td>
        <td><a href="{{ site.baseurl }}/docs/{{ f.soubor }}"><i class="fas fa-file-pdf"></i> {{ f.soubor }}</a></td>
        </tr>
        {% else %}
        <tr>
            <td colspan="2">Žádné výroční zprávy nejsou zatím k dispozici.</td>
        </tr>
        {% endfor %}
    </tbody>
</table>

## Zápisy ze zasedání Komise

Zápisy ze zasedání komise jsou k dispozici pouze členům asociace v [členské sekci](https://members.neutrons.cz/).
