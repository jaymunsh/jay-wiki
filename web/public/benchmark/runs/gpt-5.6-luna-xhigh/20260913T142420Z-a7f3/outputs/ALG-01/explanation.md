# ALG-01 explanation

`maxValue` validates every job before doing any scheduling work. It copies
each triple into a fresh object, so sorting cannot mutate either the input
array or its inner arrays. Jobs are sorted by increasing end time. For the
job at position `i`, binary search finds the number of earlier jobs whose end
is at most its start; this is the weighted-interval predecessor and includes
half-open adjacency. The recurrence is

`dp[i] = max(dp[i-1], value[i] + dp[predecessor(i)])`.

The final result is the best value among the first `n` sorted jobs. Sorting
costs `O(n log n)`, predecessor searches and the dynamic program cost
`O(n log n)`, and the copied intervals, end times, and DP table use `O(n)` extra
space. Values remain below the JavaScript safe-integer limit under the stated
constraints.
