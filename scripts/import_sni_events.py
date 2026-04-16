#!/usr/bin/env python3
"""
Import events from the SNI portal into `_data/import.yml`.

Dependencies:
    pip install requests beautifulsoup4 certifi

Usage:
    python scripts/import_sni_events.py
    python scripts/import_sni_events.py --output _data/import.yml
"""

from __future__ import annotations

import argparse
import calendar
import re
import sys
import warnings
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin

warnings.filterwarnings(
    "ignore",
    message="The soupsieve package is not installed.*",
    category=UserWarning,
    module="bs4.css",
)

try:
    import certifi
    import requests
    from bs4 import BeautifulSoup, NavigableString, Tag
except ImportError as exc:  # pragma: no cover - dependency guard
    missing = getattr(exc, "name", "dependency")
    raise SystemExit(
        f"Missing dependency: {missing}. Install with "
        "`pip install requests beautifulsoup4 certifi`."
    ) from exc


SOURCE_URL = (
    "https://www.sni-portal.de/en/user-committees/"
    "committee-research-with-neutrons/news/events"
)
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "_data" / "import.yml"
WHITESPACE_RE = re.compile(r"\s+")
YEAR_RE = re.compile(r"^\d{4}$")
SINGLE_DAY_RE = re.compile(r"^(?P<day>\d{1,2})\s+(?P<month>[A-Za-z]+)\s+(?P<year>\d{4})$")
SAME_MONTH_RANGE_RE = re.compile(
    r"^(?P<start_day>\d{1,2})-(?P<end_day>\d{1,2})\s+(?P<month>[A-Za-z]+)\s+(?P<year>\d{4})$"
)
CROSS_MONTH_RANGE_RE = re.compile(
    r"^(?P<start_day>\d{1,2})\s+(?P<start_month>[A-Za-z]+)-"
    r"(?P<end_day>\d{1,2})\s+(?P<end_month>[A-Za-z]+)\s+(?P<year>\d{4})$"
)
MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


@dataclass(frozen=True)
class ImportedEvent:
    start_date: date
    end_date: date | None
    title: str
    url: str
    location: str


def normalize_whitespace(value: str) -> str:
    return WHITESPACE_RE.sub(" ", value).strip()


def yaml_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def add_month(year: int, month: int, offset: int) -> tuple[int, int]:
    raw_month = month + offset
    year += (raw_month - 1) // 12
    month = (raw_month - 1) % 12 + 1
    return year, month


def build_date(year: int, month: int, day: int, source_text: str) -> date:
    try:
        return date(year, month, day)
    except ValueError as exc:
        raise ValueError(f"Unsupported date '{source_text}' -> {year:04d}-{month:02d}-{day:02d}") from exc


def parse_date_range(date_text: str) -> tuple[date, date | None]:
    date_text = normalize_whitespace(date_text)

    match = SINGLE_DAY_RE.match(date_text)
    if match:
        year = int(match.group("year"))
        month = MONTHS[match.group("month").lower()]
        day = int(match.group("day"))
        return build_date(year, month, day, date_text), None

    match = SAME_MONTH_RANGE_RE.match(date_text)
    if match:
        year = int(match.group("year"))
        month = MONTHS[match.group("month").lower()]
        start_day = int(match.group("start_day"))
        end_day = int(match.group("end_day"))
        month_days = days_in_month(year, month)

        if start_day > month_days:
            prev_year, prev_month = add_month(year, month, -1)
            start = build_date(prev_year, prev_month, start_day, date_text)
            end = build_date(year, month, end_day, date_text)
            return start, end

        if end_day < start_day:
            end_year, end_month = add_month(year, month, 1)
            start = build_date(year, month, start_day, date_text)
            end = build_date(end_year, end_month, end_day, date_text)
            return start, end

        start = build_date(year, month, start_day, date_text)
        end = build_date(year, month, end_day, date_text)
        return start, end

    match = CROSS_MONTH_RANGE_RE.match(date_text)
    if match:
        end_year = int(match.group("year"))
        start_day = int(match.group("start_day"))
        end_day = int(match.group("end_day"))
        start_month = MONTHS[match.group("start_month").lower()]
        end_month = MONTHS[match.group("end_month").lower()]

        if start_month == end_month and end_day < start_day:
            end_year, end_month = add_month(end_year, end_month, 1)
            start_year = int(match.group("year"))
        else:
            start_year = end_year if start_month <= end_month else end_year - 1

        start = build_date(start_year, start_month, start_day, date_text)
        end = build_date(end_year, end_month, end_day, date_text)
        return start, end

    raise ValueError(f"Unsupported date format: {date_text}")


def fetch_html(url: str) -> str:
    try:
        response = requests.get(url, timeout=30, verify=certifi.where())
    except requests.exceptions.SSLError:
        print(
            "Warning: SSL verification failed, retrying without certificate verification.",
            file=sys.stderr,
        )
        response = requests.get(url, timeout=30, verify=False)

    response.raise_for_status()
    return response.text


def iter_event_blocks(soup: BeautifulSoup) -> Iterable[tuple[str, Tag]]:
    for heading in soup.find_all("h2"):
        year_label = normalize_whitespace(heading.get_text(" ", strip=True))
        if not YEAR_RE.match(year_label):
            continue

        paragraph = heading.find_next_sibling("p")
        if paragraph is not None:
            yield year_label, paragraph


def extract_events(html: str, source_url: str) -> list[ImportedEvent]:
    soup = BeautifulSoup(html, "html.parser")
    imported_events: list[ImportedEvent] = []

    for _year_label, paragraph in iter_event_blocks(soup):
        current_title = None
        current_url = None
        location_parts: list[str] = []
        current_date_text = None

        def flush_current() -> None:
            nonlocal current_title, current_url, location_parts, current_date_text
            if not current_title:
                return

            if not current_date_text:
                raise ValueError(f"Missing date for event '{current_title}'")

            start_date, end_date = parse_date_range(current_date_text)
            location = normalize_whitespace("".join(location_parts)).strip(" ,")

            imported_events.append(
                ImportedEvent(
                    start_date=start_date,
                    end_date=end_date,
                    title=current_title,
                    url=urljoin(source_url, current_url or ""),
                    location=location,
                )
            )

            current_title = None
            current_url = None
            location_parts = []
            current_date_text = None

        for child in paragraph.children:
            if isinstance(child, Tag) and child.name == "a":
                flush_current()
                current_title = normalize_whitespace(child.get_text(" ", strip=True))
                current_url = child.get("href", "").strip()
                location_parts = []
                current_date_text = None
                continue

            if current_title is None:
                continue

            if isinstance(child, Tag):
                if child.name == "b":
                    current_date_text = normalize_whitespace(child.get_text(" ", strip=True))
                continue

            if isinstance(child, NavigableString) and current_date_text is None:
                text_value = str(child)
                if text_value.strip():
                    location_parts.append(text_value)

        flush_current()

    return sorted(
        imported_events,
        key=lambda event: (
            event.start_date.isoformat(),
            (event.end_date or event.start_date).isoformat(),
            event.title.lower(),
        ),
    )


def render_yaml(events: list[ImportedEvent]) -> str:
    lines: list[str] = []

    for event in events:
        lines.append(f"- date: {yaml_quote(event.start_date.isoformat())}")
        if event.end_date and event.end_date != event.start_date:
            lines.append(f"  end_date: {yaml_quote(event.end_date.isoformat())}")
        lines.append(f"  title: {yaml_quote(event.title)}")
        lines.append(f"  url: {yaml_quote(event.url)}")
        lines.append(f"  location: {yaml_quote(event.location)}")
        lines.append("  type: imported")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Import SNI events into _data/import.yml."
    )
    parser.add_argument("--url", default=SOURCE_URL, help="Source page to import.")
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Output YAML file. Defaults to _data/import.yml.",
    )
    args = parser.parse_args()

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    html = fetch_html(args.url)
    events = extract_events(html, args.url)
    output_path.write_text(render_yaml(events), encoding="utf-8")

    print(f"Imported {len(events)} events into {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
