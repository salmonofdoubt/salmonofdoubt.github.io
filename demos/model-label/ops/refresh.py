#!/usr/bin/env python3
"""One-shot public-source refresh for later scheduled execution."""
import argparse
import time
from collector import Monitor

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--service", help="Only refresh a registered service ID")
parser.add_argument("--status-only", action="store_true", help="Refresh only official status APIs")
args = parser.parse_args()
monitor = Monitor(0)
monitor.start_refresh(args.service, status_only=args.status_only)
while monitor.job["running"]:
    time.sleep(0.2)
if monitor.job["last_error"]:
    raise SystemExit(monitor.job["last_error"])
for key, source in monitor.state["sources"].items():
    print(f"{key}: {source['status']} · {source.get('last_attempt', '')}")
