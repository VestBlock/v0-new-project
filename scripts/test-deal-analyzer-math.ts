import assert from "node:assert/strict"

import {
  computeArv,
  computeEndBuyerProfit,
  computeMao,
  computeSpread,
  gradeDeal,
} from "../lib/property/dealAnalyzerMath"

const mao = computeMao({
  arv: 184020,
  rulePct: 0.7,
  repairCost: 0,
  assignmentFee: 10000,
})

assert.equal(mao, 118814, "MAO should match the 70% rule example")

const spread = computeSpread({
  mao,
  sellerAsk: 140000,
})

assert.equal(spread, -21186, "Spread should reflect seller ask above MAO")

const endBuyerProfit = computeEndBuyerProfit({
  arv: 184020,
  sellerAsk: 140000,
  assignmentFee: 10000,
  repairCost: 0,
})

assert.equal(endBuyerProfit, 34020, "End-buyer profit should match the example")
assert.equal(gradeDeal({ spread }), "RISKY", "Negative spread should grade as risky")
assert.equal(gradeDeal({ spread: 8500 }), "GOOD", "Positive spread should grade as good")

assert.equal(
  computeArv({
    mode: "MANUAL",
    manualArv: 192500,
  }),
  192500,
  "Manual ARV should pass through cleanly"
)

assert.equal(
  computeArv({
    mode: "COMPS_AVG",
    selectedComps: [{ salePrice: 150000 }, { salePrice: 170000 }, { salePrice: 160000 }],
  }),
  160000,
  "Comp averaging should use the selected sale prices"
)

console.log("deal-analyzer-math: ok")
