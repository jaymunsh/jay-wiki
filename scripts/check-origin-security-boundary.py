#!/usr/bin/env python3
"""Bounded TCP checks of the owner's configured origin, from an external runner."""
import ipaddress
import json
import os
import socket

origin = os.environ.get('JAYWIKI_ORIGIN_IPV4', '')
address = ipaddress.ip_address(origin)
if address.version != 4 or not address.is_global:
    raise SystemExit('A verified public IPv4 origin is required')
failed = False
for port in (22, 5432, 6379, 6443, 9000, 9001, 9200):
    try:
        with socket.create_connection((str(address), port), timeout=4):
            state = 'reachable'
            failed = True
    except ConnectionRefusedError:
        state = 'refused'
    except socket.timeout:
        state = 'filtered-or-no-response'
    except OSError:
        state = 'indeterminate-network-error'
        failed = True
    print(json.dumps({'target':'configured-owned-origin', 'port':port, 'result':state}))
raise SystemExit(1 if failed else 0)
