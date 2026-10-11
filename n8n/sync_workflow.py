#!/usr/bin/env python3
"""
Sync Lost & Found Geolocation Workflow to an n8n instance using the n8n Public API.

Usage:
  python n8n/sync_workflow.py --url https://<your-n8n-host>
  python n8n/sync_workflow.py --url https://<your-n8n-host> --key <your-api-key>
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
API_KEY_FILE = os.path.join(PROJECT_ROOT, "n8napikey.txt")
WORKFLOW_FILE = os.path.join(SCRIPT_DIR, "panorama_geolocation_workflow.json")


def load_api_key(cli_key: str | None) -> str:
    if cli_key:
        return cli_key.strip()
    if os.path.exists(API_KEY_FILE):
        with open(API_KEY_FILE, "r", encoding="utf-8") as f:
            key = f.read().strip()
            if key:
                return key
    sys.exit("Error: No n8n API key found. Provide --key or write the key into n8napikey.txt.")


def make_request(url: str, method: str, headers: dict, data: dict | None = None):
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        sys.exit(f"n8n API HTTP Error {e.code}: {err_msg}")
    except Exception as e:
        sys.exit(f"Network error connecting to n8n ({url}): {e}")


def main():
    parser = argparse.ArgumentParser(description="Sync geolocation workflow to n8n instance")
    parser.add_argument("--url", "-u", required=True, help="Base URL of your n8n instance (e.g. https://n8n.example.com)")
    parser.add_argument("--key", "-k", help="n8n Public API key (defaults to n8napikey.txt)")
    args = parser.parse_args()

    base_url = args.url.rstrip("/")
    api_key = load_api_key(args.key)

    if not os.path.exists(WORKFLOW_FILE):
        sys.exit(f"Error: Workflow file not found at {WORKFLOW_FILE}")

    with open(WORKFLOW_FILE, "r", encoding="utf-8") as f:
        workflow_data = json.load(f)

    headers = {
        "X-N8N-API-KEY": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    print(f"Connecting to n8n instance at {base_url}...")
    _, workflows_resp = make_request(f"{base_url}/api/v1/workflows", "GET", headers)
    existing = workflows_resp.get("data", [])

    wf_name = workflow_data.get("name", "Lost & Found - Autonomous Panorama Geolocation Pipeline")
    matched_id = None
    for wf in existing:
        if wf.get("name") == wf_name:
            matched_id = wf.get("id")
            break

    payload = {
        "name": wf_name,
        "nodes": workflow_data.get("nodes", []),
        "connections": workflow_data.get("connections", {}),
        "settings": workflow_data.get("settings", {}),
    }

    if matched_id:
        print(f"Workflow '{wf_name}' exists (ID: {matched_id}). Updating...")
        _, result = make_request(f"{base_url}/api/v1/workflows/{matched_id}", "PUT", headers, payload)
        wf_id = matched_id
    else:
        print(f"Creating new workflow '{wf_name}'...")
        _, result = make_request(f"{base_url}/api/v1/workflows", "POST", headers, payload)
        wf_id = result.get("id")

    print(f"Activating workflow (ID: {wf_id})...")
    try:
        make_request(f"{base_url}/api/v1/workflows/{wf_id}/activate", "POST", headers, {})
        print("Workflow successfully activated!")
    except Exception as e:
        print(f"Note: Activation skipped or automatic ({e})")

    webhook_path = "geolocate-panorama"
    for node in workflow_data.get("nodes", []):
        if node.get("type") == "n8n-nodes-base.webhook":
            webhook_path = node.get("parameters", {}).get("path", webhook_path)
            break

    print("\n------------------------------------------------------------")
    print(f"Success! Workflow deployed to {base_url}")
    print(f"Webhook URL: {base_url}/webhook/{webhook_path}")
    print("------------------------------------------------------------\n")


if __name__ == "__main__":
    main()
