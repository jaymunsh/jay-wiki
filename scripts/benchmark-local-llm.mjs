#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const DEFAULT_OUTPUT = 'docs/benchmarks/local-llm/latest.json';
const OLLAMA_MODEL = 'qwen3.6:35b-a3b-coding-nvfp4';
const OMLX_MODEL = 'Qwen3.6-35B-A3B-OptiQ-4bit';
const THINKING_MODES = [true, false];
const CACHE_MODES = ['miss', 'hit'];

function parseArgs(argv) {
  const options = { engine: 'both', iterations: 3, output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--engine') options.engine = argv[++index];
    else if (value === '--iterations') options.iterations = Number(argv[++index]);
    else if (value === '--output') options.output = argv[++index];
    else if (value === '--help') options.help = true;
    else throw new Error(`Unknown option: ${value}`);
  }
  if (!['both', 'ollama', 'omlx'].includes(options.engine)) {
    throw new Error('--engine must be both, ollama, or omlx');
  }
  if (!Number.isInteger(options.iterations) || options.iterations < 1) {
    throw new Error('--iterations must be a positive integer');
  }
  return options;
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/benchmark-local-llm.mjs [options]\n\n`);
  process.stdout.write(`  --engine both|ollama|omlx  Engines to test (default: both)\n`);
  process.stdout.write(`  --iterations N             Warm measurements per case (default: 3)\n`);
  process.stdout.write(`  --output PATH              Raw JSON output path\n`);
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return sorted[index];
}

function summarize(rows, field) {
  const values = rows.map((row) => row[field]).filter(Number.isFinite);
  if (values.length === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    mean: Number(mean.toFixed(2)),
    median: Number(percentile(values, 0.5).toFixed(2)),
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
  };
}

async function readOmlxSettings() {
  const path = resolve(homedir(), '.omlx/settings.json');
  const settings = JSON.parse(await readFile(path, 'utf8'));
  return {
    baseUrl: `http://${settings.server.host}:${settings.server.port}`,
    apiKey: settings.auth.api_key,
  };
}

function hardwareMetadata() {
  const profile = execFileSync('system_profiler', ['SPHardwareDataType', '-json'], {
    encoding: 'utf8',
  });
  const displayProfile = execFileSync('system_profiler', ['SPDisplaysDataType', '-json'], {
    encoding: 'utf8',
  });
  const hardware = JSON.parse(profile).SPHardwareDataType[0];
  const gpu = JSON.parse(displayProfile).SPDisplaysDataType[0];
  return {
    chip: hardware.chip_type,
    gpu: gpu.sppci_model,
    gpuCores: Number(gpu.sppci_cores),
    memory: hardware.physical_memory,
    model: hardware.machine_model,
    os: execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim(),
    ollamaVersion: execFileSync('ollama', ['--version'], { encoding: 'utf8' }).trim(),
    omlxVersion: execFileSync('omlx', ['--version'], { encoding: 'utf8' }).trim(),
  };
}

function longContext() {
  const records = Array.from({ length: 180 }, (_, index) => {
    const id = String(index + 1).padStart(3, '0');
    return `ORDER-${id}: region=${index % 2 === 0 ? 'SEOUL' : 'BUSAN'}, amount=${1000 + index * 37}, status=${index % 7 === 0 ? 'RETRY' : 'DONE'}`;
  });
  return `${records.join('\n')}\n\nRETRY 상태인 주문 수와 amount 합계를 계산하고, 검산 가능한 주문 ID 목록을 JSON으로 출력하라.`;
}

const CASES = [
  {
    id: 'short-explanation',
    maxTokens: 512,
    prompt: '낙관적 락과 비관적 락의 차이를 이커머스 재고 차감 사례로 간결하게 설명하라.',
  },
  {
    id: 'coding',
    maxTokens: 512,
    prompt: 'Java 21로 멱등성 키를 적용한 주문 생성 서비스 예제를 작성하라. 동시 요청, 트랜잭션 경계, 실패 응답을 포함하고 코드 중심으로 답하라.',
  },
  {
    id: 'long-context',
    maxTokens: 512,
    prompt: longContext(),
  },
];

async function unloadOllama() {
  await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, keep_alive: 0 }),
  }).catch(() => undefined);
}

async function unloadOmlx(config) {
  const modelId = encodeURIComponent(OMLX_MODEL);
  await fetch(`${config.baseUrl}/v1/models/${modelId}/unload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${config.apiKey}` },
  }).catch(() => undefined);
}

async function streamOpenAIChat({
  url,
  apiKey,
  model,
  prompt,
  maxTokens,
  thinking,
  captureOutput = false,
}) {
  const startedAt = performance.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '정확하고 직접적으로 답하라. 불필요한 서론은 생략한다. 첫 줄의 실험 식별자는 답변에 포함하지 않는다.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: maxTokens,
      chat_template_kwargs: { enable_thinking: thinking },
      stream: true,
      stream_options: { include_usage: true },
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`${model} returned HTTP ${response.status}: ${await response.text()}`);
  }

  let buffer = '';
  let firstTokenAt;
  let firstVisibleTokenAt;
  let usage;
  let text = '';
  let reasoningText = '';
  for await (const chunk of response.body) {
    buffer += Buffer.from(chunk).toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      const event = JSON.parse(payload);
      const delta = event.choices?.[0]?.delta ?? {};
      const reasoning = delta.reasoning_content ?? '';
      const content = delta.content ?? '';
      if ((reasoning || content) && firstTokenAt === undefined) firstTokenAt = performance.now();
      if (content && firstVisibleTokenAt === undefined) firstVisibleTokenAt = performance.now();
      reasoningText += reasoning;
      text += content;
      if (event.usage) usage = event.usage;
    }
  }

  const completedAt = performance.now();
  if (firstTokenAt === undefined || !usage?.completion_tokens || !usage?.prompt_tokens) {
    throw new Error(`${model} did not return streaming content and token usage`);
  }
  const ttftMs = firstTokenAt - startedAt;
  const decodeSeconds = Math.max((completedAt - firstTokenAt) / 1000, 0.001);
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    ttftMs: Number(ttftMs.toFixed(2)),
    visibleTtftMs: firstVisibleTokenAt
      ? Number((firstVisibleTokenAt - startedAt).toFixed(2))
      : null,
    totalMs: Number((completedAt - startedAt).toFixed(2)),
    effectivePromptTokensPerSecond: Number((usage.prompt_tokens / (ttftMs / 1000)).toFixed(2)),
    decodeTokensPerSecond: Number((usage.completion_tokens / decodeSeconds).toFixed(2)),
    providerPromptTokensPerSecond: usage.prompt_tokens_per_second ?? null,
    providerDecodeTokensPerSecond: usage.generation_tokens_per_second ?? null,
    cachedPromptTokens: usage.prompt_tokens_details?.cached_tokens ?? null,
    outputCharacters: text.length,
    reasoningCharacters: reasoningText.length,
    outputPreview: text.slice(0, 240),
    ...(captureOutput ? { outputText: text } : {}),
  };
}

async function streamOllamaChat({ model, prompt, maxTokens, thinking, captureOutput = false }) {
  const startedAt = performance.now();
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '정확하고 직접적으로 답하라. 불필요한 서론은 생략한다. 첫 줄의 실험 식별자는 답변에 포함하지 않는다.' },
        { role: 'user', content: prompt },
      ],
      options: { temperature: 0, num_predict: maxTokens },
      think: thinking,
      stream: true,
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`${model} returned HTTP ${response.status}: ${await response.text()}`);
  }

  let buffer = '';
  let firstTokenAt;
  let firstVisibleTokenAt;
  let finalEvent;
  let text = '';
  let reasoningText = '';
  for await (const chunk of response.body) {
    buffer += Buffer.from(chunk).toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      const reasoning = event.message?.thinking ?? '';
      const content = event.message?.content ?? '';
      if ((reasoning || content) && firstTokenAt === undefined) firstTokenAt = performance.now();
      if (content && firstVisibleTokenAt === undefined) firstVisibleTokenAt = performance.now();
      reasoningText += reasoning;
      text += content;
      if (event.done) finalEvent = event;
    }
  }

  const completedAt = performance.now();
  if (firstTokenAt === undefined || !finalEvent?.eval_count || !finalEvent?.prompt_eval_count) {
    throw new Error(`${model} did not return streaming content and native timing metrics`);
  }
  const ttftMs = firstTokenAt - startedAt;
  const decodeSeconds = Math.max((completedAt - firstTokenAt) / 1000, 0.001);
  return {
    promptTokens: finalEvent.prompt_eval_count,
    completionTokens: finalEvent.eval_count,
    ttftMs: Number(ttftMs.toFixed(2)),
    visibleTtftMs: firstVisibleTokenAt
      ? Number((firstVisibleTokenAt - startedAt).toFixed(2))
      : null,
    totalMs: Number((completedAt - startedAt).toFixed(2)),
    effectivePromptTokensPerSecond: Number((finalEvent.prompt_eval_count / (ttftMs / 1000)).toFixed(2)),
    decodeTokensPerSecond: Number((finalEvent.eval_count / decodeSeconds).toFixed(2)),
    providerPromptTokensPerSecond: Number(
      (finalEvent.prompt_eval_count / (finalEvent.prompt_eval_duration / 1e9)).toFixed(2),
    ),
    providerDecodeTokensPerSecond: Number(
      (finalEvent.eval_count / (finalEvent.eval_duration / 1e9)).toFixed(2),
    ),
    providerLoadMs: Number((finalEvent.load_duration / 1e6).toFixed(2)),
    outputCharacters: text.length,
    reasoningCharacters: reasoningText.length,
    outputPreview: text.slice(0, 240),
    ...(captureOutput ? { outputText: text } : {}),
  };
}

async function benchmarkEngine(engine, iterations, omlxConfig) {
  const isOllama = engine === 'ollama';
  const config = isOllama
    ? { model: OLLAMA_MODEL }
    : {
        url: `${omlxConfig.baseUrl}/v1/chat/completions`,
        apiKey: omlxConfig.apiKey,
        model: OMLX_MODEL,
      };
  const runChat = isOllama ? streamOllamaChat : streamOpenAIChat;

  if (isOllama) await unloadOmlx(omlxConfig);
  else await unloadOllama();

  if (isOllama) await unloadOllama();
  else await unloadOmlx(omlxConfig);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 3000));
  process.stdout.write(`[${engine}] cold-load baseline\n`);
  const cold = await runChat({ ...config, ...CASES[0], thinking: true });

  const result = { engine, model: config.model, cold, modes: [], qualityChecks: [] };
  for (const thinking of THINKING_MODES) {
    const mode = { thinking, cacheModes: [] };
    for (const cacheMode of CACHE_MODES) {
      const cacheResult = { cacheMode, cases: [] };
      for (const testCase of CASES) {
        const label = `${testCase.id}/${thinking ? 'thinking-on' : 'thinking-off'}/${cacheMode}`;
        const promptFor = (index) =>
          cacheMode === 'miss'
            ? `[BENCH-${engine}-${thinking}-${testCase.id}-${index}]\n${testCase.prompt}`
            : testCase.prompt;

        process.stdout.write(`[${engine}] ${label}: warmup\n`);
        await runChat({ ...config, ...testCase, prompt: promptFor('warmup'), thinking });

        const warm = [];
        for (let index = 0; index < iterations; index += 1) {
          process.stdout.write(`[${engine}] ${label}: warm ${index + 1}/${iterations}\n`);
          warm.push(
            await runChat({ ...config, ...testCase, prompt: promptFor(index), thinking }),
          );
        }
        cacheResult.cases.push({
          id: testCase.id,
          maxTokens: testCase.maxTokens,
          warm,
          summary: {
            ttftMs: summarize(warm, 'ttftMs'),
            visibleTtftMs: summarize(warm, 'visibleTtftMs'),
            totalMs: summarize(warm, 'totalMs'),
            effectivePromptTokensPerSecond: summarize(warm, 'effectivePromptTokensPerSecond'),
            decodeTokensPerSecond: summarize(warm, 'decodeTokensPerSecond'),
            providerPromptTokensPerSecond: summarize(warm, 'providerPromptTokensPerSecond'),
            providerDecodeTokensPerSecond: summarize(warm, 'providerDecodeTokensPerSecond'),
          },
        });
      }
      mode.cacheModes.push(cacheResult);
    }
    result.modes.push(mode);
  }

  for (const thinking of THINKING_MODES) {
    for (const testCase of CASES) {
      process.stdout.write(
        `[${engine}] ${testCase.id}/${thinking ? 'thinking-on' : 'thinking-off'}: quality\n`,
      );
      result.qualityChecks.push({
        id: testCase.id,
        thinking,
        result: await runChat({
          ...config,
          ...testCase,
          maxTokens: 1024,
          thinking,
          captureOutput: true,
        }),
      });
    }
  }
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const omlxConfig = await readOmlxSettings();
  const engines = options.engine === 'both' ? ['omlx', 'ollama'] : [options.engine];
  const artifact = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    methodology: {
      iterations: options.iterations,
      warmupRuns: 1,
      coldRuns: 1,
      temperature: 0,
      thinkingModes: THINKING_MODES,
      cacheModes: CACHE_MODES,
      note: 'Client-observed streaming metrics. Effective prompt throughput includes queue, HTTP, template, tokenization, model load if cold, and prefill time.',
    },
    hardware: hardwareMetadata(),
    engines: [],
  };

  for (const engine of engines) {
    artifact.engines.push(await benchmarkEngine(engine, options.iterations, omlxConfig));
  }
  await unloadOllama();
  await unloadOmlx(omlxConfig);

  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`Wrote ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
