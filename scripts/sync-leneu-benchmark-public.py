#!/usr/bin/env python3
"""Leneu Benchmark의 공개 탐색기와 카탈로그에 등록된 산출물만 web/public로 복사한다."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path.home() / "Documents/LeneuTest/LocalLLM/leneu-benchmark"
DESTINATION = REPOSITORY_ROOT / "web/public/benchmark"
VIEWER_FILES = (
    "index.html",
    "scoring-guide.html",
    "markdown-viewer.html",
    "favicon.svg",
)
VIEWER_DIRECTORIES = ("css", "js", "data")
PUBLIC_TASK_FILES = {
    "TC-01": ("answer.md", "RESULT.md"),
    "TC-02": ("answer.md", "RESULT.md"),
    "TC-04": ("answer.md", "RESULT.md"),
    "H-01": ("RESULT.md",),
    "H-03": ("RESULT.md",),
    "WEB-01": ("index.html", "RESULT.md"),
    "GAME-01": ("index.html", "RESULT.md"),
    "GAME-02": ("index.html", "RESULT.md"),
    "CODE-01": ("RESULT.md",),
    "WRITE-01": ("article.md", "RESULT.md"),
    "WRITE-02": ("edited.md", "RESULT.md"),
    "THINK-01": ("summary.md", "RESULT.md"),
    "SEARCH-01": ("research.md", "RESULT.md"),
    "SEARCH-03": ("research.md", "RESULT.md"),
    "ALG-01": ("explanation.md", "RESULT.md"),
    "REASON-KO-01": ("explanation.md", "RESULT.md"),
    "REASON-MATH-01": ("explanation.md", "RESULT.md"),
    "REASON-SCI-01": ("explanation.md", "RESULT.md"),
    "BUILD-01": ("server.mjs", "RESULT.md"),
    "STYLE-01": ("status-page.md", "apology-email.md", "exec-summary.md", "RESULT.md", "input/style01-facts.md"),
    "AMBIG-01": ("assumptions.md", "RESULT.md"),
    "AMBIG-02": ("assumptions.md", "RESULT.md"),
    "AMBIG-03": ("assumptions.md", "RESULT.md"),
    "TRAP-01": ("report.md", "RESULT.md"),
    "TRAP-02": ("guide.md", "RESULT.md"),
    "TRAP-03": ("answer.md", "RESULT.md"),
    "TRAP-04": ("report.md", "RESULT.md"),
    "LOOP-01": ("answers-r1.json", "answers-r2.json", "answers-r3.json", "RESULT.md"),
}


def copy_public_files(source: Path, destination: Path) -> tuple[int, int]:
    viewer = source / "benchmark-html"
    catalog_path = viewer / "data/catalog.json"
    if not catalog_path.is_file():
        raise SystemExit(f"카탈로그를 찾을 수 없다: {catalog_path}")

    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    models = catalog.get("models")
    if not isinstance(models, list) or not models:
        raise SystemExit("catalog.json에 공개할 models가 없다")

    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)

    for name in VIEWER_FILES:
        shutil.copy2(viewer / name, destination / name)
    for name in VIEWER_DIRECTORIES:
        shutil.copytree(viewer / name, destination / name)

    copied_runs = 0
    for model in models:
        model_slug = model.get("modelSlug")
        run_id = model.get("runId")
        if not isinstance(model_slug, str) or not isinstance(run_id, str):
            raise SystemExit("catalog.json의 modelSlug/runId가 올바르지 않다")
        source_outputs = source / "runs" / model_slug / run_id / "outputs"
        if not source_outputs.is_dir():
            raise SystemExit(f"공개 산출물 폴더를 찾을 수 없다: {source_outputs}")
        target_outputs = destination / "runs" / model_slug / run_id / "outputs"
        tasks = model.get("tasks")
        if not isinstance(tasks, dict) or not tasks:
            raise SystemExit(f"catalog.json에 공개할 tasks가 없다: {model_slug}/{run_id}")
        for task_id, task in tasks.items():
            names = PUBLIC_TASK_FILES.get(task_id)
            if names is None:
                raise SystemExit(f"공개 파일 allowlist에 없는 과제다: {task_id}")
            target_task = target_outputs / task_id
            target_task.mkdir(parents=True, exist_ok=True)
            copied_names = []
            for name in names:
                source_file = source_outputs / task_id / name
                if not source_file.is_file() or source_file.is_symlink():
                    if name == "RESULT.md":
                        raise SystemExit(f"공개 산출물 파일을 찾을 수 없다: {source_file}")
                    # 대표 답안이 없는 과제(미제출·부분 산출물)는 RESULT.md만 공개한다.
                    # 탐색기는 files 목록에 없는 대표 파일을 RESULT.md로 대체해 연다.
                    print(f"  경고: 대표 답안 없음, RESULT.md만 공개: {model_slug}/{run_id}/{task_id}/{name}")
                    continue
                shutil.copy2(source_file, target_task / name)
                copied_names.append(name)
            task["files"] = copied_names
        copied_runs += 1

    # 원본 카탈로그의 files에는 .history와 입력 사본 디렉터리도 들어 있다. 공개본은 위에서
    # 실제로 복사한 파일만 가리켜야 하므로 목적지 카탈로그를 선별 결과로 다시 쓴다.
    (destination / "data/catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    prepare_for_blog_route(destination)
    redact_local_paths(destination)
    normalize_public_text(destination)
    verify_primary_files(destination, catalog)
    file_count = sum(1 for path in destination.rglob("*") if path.is_file())
    return copied_runs, file_count


def prepare_for_blog_route(destination: Path) -> None:
    index = destination / "index.html"
    index_text = index.read_text(encoding="utf-8")
    if '<base href="/benchmark/">' not in index_text:
        index_text = index_text.replace("<head>", '<head>\n  <base href="/benchmark/">', 1)
    index_text = pin_marked(index_text)
    index.write_text(index_text.replace("../runs/", "runs/"), encoding="utf-8")

    app = destination / "js/app.js"
    app_text = app.read_text(encoding="utf-8").replace("../runs/", "runs/")
    unsafe_render = """      // Render using marked.js if available
      if (window.marked) {
        contentEl.innerHTML = window.marked.parse(text);
"""
    safe_render = """      // 제출 Markdown 안의 raw HTML은 실행하지 않는다. Markdown 문법은 유지하면서
      // 태그만 문자로 바꿔, 모델 산출물이 블로그 origin의 DOM 권한을 얻지 못하게 한다.
      const safeMarkdown = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      if (window.marked) {
        contentEl.innerHTML = window.marked.parse(safeMarkdown);
"""
    if unsafe_render not in app_text and safe_render not in app_text:
        raise SystemExit("app.js의 Markdown 렌더링 구간을 찾을 수 없다")
    app.write_text(app_text.replace(unsafe_render, safe_render), encoding="utf-8")

    markdown_viewer = destination / "markdown-viewer.html"
    viewer_text = pin_marked(markdown_viewer.read_text(encoding="utf-8"))
    viewer_text = viewer_text.replace("source.startsWith('../runs/')", "source.startsWith('runs/')")
    viewer_text = viewer_text.replace(
        "if (!source || !source.startsWith('runs/'))",
        "if (!source || !source.startsWith('runs/') || source.includes('..'))",
    )
    markdown_viewer.write_text(viewer_text, encoding="utf-8")


def pin_marked(text: str) -> str:
    return text.replace(
        "https://cdn.jsdelivr.net/npm/marked/marked.min.js",
        "https://cdn.jsdelivr.net/npm/marked@14.1.3/marked.min.js",
    )


def redact_local_paths(destination: Path) -> None:
    user_path = re.compile(r"/Users/(?!abc/|REDACTED/)[^/]+/")
    for path in destination.rglob("*"):
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        redacted = user_path.sub("/Users/REDACTED/", text)
        if redacted != text:
            path.write_text(redacted, encoding="utf-8")


def normalize_public_text(destination: Path) -> None:
    """공개 사본의 텍스트만 정규화해 재생성할 때 같은 diff를 만든다."""
    for path in destination.rglob("*"):
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        lines = [line.expandtabs(2).rstrip() for line in text.splitlines()]
        while lines and not lines[-1]:
            lines.pop()
        normalized = "\n".join(lines) + "\n"
        if normalized != text:
            path.write_text(normalized, encoding="utf-8")


def verify_primary_files(destination: Path, catalog: dict) -> None:
    missing: list[Path] = []
    for model in catalog["models"]:
        base = destination / "runs" / model["modelSlug"] / model["runId"] / "outputs"
        for task_id, task in model.get("tasks", {}).items():
            primary = "index.html" if task.get("hasHtml") else "RESULT.md"
            candidate = base / task_id / primary
            if not candidate.is_file():
                missing.append(candidate)
    if missing:
        detail = "\n".join(str(path) for path in missing[:20])
        raise SystemExit(f"카탈로그의 대표 산출물이 {len(missing)}개 없다:\n{detail}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    runs, files = copy_public_files(args.source.expanduser().resolve(), DESTINATION)
    print(f"Leneu Benchmark 공개본 갱신: 실행 {runs}개, 파일 {files}개 -> {DESTINATION}")


if __name__ == "__main__":
    main()
