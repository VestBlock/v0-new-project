#!/usr/bin/env python3
"""Fetch current on-market listings with HomeHarvest and emit JSON."""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from decimal import Decimal

import pandas as pd
from homeharvest import scrape_property


def clean(value):
    if isinstance(value, (list, tuple)):
        return [clean(item) for item in value]
    if isinstance(value, dict):
        return {str(key): clean(item) for key, item in value.items()}
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    return value


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch HomeHarvest for-sale listings.")
    parser.add_argument("--market", required=True)
    parser.add_argument("--limit", type=int, default=150)
    parser.add_argument("--price-max", type=int, default=0)
    parser.add_argument("--price-min", type=int, default=0)
    parser.add_argument("--exclude-pending", action="store_true")
    args = parser.parse_args()

    kwargs = {
        "location": args.market,
        "listing_type": "for_sale",
        "limit": args.limit,
        "extra_property_data": True,
        "exclude_pending": args.exclude_pending,
    }
    if args.price_max > 0:
        kwargs["price_max"] = args.price_max
    if args.price_min > 0:
        kwargs["price_min"] = args.price_min

    frame = scrape_property(**kwargs)
    records = []
    if frame is not None and not frame.empty:
        for record in frame.to_dict(orient="records"):
            records.append({str(key): clean(value) for key, value in record.items()})
    print(json.dumps(records, ensure_ascii=True))


if __name__ == "__main__":
    main()
