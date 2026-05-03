import random
from engine import Node, solve_minimax, solve_alpha_beta, PlayerConfig

def gen_tree(depth, max_depth, nid=[0]):
    n = Node(nid[0])
    nid[0] += 1
    if depth == max_depth:
        n.leaf = [random.randint(0, 10) for _ in range(3)]
    else:
        for _ in range(random.randint(2, 3)):
            n.children.append(gen_tree(depth+1, max_depth, nid))
    return n

configs = [PlayerConfig(i, 'rational') for i in range(3)]

diffs = 0
for _ in range(100):
    t = gen_tree(0, 4)
    mm = solve_minimax(t, configs)
    t.reset()
    ab = solve_alpha_beta(t, configs)
    if mm["root_value"] != ab["root_value"]:
        diffs += 1
        print(f"Diff! MM: {mm['root_value']}, AB: {ab['root_value']}")
        break

print(f"Total differences out of 100: {diffs}")
