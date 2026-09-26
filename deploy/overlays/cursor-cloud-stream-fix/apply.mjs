#!/usr/bin/env node
/**
 * Runtime overlay for Cursor Cloud adapter.
 *
 * Why: @cursor/sdk run.wait() returns stream_unavailable whenever cloud.envVars
 * is set, even when the remote agent finishes successfully. Upstream still passes
 * envVars; this overlay omits them and falls back to Cursor REST polling.
 *
 * Lives under overlays/ so upstream merges never conflict. Applied at container
 * start before the Paperclip server loads TypeScript sources.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "@quantumaxis cursor-cloud-stream-fix";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(
  __dirname,
  "../../../packages/adapters/cursor-cloud/src/server/execute.ts",
);

function fail(message) {
  console.error(`[cursor-cloud-stream-fix] ${message}`);
  process.exit(1);
}

function apply(source) {
  if (source.includes(MARKER)) {
    return { source, changed: false };
  }

  let next = source;

  const envNoteOld = `function renderPaperclipEnvNote(env: Record<string, string>): string {
  const keys = Object.keys(env)
    .filter((key) => key.startsWith("PAPERCLIP_"))
    .sort();
  if (keys.length === 0) return "";
  return [
    "Paperclip runtime note:",
    \`The following PAPERCLIP_* environment variables are available in the cloud agent shell: \${keys.join(", ")}\`,
    "Use them directly instead of assuming they are absent.",
  ].join("\\n");
}`;

  const envNoteNew = `function renderPaperclipEnvNote(env: Record<string, string>): string {
  // ${MARKER}
  // cloud.envVars breaks SDK wait(); pass PAPERCLIP_* via prompt instead.
  const secretish = /(KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION)/i;
  const entries = Object.entries(env)
    .filter(([key, value]) => key.startsWith("PAPERCLIP_") && value.length > 0 && !secretish.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "";
  return [
    "Paperclip runtime note:",
    "These PAPERCLIP_* values apply to this wake (not injected as shell envVars):",
    ...entries.map(([key, value]) => \`- \${key}=\${value}\`),
  ].join("\\n");
}`;

  if (!next.includes(envNoteOld)) fail("renderPaperclipEnvNote block not found (upstream changed)");
  next = next.replace(envNoteOld, envNoteNew);

  const optsOld = `function buildAgentOptions(input: {
  apiKey: string;
  name: string;
  model?: ModelSelection;
  envType: "cloud" | "pool" | "machine";
  envName: string | null;
  repos: Array<{ url: string; startingRef?: string; prUrl?: string }>;
  workOnCurrentBranch: boolean;
  autoCreatePR: boolean;
  skipReviewerRequest: boolean;
  envVars: Record<string, string>;
}): AgentOptions {
  return {
    apiKey: input.apiKey,
    name: input.name,
    ...(input.model ? { model: input.model } : {}),
    cloud: {
      env: {
        type: input.envType,
        ...(input.envName ? { name: input.envName } : {}),
      },
      repos: input.repos,
      workOnCurrentBranch: input.workOnCurrentBranch,
      autoCreatePR: input.autoCreatePR,
      skipReviewerRequest: input.skipReviewerRequest,
      envVars: input.envVars,
    },
  };
}`;

  const optsNew = `function buildAgentOptions(input: {
  apiKey: string;
  name: string;
  model?: ModelSelection;
  envType: "cloud" | "pool" | "machine";
  envName: string | null;
  repos: Array<{ url: string; startingRef?: string; prUrl?: string }>;
  workOnCurrentBranch: boolean;
  autoCreatePR: boolean;
  skipReviewerRequest: boolean;
}): AgentOptions {
  // ${MARKER}
  // Omit cloud.envVars — any envVars payload makes run.wait() return stream_unavailable.
  return {
    apiKey: input.apiKey,
    name: input.name,
    ...(input.model ? { model: input.model } : {}),
    cloud: {
      env: {
        type: input.envType,
        ...(input.envName ? { name: input.envName } : {}),
      },
      repos: input.repos,
      workOnCurrentBranch: input.workOnCurrentBranch,
      autoCreatePR: input.autoCreatePR,
      skipReviewerRequest: input.skipReviewerRequest,
    },
  };
}`;

  if (!next.includes(optsOld)) fail("buildAgentOptions block not found (upstream changed)");
  next = next.replace(optsOld, optsNew);

  const streamOld = `async function streamRun(run: Run, onLog: AdapterExecutionContext["onLog"]) {
  if (!run.supports("stream")) return;
  for await (const message of run.stream()) {
    await emitMessage(onLog, message);
  }
}`;

  const streamNew = `async function streamRun(run: Run, onLog: AdapterExecutionContext["onLog"]) {
  if (!run.supports("stream")) return;
  for await (const message of run.stream()) {
    await emitMessage(onLog, message);
  }
}

// ${MARKER}
type CursorRestAgentStatus = {
  status: string;
  resultText?: string;
};

function isStreamUnavailable(result: RunResult | null | undefined, streamError: string | null): boolean {
  const errObj = (result as { error?: { code?: string; message?: string } } | null | undefined)?.error;
  const code = typeof errObj?.code === "string" ? errObj.code : null;
  const message = trimNullable(errObj?.message)
    ?? trimNullable(result?.result)
    ?? streamError
    ?? "";
  return code === "stream_unavailable"
    || /stream is no longer available/i.test(message)
    || /stream_unavailable/i.test(message);
}

async function fetchCursorConversationResult(apiKey: string, agentId: string): Promise<string | undefined> {
  const res = await fetch(\`https://api.cursor.com/v0/agents/\${encodeURIComponent(agentId)}/conversation\`, {
    headers: { Authorization: \`Basic \${Buffer.from(\`\${apiKey}:\`).toString("base64")}\` },
  });
  if (!res.ok) return undefined;
  const body = asRecord(await res.json());
  const messages = Array.isArray(body?.messages) ? body!.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = asRecord(messages[i]);
    if (!msg) continue;
    const type = trimNullable(msg.type) ?? trimNullable(msg.role) ?? "";
    if (!/assistant/i.test(type)) continue;
    const text = trimNullable(msg.text) ?? trimNullable(msg.content);
    if (text) return text;
  }
  return undefined;
}

async function pollCursorAgentUntilSettled(input: {
  apiKey: string;
  agentId: string;
  onLog: AdapterExecutionContext["onLog"];
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<CursorRestAgentStatus> {
  const timeoutMs = input.timeoutMs ?? 15 * 60 * 1000;
  const intervalMs = input.intervalMs ?? 5000;
  const started = Date.now();
  const auth = \`Basic \${Buffer.from(\`\${input.apiKey}:\`).toString("base64")}\`;
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(\`https://api.cursor.com/v0/agents/\${encodeURIComponent(input.agentId)}\`, {
      headers: { Authorization: auth },
    });
    if (!res.ok) {
      await emitStatus(input.onLog, "running", \`Cursor REST poll HTTP \${res.status}; retrying.\`);
    } else {
      const body = asRecord(await res.json());
      const status = (trimNullable(body?.status) ?? "UNKNOWN").toUpperCase();
      await emitStatus(input.onLog, "running", \`Cursor REST status \${status}.\`);
      if (status === "FINISHED" || status === "ERROR" || status === "FAILED" || status === "CANCELLED" || status === "CANCELED") {
        const resultText = await fetchCursorConversationResult(input.apiKey, input.agentId);
        return { status, ...(resultText ? { resultText } : {}) };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { status: "TIMEOUT" };
}

async function waitForCursorRun(input: {
  run: Run;
  apiKey: string;
  onLog: AdapterExecutionContext["onLog"];
  streamErrorRef: { value: string | null };
}): Promise<RunResult> {
  const { run, apiKey, onLog, streamErrorRef } = input;
  const streamPromise = streamRun(run, onLog).catch((err) => {
    streamErrorRef.value = formatRunError(err);
  });

  let result: RunResult = run.supports("wait")
    ? await run.wait()
    : {
        id: run.id,
        status: run.status === "running" ? "error" : run.status,
        result: run.result,
        model: run.model,
        durationMs: run.durationMs,
        git: run.git,
      };

  await streamPromise;

  if (result.status === "finished") {
    return result;
  }

  await emitStatus(
    onLog,
    "running",
    \`SDK wait status=\${result.status}\${isStreamUnavailable(result, streamErrorRef.value) ? " (stream_unavailable)" : ""}; polling Cursor REST for agent \${run.agentId}.\`,
  );
  const polled = await pollCursorAgentUntilSettled({ apiKey, agentId: run.agentId, onLog });
  const mappedStatus = polled.status === "FINISHED" ? "finished" : "error";
  streamErrorRef.value = mappedStatus === "finished" ? null : (streamErrorRef.value ?? \`Cursor agent \${polled.status}\`);
  return {
    id: run.id,
    status: mappedStatus,
    result: polled.resultText ?? result.result,
    model: result.model ?? run.model,
    durationMs: result.durationMs ?? run.durationMs,
    git: result.git ?? run.git,
  };
}`;

  if (!next.includes(streamOld)) fail("streamRun block not found (upstream changed)");
  next = next.replace(streamOld, streamNew);

  const callOld = `  const agentOptions = buildAgentOptions({
    apiKey,
    name: \`Paperclip \${agent.name}\`,
    model,
    envType,
    envName,
    repos,
    workOnCurrentBranch,
    autoCreatePR,
    skipReviewerRequest,
    envVars: remoteEnv,
  });`;

  const callNew = `  const agentOptions = buildAgentOptions({
    apiKey,
    name: \`Paperclip \${agent.name}\`,
    model,
    envType,
    envName,
    repos,
    workOnCurrentBranch,
    autoCreatePR,
    skipReviewerRequest,
  });`;

  if (!next.includes(callOld)) fail("buildAgentOptions call site not found (upstream changed)");
  next = next.replace(callOld, callNew);

  const waitOld = `    const streamPromise = streamRun(run, onLog).catch((err) => {
      streamError = formatRunError(err);
    });
    const result = run.supports("wait")
      ? await run.wait()
      : {
          id: run.id,
          status: run.status === "running" ? "error" : run.status,
          result: run.result,
          model: run.model,
          durationMs: run.durationMs,
          git: run.git,
        };
    await streamPromise;`;

  const waitNew = `    const streamErrorRef = { value: streamError };
    const result = await waitForCursorRun({ run, apiKey, onLog, streamErrorRef });
    streamError = streamErrorRef.value;`;

  if (!next.includes(waitOld)) fail("wait/stream block not found (upstream changed)");
  next = next.replace(waitOld, waitNew);

  if (!next.includes(MARKER)) fail("marker missing after patch");
  return { source: next, changed: true };
}

if (!fs.existsSync(TARGET)) {
  fail(`target missing: ${TARGET}`);
}

const original = fs.readFileSync(TARGET, "utf8");
const { source, changed } = apply(original);
if (changed) {
  fs.writeFileSync(TARGET, source);
  console.log(`[cursor-cloud-stream-fix] applied overlay to ${TARGET}`);
} else {
  console.log(`[cursor-cloud-stream-fix] already applied: ${TARGET}`);
}
