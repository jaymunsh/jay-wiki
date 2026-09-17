#!/usr/bin/env python3
"""Refresh the Spring/web snapshot by running complete suites; check CI reports against it."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'web/src/data/test-summary.json'


def spring_count():
    reports = list((ROOT / 'spring/build/test-results/test').glob('TEST-*.xml'))
    if not reports:
        raise ValueError('Missing Spring test reports')
    roots = [ET.parse(p).getroot() for p in reports]
    if any(int(r.get(k, 0)) for r in roots for k in ['failures', 'errors', 'skipped']):
        raise ValueError('Spring suite must pass without skipped tests')
    return sum(int(r.get('tests', 0)) for r in roots)


def web_count(path):
    report = json.loads(Path(path).read_text())
    if not report['success'] or report['numFailedTests'] or report['numPendingTests'] or report.get('numTodoTests', 0):
        raise ValueError('Web suite must pass without pending/todo tests')
    if report['numPassedTests'] != report['numTotalTests']:
        raise ValueError('Web report is incomplete')
    return report['numPassedTests']


def markdown(data):
    return ('# 최근 전체 회귀 검증\n\n'
            '이 파일과 포트폴리오 수치는 `scripts/update-test-summary.py`가 전체 테스트 실행 결과로 생성한다.\n'
            '브라우저 E2E·Python 서비스·수동 검증은 이 합계에 포함하지 않는다. 테스트 수는 품질 점수가 아니다.\n\n'
            f"검증 시각(UTC): {data['verifiedAt']}\n\n"
            '| 범위 | 통과 |\n|---|---:|\n'
            f"| Spring | {data['spring']} |\n| Web Vitest | {data['web']} |\n| 합계 | {data['total']} |\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', choices=['spring', 'web', 'docs'])
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    if args.check:
        data = json.loads(SNAPSHOT.read_text())
        assert data['total'] == data['spring'] + data['web']
        if args.check == 'docs':
            assert (ROOT / 'docs/test-summary.md').read_text() == markdown(data), 'Regenerate test summary'
        else:
            count = spring_count() if args.check == 'spring' else web_count(args.report)
            assert count == data[args.check], 'Test count changed: run python3 scripts/update-test-summary.py'
        print(f'{args.check} test summary matches')
        return
    # Do not accept arbitrary existing reports here: they may come from a filtered test run.
    subprocess.run(['./gradlew', 'test', '--rerun'], cwd=ROOT / 'spring', check=True)
    spring = spring_count()
    with tempfile.TemporaryDirectory() as tmp:
        report = Path(tmp) / 'vitest.json'
        subprocess.run(['npm', 'test', '--', '--reporter=json', f'--outputFile={report}'], cwd=ROOT / 'web', check=True)
        web = web_count(report)
    if min(spring, web) <= 0:
        raise ValueError('Empty test suite')
    data = dict(verifiedAt=datetime.now(timezone.utc).isoformat(timespec='seconds'), spring=spring, web=web, total=spring + web)
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(json.dumps(data, indent=2) + '\n')
    (ROOT / 'docs/test-summary.md').write_text(markdown(data))
    print(f'Updated verified snapshot: {spring} + {web} = {spring + web}')


if __name__ == '__main__':
    main()
