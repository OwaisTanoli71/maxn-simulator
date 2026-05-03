from engine import PlayerConfig

cfg = PlayerConfig.from_dict({"player": 0, "mode": "zero-sum"})
print("Mode:", cfg.mode)
print("Utility of [10, 5, 5]:", cfg.utility([10, 5, 5]))

cfg2 = PlayerConfig.from_dict({"player": 0, "mode": "zero_sum"})
print("Mode:", cfg2.mode)
print("Utility of [10, 5, 5] (with underscore):", cfg2.utility([10, 5, 5]))
