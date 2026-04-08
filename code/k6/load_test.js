/**
 * k6 load test — Forge API
 * Run: k6 run --env BASE_URL=http://localhost:8000 --env JWT_TOKEN=<token> k6/load_test.js
 *
 * SLO targets (from SRS):
 *   - p95 latency ≤ 100ms for read endpoints
 *   - Error rate < 1%
 *   - Throughput: 1000 concurrent users
 */
import http from "k6/http";
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const JWT_TOKEN = __ENV.JWT_TOKEN || "";

// Custom metrics
const errorRate = new Rate("errors");
const graphCreateDuration = new Trend("graph_create_duration", true);
const graphReadDuration = new Trend("graph_read_duration", true);
const executionStartDuration = new Trend("execution_start_duration", true);

export const options = {
  scenarios: {
    // Ramp up to 1000 concurrent read/write users over 2 min
    read_write: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 200 },
        { duration: "1m", target: 1000 },
        { duration: "30s", target: 0 },
      ],
    },
    // Sustained execution load: 50 users starting executions
    executions: {
      executor: "constant-vus",
      vus: 50,
      duration: "2m",
      startTime: "30s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<100"],
    errors: ["rate<0.01"],
    graph_read_duration: ["p(95)<80"],
    graph_create_duration: ["p(95)<200"],
    execution_start_duration: ["p(95)<500"],
  },
};

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${JWT_TOKEN}`,
};

export function setup() {
  // Health check before running
  const resp = http.get(`${BASE_URL}/healthz`);
  check(resp, { "healthz ok": (r) => r.status === 200 });
  return {};
}

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME ?? "read_write";

  if (scenario === "executions") {
    runExecutionScenario();
  } else {
    runReadWriteScenario();
  }
}

function runReadWriteScenario() {
  // 1. List graphs (read)
  const listStart = Date.now();
  const listResp = http.get(`${BASE_URL}/graphs`, { headers: HEADERS });
  graphReadDuration.add(Date.now() - listStart);
  errorRate.add(listResp.status !== 200);
  check(listResp, { "list graphs 200": (r) => r.status === 200 });

  sleep(0.1);

  // 2. Create a graph (write)
  const createStart = Date.now();
  const createResp = http.post(
    `${BASE_URL}/graphs`,
    JSON.stringify({
      title: `Load Test Graph ${__VU}-${__ITER}`,
      json_content: {
        version: 1,
        nodes: [
          {
            id: "node-1",
            type: "llm_caller",
            position: { x: 0, y: 0 },
            data: { label: "LLM", config: { model: "gpt-4o-mini" } },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    }),
    { headers: HEADERS },
  );
  graphCreateDuration.add(Date.now() - createStart);
  errorRate.add(![200, 201].includes(createResp.status));
  check(createResp, { "create graph 201": (r) => [200, 201].includes(r.status) });

  // 3. Get graph (read)
  if ([200, 201].includes(createResp.status)) {
    const body = JSON.parse(createResp.body);
    const graphId = body.id;
    if (graphId) {
      const readStart = Date.now();
      const readResp = http.get(`${BASE_URL}/graphs/${graphId}`, { headers: HEADERS });
      graphReadDuration.add(Date.now() - readStart);
      errorRate.add(readResp.status !== 200);
    }
  }

  sleep(0.5);
}

function runExecutionScenario() {
  // Start an execution (assume a known graph_id exists from setup)
  const graphId = __ENV.LOAD_TEST_GRAPH_ID || "00000000-0000-0000-0000-000000000001";
  const startReq = Date.now();
  const resp = http.post(
    `${BASE_URL}/executions`,
    JSON.stringify({ graph_id: graphId, input_data: { query: "load test" } }),
    { headers: HEADERS },
  );
  executionStartDuration.add(Date.now() - startReq);
  errorRate.add(![200, 202].includes(resp.status));
  check(resp, { "execution started": (r) => [200, 202].includes(r.status) });

  sleep(2);
}
