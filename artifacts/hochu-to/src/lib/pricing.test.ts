/**
 * Stage 26 — юнит-тесты pricing.ts (амортизация).
 *
 * Запуск: `pnpm --filter @workspace/hochu-to test`
 * Использует встроенный node:test + --experimental-strip-types (Node 22+).
 *
 * Файл лежит рядом с исходником, но в bundle Vite не попадает —
 * Vite подключает только импортированные модули, а на test-файл никто не ссылается.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateResidualValue,
  calculateDepreciationPercent,
  RESIDUAL_VALUE_FLOOR_RATIO,
} from "./pricing.ts";

test("calculateResidualValue: новая вещь (0 аренд) — полная стоимость", () => {
  assert.equal(calculateResidualValue(30000, 0, 1), 30000);
  assert.equal(calculateResidualValue(1, 0, 5), 1);
  assert.equal(calculateResidualValue(99999.99, 0, 10), 99999.99);
});

test("calculateResidualValue: 50 аренд × 1% = 50% — половина", () => {
  assert.equal(calculateResidualValue(30000, 50, 1), 15000);
});

test("calculateResidualValue: 89 аренд × 1% = 89% — чуть выше floor (11%)", () => {
  assert.equal(calculateResidualValue(30000, 89, 1), 3300);
});

test("calculateResidualValue: 100 аренд × 1% = 100% — упирается в floor 10%", () => {
  assert.equal(calculateResidualValue(30000, 100, 1), 3000);
});

test("calculateResidualValue: 200 аренд × 1% = -100% — clamped к floor", () => {
  assert.equal(calculateResidualValue(30000, 200, 1), 3000);
});

test("calculateResidualValue: pct=2 + meter=51 → ratio=-0.02 → floor 10%", () => {
  // raw = 30000 * (1 - 51*2/100) = 30000 * -0.02 = -600
  // floor = 30000 * 0.1 = 3000
  // max(-600, 3000) = 3000
  assert.equal(calculateResidualValue(30000, 51, 2), 3000);
});

test("calculateResidualValue: округление до копеек", () => {
  // 12345 * (1 - 7*1/100) = 12345 * 0.93 = 11480.85
  assert.equal(calculateResidualValue(12345, 7, 1), 11480.85);
});

test("calculateResidualValue: edge — initialPrice=0 → 0", () => {
  assert.equal(calculateResidualValue(0, 10, 1), 0);
});

test("calculateResidualValue: edge — отрицательная цена → 0", () => {
  assert.equal(calculateResidualValue(-100, 10, 1), 0);
});

test("calculateResidualValue: edge — NaN/Infinity initialPrice → 0", () => {
  assert.equal(calculateResidualValue(Number.NaN, 10, 1), 0);
  assert.equal(calculateResidualValue(Number.POSITIVE_INFINITY, 10, 1), 0);
});

test("calculateResidualValue: edge — отрицательный meter нормализуется к 0", () => {
  assert.equal(calculateResidualValue(30000, -5, 1), 30000);
});

test("calculateResidualValue: edge — отрицательный pct нормализуется к 0", () => {
  assert.equal(calculateResidualValue(30000, 50, -3), 30000);
});

test("calculateResidualValue: edge — meter=NaN нормализуется к 0", () => {
  assert.equal(calculateResidualValue(30000, Number.NaN, 1), 30000);
});

test("calculateResidualValue: edge — meter=Infinity санитизируется к 0 (не NaN)", () => {
  // Без санитизации `Infinity * 0 = NaN` → формула возвращала бы мусор.
  assert.equal(calculateResidualValue(30000, Number.POSITIVE_INFINITY, 1), 30000);
  assert.equal(calculateResidualValue(30000, Number.NEGATIVE_INFINITY, 1), 30000);
});

test("calculateResidualValue: edge — pct=Infinity санитизируется к 0", () => {
  assert.equal(calculateResidualValue(30000, 50, Number.POSITIVE_INFINITY), 30000);
  assert.equal(calculateResidualValue(30000, 50, Number.NEGATIVE_INFINITY), 30000);
});

test("calculateResidualValue: edge — pct=NaN нормализуется к 0", () => {
  assert.equal(calculateResidualValue(30000, 50, Number.NaN), 30000);
});

test("calculateResidualValue: edge — meter=0 + pct=Infinity не даёт NaN", () => {
  // Главный «опасный» случай: 0 × Infinity без санитизации = NaN.
  const r = calculateResidualValue(30000, 0, Number.POSITIVE_INFINITY);
  assert.ok(Number.isFinite(r));
  assert.equal(r, 30000);
});

test("calculateResidualValue: дробный meter округляется вниз (целые аренды)", () => {
  // floor(7.9) = 7, raw = 30000 * 0.93 = 27900
  assert.equal(calculateResidualValue(30000, 7.9, 1), 27900);
});

test("calculateDepreciationPercent: новая вещь — 0%", () => {
  assert.equal(calculateDepreciationPercent(0, 1), 0);
});

test("calculateDepreciationPercent: 50 × 1% = 50%", () => {
  assert.equal(calculateDepreciationPercent(50, 1), 50);
});

test("calculateDepreciationPercent: ceiling 90% (зеркалит floor 10%)", () => {
  assert.equal(calculateDepreciationPercent(200, 1), 90);
  assert.equal(calculateDepreciationPercent(100, 1), 90);
});

test("calculateDepreciationPercent: edge — отрицательные → 0", () => {
  assert.equal(calculateDepreciationPercent(-10, 1), 0);
  assert.equal(calculateDepreciationPercent(50, -2), 0);
});

test("calculateDepreciationPercent: edge — NaN/Infinity → 0", () => {
  assert.equal(calculateDepreciationPercent(Number.NaN, 1), 0);
  assert.equal(calculateDepreciationPercent(50, Number.NaN), 0);
  assert.equal(calculateDepreciationPercent(Number.POSITIVE_INFINITY, 1), 0);
  assert.equal(calculateDepreciationPercent(50, Number.POSITIVE_INFINITY), 0);
  assert.equal(calculateDepreciationPercent(Number.NEGATIVE_INFINITY, 1), 0);
  // Опасный случай: 0 × Infinity = NaN без санитизации.
  assert.equal(calculateDepreciationPercent(0, Number.POSITIVE_INFINITY), 0);
});

test("RESIDUAL_VALUE_FLOOR_RATIO: ровно 0.1 (10%)", () => {
  assert.equal(RESIDUAL_VALUE_FLOOR_RATIO, 0.1);
});
