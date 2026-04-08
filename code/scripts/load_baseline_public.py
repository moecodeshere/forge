#!/usr/bin/env python3
from __future__ import annotations

import json
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass
class Sample:
    endpoint: str
    duration_ms: float
    ok: bool
    status_code: int


def request_once(base_url: str, endpoint: str, timeout: float = 5.0) -> Sample:
    started = time.perf_counter()
    req = Request(f"{base_url}{endpoint}", method="GET")
    try:
        with urlopen(req, timeout=timeout) as resp:
            status_code = int(resp.status)
            ok = 200 <= status_code < 300
    except HTTPError as exc:
        status_code = int(exc.code)
        ok = False
    except URLError:
        status_code = 0
        ok = False
    elapsed_ms = (time.perf_counter() - started) * 1000
    return Sample(endpoint=endpoint, duration_ms=elapsed_ms, ok=ok, status_code=status_code)


def p95(values: Iterable[float]) -> float:
    sorted_values = sorted(values)
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    return statistics.quantiles(sorted_values, n=100, method="inclusive")[94]


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: load_baseline_public.py <base_url> <output_json_path>", file=sys.stderr)
        return 2

    base_url = sys.argv[1].rstrip("/")
    out_path = Path(sys.argv[2])
    out_path.parent.mkdir(parents=True, exist_ok=True)

    endpoints = ["/healthz", "/metrics"]
    requests_per_endpoint = 240
    concurrency = 24

    samples: list[Sample] = []
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = []
        for endpoint in endpoints:
            for _ in range(requests_per_endpoint):
                futures.append(pool.submit(request_once, base_url, endpoint))
        for fut in as_completed(futures):
            samples.append(fut.result())

    total = len(samples)
    failures = [s for s in samples if not s.ok]
    overall_durations = [s.duration_ms for s in samples]

    per_endpoint: dict[str, dict[str, float | int]] = {}
    for endpoint in endpoints:
        endpoint_samples = [s for s in samples if s.endpoint == endpoint]
        endpoint_durations = [s.duration_ms for s in endpoint_samples]
        endpoint_failures = sum(1 for s in endpoint_samples if not s.ok)
        per_endpoint[endpoint] = {
            "requests": len(endpoint_samples),
            "failures": endpoint_failures,
            "failure_rate": endpoint_failures / len(endpoint_samples) if endpoint_samples else 0.0,
            "p95_ms": round(p95(endpoint_durations), 2),
            "avg_ms": round(sum(endpoint_durations) / len(endpoint_durations), 2)
            if endpoint_durations
            else 0.0,
        }

    result = {
        "base_url": base_url,
        "total_requests": total,
        "failure_count": len(failures),
        "failure_rate": len(failures) / total if total else 0.0,
        "p95_overall_ms": round(p95(overall_durations), 2),
        "avg_overall_ms": round(sum(overall_durations) / len(overall_durations), 2)
        if overall_durations
        else 0.0,
        "thresholds": {
            "failure_rate_lt": 0.01,
            "p95_overall_ms_lt": 250,
        },
        "thresholds_passed": {
            "failure_rate": (len(failures) / total if total else 1.0) < 0.01,
            "p95_overall_ms": p95(overall_durations) < 250.0,
        },
        "per_endpoint": per_endpoint,
    }

    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

