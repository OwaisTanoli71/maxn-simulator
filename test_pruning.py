import sys
from engine import build_example_tree, solve_minimax, solve_alpha_beta, PlayerConfig

for idx in range(3):
    tree = build_example_tree(idx)
    configs = [PlayerConfig(i, 'rational') for i in range(3)]
    
    mm = solve_minimax(tree, configs)
    ab = solve_alpha_beta(tree, configs)
    
    print(f'Tree {idx}:')
    print(f'  Minimax:   {mm["root_value"]}')
    print(f'  AlphaBeta: {ab["root_value"]}')
    print(f'  Same?      {mm["root_value"] == ab["root_value"]}')
