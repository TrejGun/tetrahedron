import { Counter, Gauge, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();

export const upstreamRequestDuration = new Histogram({
  name: "upstream_request_duration_seconds",
  help: "Duration of catalog and reservations HTTP attempts",
  labelNames: ["upstream", "method", "status"] as const,
  registers: [metricsRegistry],
});

export const upstreamRetriesTotal = new Counter({
  name: "upstream_retries_total",
  help: "Retries of catalog and reservations HTTP calls",
  labelNames: ["upstream", "method"] as const,
  registers: [metricsRegistry],
});

export const upstreamCircuitOpen = new Gauge({
  name: "upstream_circuit_open",
  help: "1 when the upstream sliding-window circuit is open",
  labelNames: ["upstream"] as const,
  registers: [metricsRegistry],
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Inbound HTTP requests by method and status",
  labelNames: ["method", "status"] as const,
  registers: [metricsRegistry],
});
