import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";

export const options = {
  vus: 40,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<250"],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/healthz`);
  check(health, { "healthz returns 200": (r) => r.status === 200 });

  const metrics = http.get(`${BASE_URL}/metrics`);
  check(metrics, { "metrics returns 200": (r) => r.status === 200 });

  sleep(0.1);
}

