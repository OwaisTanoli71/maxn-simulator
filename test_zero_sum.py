from engine import Node, solve_minimax, solve_alpha_beta, PlayerConfig

root = Node(0)

# depth 1 (P2)
c1 = Node(1)
c2 = Node(2)
root.children = [c1, c2]

# depth 2 (P3)
c1_1 = Node(3)
c1_2 = Node(4)
c1.children = [c1_1, c1_2]

c2_1 = Node(5)
c2_2 = Node(6)
c2.children = [c2_1, c2_2]

# depth 3 (leaves)
c1_1.leaf = [10, -10, 0]
c1_2.leaf = [5, -5, 0]

c2_1.leaf = [-5, 5, 0]
c2_2.leaf = [-10, 10, 0]

cfgs = [PlayerConfig(0, 'rational'), PlayerConfig(1, 'rational'), PlayerConfig(2, 'rational')]

mm = solve_minimax(root, cfgs)
root.reset()
ab = solve_alpha_beta(root, cfgs)

print(f"MM: {mm['root_value']}")
print(f"AB: {ab['root_value']}")

