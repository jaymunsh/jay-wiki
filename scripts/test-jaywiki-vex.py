#!/usr/bin/env python3
import copy
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('vex', Path(__file__).with_name('check-jaywiki-vex.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
DOCUMENT = json.loads(Path('security/jaywiki.openvex.json').read_text())
NOW = datetime(2026, 10, 6, tzinfo=timezone.utc)

class VexTests(unittest.TestCase):
    def test_current_statement_and_expiry_boundary(self):
        module.validate(DOCUMENT, NOW)
        with self.assertRaises(ValueError):
            module.validate(DOCUMENT, datetime(2026, 10, 20, tzinfo=timezone.utc))

    def test_other_versions_and_products_cannot_inherit_statement(self):
        for product in ['pkg:maven/org.springframework/spring-webmvc@6.2.18',
                        'pkg:maven/org.springframework/spring-webmvc', 'pkg:oci/other-app']:
            changed = copy.deepcopy(DOCUMENT)
            changed['statements'][0]['products'] = [{'@id': product}]
            with self.assertRaises(ValueError): module.validate(changed, NOW)

    def test_other_findings_and_extra_statements_remain_blocking(self):
        changed = copy.deepcopy(DOCUMENT)
        changed['statements'][0]['vulnerability']['name'] = 'CVE-OTHER'
        with self.assertRaises(ValueError): module.validate(changed, NOW)
        changed = copy.deepcopy(DOCUMENT)
        changed['statements'].append(copy.deepcopy(changed['statements'][0]))
        with self.assertRaises(ValueError): module.validate(changed, NOW)

    def test_code_absence_cannot_be_claimed_for_a_packaged_class(self):
        changed = copy.deepcopy(DOCUMENT)
        changed['statements'][0]['justification'] = 'vulnerable_code_not_present'
        with self.assertRaises(ValueError): module.validate(changed, NOW)

if __name__ == '__main__': unittest.main()
