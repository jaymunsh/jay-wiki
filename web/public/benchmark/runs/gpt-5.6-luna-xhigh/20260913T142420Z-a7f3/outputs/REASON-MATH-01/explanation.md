# REASON-MATH-01 explanation

For 250 pages, the undiscounted paper cost is

`100 × 120 + 150 × 90 = 12,000 + 13,500 = 25,500`.

Thus **M1 = 25,500**. The order qualifies for the 10% discount, so the
after-discount cost is `25,500 × 0.9 = 22,950`, giving **M2 = 22,950**. That
amount is at least 20,000, so shipping is free and **M3 = 22,950**.

A 125-page order costs `100 × 120 + 25 × 90 = 14,250`. It is below the
200-page discount threshold, and therefore each order costs
`14,250 + 2,500 = 16,750` including shipping. Two separate orders total
`2 × 16,750 = 33,500`, so **M4 = 33,500**.

For an order below 200 pages, the paper cost for `n ≥ 100` is
`12,000 + 90(n − 100)`. Reaching 20,000 first occurs at `n = 189`, where the
cost is `20,010`; hence shipping is free and **M5 = 189**. The discount
threshold makes the function non-monotonic: at 200 pages the cost becomes
`(12,000 + 100 × 90) × 0.9 = 18,900`, which is below 20,000. In the discounted
region the cost is `0.9(90n + 3,000) = 81n + 2,700`; it reaches 20,000 only at
214 pages, later than 189. Therefore the threshold comparison does not
replace the earlier 189-page solution.
