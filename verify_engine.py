import sys
import traceback
from engine import Node, solve_minimax, solve_alpha_beta, PlayerConfig

def assert_equal(expected, actual, msg):
    if expected != actual:
        print(f"FAIL: {msg}. Expected {expected}, got {actual}")
        sys.exit(1)

# Test 1: Rational
# P1 chooses between [5, 0, 0] and [10, 0, 0]. Should pick [10, 0, 0].
root1 = Node(0)
c1 = Node(1)
c1.leaf = [5, 0, 0]
c2 = Node(2)
c2.leaf = [10, 0, 0]
root1.children = [c1, c2]

cfgs_rat = [PlayerConfig(0, 'rational'), PlayerConfig(1, 'rational'), PlayerConfig(2, 'rational')]
res_mm = solve_minimax(root1, cfgs_rat)
assert_equal([10, 0, 0], res_mm["root_value"], "Rational Minimax P1 Choice")

# Test 2: Cooperative
# P1 is ally with P2. P1 chooses between [5, 5, 0] (sum 10) and [6, 0, 0] (sum 6).
root2 = Node(0)
c1 = Node(1)
c1.leaf = [5, 5, 0]
c2 = Node(2)
c2.leaf = [6, 0, 0]
root2.children = [c1, c2]

# P1 allied with P2
cfg_p1_coop = PlayerConfig(0, 'cooperative', ally=1, coop_w=1.0)
cfgs_coop = [cfg_p1_coop, PlayerConfig(1, 'rational'), PlayerConfig(2, 'rational')]
res_mm_coop = solve_minimax(root2, cfgs_coop)
assert_equal([5, 5, 0], res_mm_coop["root_value"], "Cooperative Minimax P1 Choice")

# Test 3: Spiteful
# P1 is spiteful towards P3. P1 chooses between [5, 0, 5] (utility 5-5=0) and [4, 0, 1] (utility 4-1=3).
root3 = Node(0)
c1 = Node(1)
c1.leaf = [5, 0, 5]
c2 = Node(2)
c2.leaf = [4, 0, 1]
root3.children = [c1, c2]

cfg_p1_spite = PlayerConfig(0, 'spiteful', enemy=2, spite_w=1.0)
cfgs_spite = [cfg_p1_spite, PlayerConfig(1, 'rational'), PlayerConfig(2, 'rational')]
res_mm_spite = solve_minimax(root3, cfgs_spite)
assert_equal([4, 0, 1], res_mm_spite["root_value"], "Spiteful Minimax P1 Choice")

# Test 4: Zero-sum strict behavior
# P1 chooses. Leaves: [2, -1, -1] (sum 0) vs [1, 1, 1] (sum 3)
# If zero-sum is enforced, what happens? engine.py just uses rational, but does it error out?
# Actually engine.py utility for zero-sum is just rational. The UI enforces sum=0.
cfg_p1_zs = PlayerConfig(0, 'zero-sum')
assert_equal(5, cfg_p1_zs.utility([5, 2, 3]), "Zero-sum utility is just self score")

print("Engine Logic Verification: All basic cases PASSED.")

