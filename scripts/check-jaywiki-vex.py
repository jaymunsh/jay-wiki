#!/usr/bin/env python3
"""Fail closed on widened or stale application-specific exploitability statements."""
from datetime import datetime, timezone
import json
from pathlib import Path


def validate(document, now=None):
    now = now or datetime.now(timezone.utc)
    if document.get('@context') != 'https://openvex.dev/ns/v0.2.0':
        raise ValueError('Unexpected VEX format')
    deadline = datetime.fromisoformat(document['x-jaywiki-review-before'].replace('Z', '+00:00'))
    if now >= deadline:
        raise ValueError('Reassess current MVC reachability before accepting VEX')
    statements = document.get('statements', [])
    if len(statements) != 1:
        raise ValueError('Exactly one reviewed application finding is allowed')
    statement = statements[0]
    if statement.get('vulnerability') != {'name': 'CVE-2026-47884'}:
        raise ValueError('Unreviewed vulnerability')
    if statement.get('products') != [{'@id': 'pkg:maven/org.springframework/spring-webmvc@6.2.19'}]:
        raise ValueError('Unreviewed component/version or widened product scope')
    if statement.get('status') != 'not_affected' or statement.get('justification') != 'vulnerable_code_not_in_execute_path':
        raise ValueError('Only current application non-reachability is established')
    if 'MvcXsltReachabilityTest' not in statement.get('impact_statement', ''):
        raise ValueError('Application context evidence is required')


if __name__ == '__main__':
    validate(json.loads(Path('security/jaywiki.openvex.json').read_text()))
    print('Exact jay-wiki MVC VEX scope is current; library findings remain in unfiltered evidence')
