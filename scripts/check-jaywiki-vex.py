#!/usr/bin/env python3
"""Fail closed on widened or stale application-specific exploitability statements."""
from datetime import datetime, timezone
import json
from pathlib import Path

WEBMVC = 'pkg:maven/org.springframework/spring-webmvc@6.2.19'
WEBFLUX = 'pkg:maven/org.springframework/spring-webflux@6.2.19'
# Each reviewed finding: exact product scope and the test that proves the precondition is absent.
REVIEWED = {
    'CVE-2026-47884': ([WEBMVC], 'MvcXsltReachabilityTest'),
    'CVE-2026-47890': ([WEBMVC, WEBFLUX], 'MvcSseRouterReachabilityTest'),
    'CVE-2026-47892': ([WEBFLUX], 'MvcSseRouterReachabilityTest'),
}


def validate(document, now=None):
    now = now or datetime.now(timezone.utc)
    if document.get('@context') != 'https://openvex.dev/ns/v0.2.0':
        raise ValueError('Unexpected VEX format')
    deadline = datetime.fromisoformat(document['x-jaywiki-review-before'].replace('Z', '+00:00'))
    if now >= deadline:
        raise ValueError('Reassess current MVC reachability before accepting VEX')
    statements = document.get('statements', [])
    names = [s.get('vulnerability', {}).get('name') for s in statements]
    if len(statements) != len(REVIEWED) or sorted(names) != sorted(REVIEWED):
        raise ValueError('Exactly the reviewed application findings are allowed')
    for statement in statements:
        if set(statement['vulnerability']) != {'name'}:
            raise ValueError('Unreviewed vulnerability')
        products, evidence = REVIEWED[statement['vulnerability']['name']]
        if statement.get('products') != [{'@id': p} for p in products]:
            raise ValueError('Unreviewed component/version or widened product scope')
        if statement.get('status') != 'not_affected' or statement.get('justification') != 'vulnerable_code_not_in_execute_path':
            raise ValueError('Only current application non-reachability is established')
        if evidence not in statement.get('impact_statement', ''):
            raise ValueError('Application context evidence is required')


if __name__ == '__main__':
    validate(json.loads(Path('security/jaywiki.openvex.json').read_text()))
    print('Exact jay-wiki MVC VEX scope is current; library findings remain in unfiltered evidence')
